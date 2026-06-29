import type { Tag } from '@prisma/client';
import { setTimeout as delay } from 'node:timers/promises';
import type { DeviceConnectionResult, DeviceDriver, ReadTagOnceResult, RuntimeDevice, WriteTagResult } from '../types.js';
import { finishConnectionResult } from '../types.js';
import { closeClient, createClient, type ModbusClient } from '../modbus/clientTypes.js';
import { readModbusTagValue, readModbusTagsWithClient } from '../modbus/readTag.js';
import { resolveRtuProfile, resolveTcpProfile, validateTagForModbus } from '../modbus/profile.js';
import { encodeRegisterValue, bufferToUInt16Array } from '../modbus/codec.js';
import { createRtuOverTcpClient, createRtuOverUdpClient } from '../modbus/rtuTunnelClient.js';

type OpenedClient = { client?: ModbusClient; error?: string; endpoint?: Record<string, unknown> };

function parentProtocol(device: RuntimeDevice) {
    return String(device.parent?.protocol ?? device.protocol ?? '').toLowerCase();
}

function tcpEndpointSummary(profile: NonNullable<ReturnType<typeof resolveTcpProfile>['profile']>) {
    return {
        transport: profile.transport,
        ipAddress: profile.ipAddress,
        port: profile.port,
        peripheralNumber: profile.peripheralNumber,
        sourceDeviceId: profile.sourceDeviceId,
        sourceDeviceName: profile.sourceDeviceName
    };
}

function rtuEndpointSummary(profile: NonNullable<ReturnType<typeof resolveRtuProfile>['profile']>) {
    return {
        transport: profile.transport,
        serialPort: profile.serialPort,
        baudRate: profile.baudRate,
        dataBits: profile.dataBits,
        stopBits: profile.stopBits,
        parity: profile.parity,
        peripheralNumber: profile.peripheralNumber,
        sourceDeviceId: profile.sourceDeviceId,
        sourceDeviceName: profile.sourceDeviceName
    };
}

async function openClient(device: RuntimeDevice): Promise<OpenedClient> {
    const transportProtocol = parentProtocol(device);
    const client = await createClient();

    if (transportProtocol === 'modbus_tcp') {
        const resolved = resolveTcpProfile(device);
        if (!resolved.profile) return { error: resolved.error ?? 'Invalid CVM-C11 Modbus TCP configuration.' };
        client.setTimeout(resolved.profile.timeoutMs);
        await client.connectTCP(resolved.profile.ipAddress, { port: resolved.profile.port });
        client.setID(resolved.profile.peripheralNumber);
        return { client, endpoint: { ...tcpEndpointSummary(resolved.profile), transport: 'modbus_tcp' } };
    }

    if (transportProtocol === 'tcp') {
        const resolved = resolveTcpProfile(device);
        if (!resolved.profile) return { error: resolved.error ?? 'Invalid CVM-C11 RTU-over-TCP tunnel configuration.' };
        client.setTimeout(resolved.profile.timeoutMs);
        closeClient(client);
        const tunnelClient = await createRtuOverTcpClient(resolved.profile.ipAddress, resolved.profile.port, resolved.profile.timeoutMs);
        tunnelClient.setID(resolved.profile.peripheralNumber);
        return { client: tunnelClient, endpoint: { ...tcpEndpointSummary(resolved.profile), transport: 'rtu_over_tcp', mode: 'TCP Tunnel (Modbus RTU)' } };
    }

    if (transportProtocol === 'udp') {
        const resolved = resolveTcpProfile(device);
        if (!resolved.profile) return { error: resolved.error ?? 'Invalid CVM-C11 RTU-over-UDP tunnel configuration.' };
        client.setTimeout(resolved.profile.timeoutMs);
        closeClient(client);
        const tunnelClient = await createRtuOverUdpClient(resolved.profile.ipAddress, resolved.profile.port, resolved.profile.timeoutMs);
        tunnelClient.setID(resolved.profile.peripheralNumber);
        return { client: tunnelClient, endpoint: { ...tcpEndpointSummary(resolved.profile), transport: 'rtu_over_udp', mode: 'UDP Tunnel (Modbus RTU)' } };
    }

    if (transportProtocol === 'modbus_rtu') {
        const resolved = resolveRtuProfile(device);
        if (!resolved.profile) return { error: resolved.error ?? 'Invalid CVM-C11 Modbus RTU configuration.' };
        client.setTimeout(resolved.profile.timeoutMs);
        await client.connectRTUBuffered(resolved.profile.serialPort, {
            baudRate: resolved.profile.baudRate,
            dataBits: resolved.profile.dataBits,
            stopBits: resolved.profile.stopBits,
            parity: resolved.profile.parity
        });
        client.setID(resolved.profile.peripheralNumber);
        return { client, endpoint: rtuEndpointSummary(resolved.profile) };
    }

    closeClient(client);
    return { error: `Unsupported converter protocol for CVM-C11: ${transportProtocol || 'unknown'}` };
}

export class CvmC11Driver implements DeviceDriver {
    readonly protocol = 'cvm_c11';

    async testConnection(device: RuntimeDevice): Promise<DeviceConnectionResult> {
        const startedAt = new Date();
        let client: ModbusClient | undefined;
        try {
            const opened = await openClient(device);
            if (!opened.client) {
                return finishConnectionResult(device, startedAt, false, 'invalid_configuration', opened.error ?? 'Invalid CVM-C11 configuration.', opened.error, opened.endpoint);
            }
            client = opened.client;
            return finishConnectionResult(device, startedAt, true, 'online', 'CVM-C11 connection opened successfully.', undefined, opened.endpoint);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return finishConnectionResult(device, startedAt, false, 'offline', 'CVM-C11 connection failed.', message);
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
                    message: opened.error ?? 'Invalid CVM-C11 configuration.',
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
                message: 'Tag was read from the CVM-C11 meter successfully.',
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
                message: 'CVM-C11 tag read failed.',
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
            const perTagDelayMs = Number(process.env.ENERGYLINK_MODBUS_PER_TAG_DELAY_MS ?? 75);
            for (const tag of tags) {
                if (results.length > 0 && perTagDelayMs > 0) await delay(perTagDelayMs);
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
                    message: opened.error ?? 'Invalid CVM-C11 configuration.',
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
                message: 'CVM-C11 grouped read failed.',
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
                    message: opened.error ?? 'Invalid CVM-C11 configuration.',
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
                if (uint16s.length === 1) await client.writeRegister(tag.address, uint16s[0]);
                else await client.writeRegisters(tag.address, uint16s);
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
                message: 'Tag value written to CVM-C11 meter successfully.',
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
                message: 'CVM-C11 tag write failed.',
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
