import type { Tag } from '@prisma/client';
import { setTimeout as delay } from 'node:timers/promises';
import type { DeviceConnectionResult, DeviceDriver, ReadTagOnceResult, RuntimeDevice, WriteTagResult } from '../types.js';
import { finishConnectionResult } from '../types.js';
import { closeClient, createClient, type ModbusClient } from '../modbus/clientTypes.js';
import { readModbusTagValue, readModbusTagsWithClient } from '../modbus/readTag.js';
import { resolveTcpProfile, validateTagForModbus } from '../modbus/profile.js';
import { encodeRegisterValue, bufferToUInt16Array } from '../modbus/codec.js';
import { createRtuOverTcpClient, createRtuOverUdpClient } from '../modbus/rtuTunnelClient.js';

function endpointSummary(profile: NonNullable<ReturnType<typeof resolveTcpProfile>['profile']>) {
    return {
        transport: profile.transport,
        ipAddress: profile.ipAddress,
        port: profile.port,
        peripheralNumber: profile.peripheralNumber,
        sourceDeviceId: profile.sourceDeviceId,
        sourceDeviceName: profile.sourceDeviceName
    };
}

function parentProtocol(device: RuntimeDevice) {
    return String(device.parent?.protocol ?? device.protocol ?? '').toLowerCase();
}

function getPerTagReadDelayMs() {
    const value = Number(process.env.ENERGYLINK_MODBUS_PER_TAG_DELAY_MS ?? 75);
    if (!Number.isFinite(value) || value < 0) return 75;
    return Math.min(value, 5000);
}

async function openClient(device: RuntimeDevice): Promise<{ client?: ModbusClient; error?: string; endpoint?: Record<string, unknown> }> {
    const transportProtocol = parentProtocol(device);
    const resolved = resolveTcpProfile(device);
    if (!resolved.profile) return { error: resolved.error ?? 'Invalid Modbus meter TCP/UDP configuration.' };
    const client = await createClient();
    client.setTimeout(resolved.profile.timeoutMs);

    if (transportProtocol === 'modbus_tcp') {
        await client.connectTCP(resolved.profile.ipAddress, { port: resolved.profile.port });
        client.setID(resolved.profile.peripheralNumber);
        return { client, endpoint: { ...endpointSummary(resolved.profile), transport: 'modbus_tcp' } };
    }

    if (transportProtocol === 'tcp') {
        closeClient(client);
        const tunnelClient = await createRtuOverTcpClient(resolved.profile.ipAddress, resolved.profile.port, resolved.profile.timeoutMs);
        tunnelClient.setID(resolved.profile.peripheralNumber);
        return { client: tunnelClient, endpoint: { ...endpointSummary(resolved.profile), transport: 'rtu_over_tcp', mode: 'TCP Tunnel (Modbus RTU)' } };
    }

    if (transportProtocol === 'udp') {
        closeClient(client);
        const tunnelClient = await createRtuOverUdpClient(resolved.profile.ipAddress, resolved.profile.port, resolved.profile.timeoutMs);
        tunnelClient.setID(resolved.profile.peripheralNumber);
        return { client: tunnelClient, endpoint: { ...endpointSummary(resolved.profile), transport: 'rtu_over_udp', mode: 'UDP Tunnel (Modbus RTU)' } };
    }

    closeClient(client);
    return { error: `Unsupported parent converter protocol for Modbus meter: ${transportProtocol || 'unknown'}` };
}

export class ModbusTcpDriver implements DeviceDriver {
    readonly protocol = 'modbus_tcp';

    async testConnection(device: RuntimeDevice): Promise<DeviceConnectionResult> {
        const startedAt = new Date();
        let client: ModbusClient | undefined;
        try {
            const opened = await openClient(device);
            if (!opened.client) {
                return finishConnectionResult(device, startedAt, false, 'invalid_configuration', opened.error ?? 'Invalid Modbus meter configuration.', opened.error, opened.endpoint);
            }
            client = opened.client;
            return finishConnectionResult(device, startedAt, true, 'online', 'Modbus meter connection opened successfully.', undefined, opened.endpoint);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return finishConnectionResult(device, startedAt, false, 'offline', 'Modbus meter connection failed.', message);
        } finally {
            if (client) closeClient(client);
        }
    }

    async readTagOnce(device: RuntimeDevice, tag: Tag): Promise<ReadTagOnceResult> {
        const startedAt = new Date();
        const tagInvalid = validateTagForModbus(tag);
        if (tagInvalid) {
            return {
                tagId: tag.id,
                tagName: tag.name,
                deviceId: device.id,
                deviceName: device.name,
                ok: false,
                quality: 'bad',
                readAt: new Date().toISOString(),
                elapsedMs: 0,
                message: tagInvalid,
                error: tagInvalid
            };
        }

        let client: ModbusClient | undefined;
        try {
            const opened = await openClient(device);
            if (!opened.client) {
                return {
                    tagId: tag.id,
                    tagName: tag.name,
                    deviceId: device.id,
                    deviceName: device.name,
                    ok: false,
                    quality: 'bad',
                    readAt: new Date().toISOString(),
                    elapsedMs: 0,
                    message: opened.error ?? 'Invalid Modbus meter configuration.',
                    error: opened.error,
                    endpoint: opened.endpoint
                };
            }
            client = opened.client;
            const { value, rawValue } = await readModbusTagValue(client, tag, device);
            const completedAt = new Date();
            return {
                tagId: tag.id,
                tagName: tag.name,
                deviceId: device.id,
                deviceName: device.name,
                ok: true,
                value,
                rawValue,
                quality: 'good',
                unit: tag.unit,
                readAt: completedAt.toISOString(),
                elapsedMs: completedAt.getTime() - startedAt.getTime(),
                message: 'Tag was read from the physical Modbus meter once.',
                endpoint: opened.endpoint
            };
        } catch (error) {
            const completedAt = new Date();
            const message = error instanceof Error ? error.message : String(error);
            return {
                tagId: tag.id,
                tagName: tag.name,
                deviceId: device.id,
                deviceName: device.name,
                ok: false,
                quality: 'bad',
                readAt: completedAt.toISOString(),
                elapsedMs: completedAt.getTime() - startedAt.getTime(),
                message: 'Real Modbus meter tag read failed.',
                error: message
            };
        } finally {
            if (client) {
                await delay(0);
                closeClient(client);
            }
        }
    }

    async readTags(device: RuntimeDevice, tags: Tag[]): Promise<ReadTagOnceResult[]> {
        if (tags.length === 0) return [];
        if ((device.maxRegistersPerGroup ?? 120) <= 2) {
            const results: ReadTagOnceResult[] = [];
            const perTagDelayMs = getPerTagReadDelayMs();
            for (const tag of tags) {
                if (results.length > 0 && perTagDelayMs > 0) {
                    await delay(perTagDelayMs);
                }
                results.push(await this.readTagOnce(device, tag));
            }
            return results;
        }

        let client: ModbusClient | undefined;
        try {
            const opened = await openClient(device);
            if (!opened.client) {
                const completedAt = new Date().toISOString();
                return tags.map((tag) => ({
                    tagId: tag.id,
                    tagName: tag.name,
                    deviceId: device.id,
                    deviceName: device.name,
                    ok: false,
                    quality: 'bad',
                    readAt: completedAt,
                    elapsedMs: 0,
                    message: opened.error ?? 'Invalid Modbus meter configuration.',
                    error: opened.error,
                    endpoint: opened.endpoint
                }));
            }
            client = opened.client;
            return await readModbusTagsWithClient(client, device, tags, opened.endpoint);
        } catch (error) {
            const completedAt = new Date().toISOString();
            const message = error instanceof Error ? error.message : String(error);
            return tags.map((tag) => ({
                tagId: tag.id,
                tagName: tag.name,
                deviceId: device.id,
                deviceName: device.name,
                ok: false,
                quality: 'bad',
                readAt: completedAt,
                elapsedMs: 0,
                message: 'Real Modbus meter grouped read failed.',
                error: message
            }));
        } finally {
            if (client) {
                await delay(0);
                closeClient(client);
            }
        }
    }

    async writeTag(device: RuntimeDevice, tag: Tag, value: number | boolean): Promise<WriteTagResult> {
        const startedAt = new Date();
        const tagInvalid = validateTagForModbus(tag);
        if (tagInvalid) {
            return {
                tagId: tag.id,
                tagName: tag.name,
                deviceId: device.id,
                deviceName: device.name,
                ok: false,
                value,
                writtenAt: new Date().toISOString(),
                elapsedMs: 0,
                message: tagInvalid,
                error: tagInvalid
            };
        }

        if (tag.registerType === 'discrete_input' || tag.registerType === 'input_register') {
            const err = `Writing to ${tag.registerType} tags is not supported (read-only).`;
            return {
                tagId: tag.id,
                tagName: tag.name,
                deviceId: device.id,
                deviceName: device.name,
                ok: false,
                value,
                writtenAt: new Date().toISOString(),
                elapsedMs: 0,
                message: err,
                error: err
            };
        }

        let client: ModbusClient | undefined;
        try {
            const opened = await openClient(device);
            if (!opened.client) {
                return {
                    tagId: tag.id,
                    tagName: tag.name,
                    deviceId: device.id,
                    deviceName: device.name,
                    ok: false,
                    value,
                    writtenAt: new Date().toISOString(),
                    elapsedMs: 0,
                    message: opened.error ?? 'Invalid Modbus meter configuration.',
                    error: opened.error,
                    endpoint: opened.endpoint
                };
            }
            client = opened.client;
            if (tag.registerType === 'coil') {
                const valBool = typeof value === 'boolean' ? value : Boolean(value);
                await client.writeCoil(tag.address, valBool);
            } else {
                const valNum = Number(value);
                const rawValue = (valNum - tag.offset) / tag.scale;
                const processedValue = tag.dataType === 'float32' || tag.dataType === 'float64' ? rawValue : Math.round(rawValue);
                const buffer = encodeRegisterValue(processedValue, tag.dataType);
                const uint16s = bufferToUInt16Array(buffer);
                if (uint16s.length === 1) {
                    await client.writeRegister(tag.address, uint16s[0]);
                } else {
                    await client.writeRegisters(tag.address, uint16s);
                }
            }
            const completedAt = new Date();
            return {
                tagId: tag.id,
                tagName: tag.name,
                deviceId: device.id,
                deviceName: device.name,
                ok: true,
                value,
                writtenAt: completedAt.toISOString(),
                elapsedMs: completedAt.getTime() - startedAt.getTime(),
                message: 'Tag value written to Modbus TCP device successfully.',
                endpoint: opened.endpoint
            };
        } catch (error) {
            const completedAt = new Date();
            const message = error instanceof Error ? error.message : String(error);
            return {
                tagId: tag.id,
                tagName: tag.name,
                deviceId: device.id,
                deviceName: device.name,
                ok: false,
                value,
                writtenAt: completedAt.toISOString(),
                elapsedMs: completedAt.getTime() - startedAt.getTime(),
                message: 'Modbus TCP tag write failed.',
                error: message
            };
        } finally {
            if (client) {
                await delay(0);
                closeClient(client);
            }
        }
    }
}
