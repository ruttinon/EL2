import type { Tag } from '@prisma/client';
import { setTimeout as delay } from 'node:timers/promises';
import type { DeviceConnectionResult, DeviceDriver, ReadTagOnceResult, RuntimeDevice, WriteTagResult } from '../types.js';
import { finishConnectionResult } from '../types.js';
import { closeClient, createClient, type ModbusClient } from '../modbus/clientTypes.js';
import { readModbusTagValue, readModbusTagsWithClient } from '../modbus/readTag.js';
import { resolveTcpProfile, validateTagForModbus } from '../modbus/profile.js';
import { createRtuOverUdpClient } from '../modbus/rtuTunnelClient.js';

type UdpEndpoint = {
  transport: 'udp';
  ipAddress: string;
  port: number;
  timeoutMs: number;
};

type OpenedClient = { client?: ModbusClient; error?: string; endpoint?: Record<string, unknown> };

function resolveUdpEndpoint(device: RuntimeDevice): { endpoint?: UdpEndpoint; error?: string } {
  const ipAddress = device.ipAddress?.trim();
  if (!ipAddress) return { error: 'UDP converter requires an IP address.' };
  const port = Number(device.port ?? 0);
  if (!Number.isInteger(port) || port < 1 || port > 65535) return { error: 'UDP converter requires a valid UDP port between 1 and 65535.' };
  const timeoutMs = Number(device.timeoutMs ?? 2000);
  return { endpoint: { transport: 'udp', ipAddress, port, timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 2000 } };
}

function parentProtocol(device: RuntimeDevice) {
  return String(device.parent?.protocol ?? device.protocol ?? '').toLowerCase();
}

async function openClient(device: RuntimeDevice): Promise<OpenedClient> {
  const transportProtocol = parentProtocol(device);
  const resolved = resolveTcpProfile(device);
  if (!resolved.profile) return { error: resolved.error ?? 'Invalid UDP converter Modbus configuration.' };
  const client = await createClient();
  client.setTimeout(resolved.profile.timeoutMs);

  if (transportProtocol === 'modbus_tcp') {
    await client.connectTCP(resolved.profile.ipAddress, { port: resolved.profile.port });
    client.setID(resolved.profile.peripheralNumber);
    return { client, endpoint: { transport: resolved.profile.transport, ipAddress: resolved.profile.ipAddress, port: resolved.profile.port, peripheralNumber: resolved.profile.peripheralNumber, sourceDeviceId: resolved.profile.sourceDeviceId, sourceDeviceName: resolved.profile.sourceDeviceName } };
  }

  if (transportProtocol === 'udp') {
    closeClient(client);
    const tunnelClient = await createRtuOverUdpClient(resolved.profile.ipAddress, resolved.profile.port, resolved.profile.timeoutMs);
    tunnelClient.setID(resolved.profile.peripheralNumber);
    return { client: tunnelClient, endpoint: { transport: 'rtu_over_udp', ipAddress: resolved.profile.ipAddress, port: resolved.profile.port, peripheralNumber: resolved.profile.peripheralNumber, sourceDeviceId: resolved.profile.sourceDeviceId, sourceDeviceName: resolved.profile.sourceDeviceName, mode: 'UDP Tunnel (Modbus RTU)' } };
  }

  closeClient(client);
  return { error: `Unsupported UDP converter parent protocol: ${transportProtocol || 'unknown'}` };
}

function unsupportedRead(device: RuntimeDevice, tag: Tag, startedAt: Date, operation: string): ReadTagOnceResult {
  const completedAt = new Date();
  return {
    tagId: tag.id,
    tagName: tag.name,
    deviceId: device.id,
    deviceName: device.name,
    ok: false,
    quality: 'bad',
    readAt: completedAt.toISOString(),
    elapsedMs: completedAt.getTime() - startedAt.getTime(),
    message: `${operation} is not supported by the plain UDP converter driver. Add a meter below this converter and read tags through the meter driver.`,
    error: 'Plain UDP converter does not define a register map.'
  };
}

export class UdpDriver implements DeviceDriver {
  readonly protocol = 'udp';

  async testConnection(device: RuntimeDevice): Promise<DeviceConnectionResult> {
    const startedAt = new Date();
    const resolved = resolveUdpEndpoint(device);
    if (!resolved.endpoint) return finishConnectionResult(device, startedAt, false, 'invalid_configuration', resolved.error ?? 'Invalid UDP converter configuration.', resolved.error);
    try {
      // Validate gateway availability, not the Modbus device itself.
      const client = await createClient();
      client.setTimeout(resolved.endpoint.timeoutMs);
      const tunnelClient = await createRtuOverUdpClient(resolved.endpoint.ipAddress, resolved.endpoint.port, resolved.endpoint.timeoutMs);
      closeClient(client);
      closeClient(tunnelClient);
      return finishConnectionResult(device, startedAt, true, 'online', 'UDP converter endpoint is configured.', undefined, resolved.endpoint);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return finishConnectionResult(device, startedAt, false, 'offline', 'UDP converter connection failed.', message, resolved.endpoint);
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
          message: opened.error ?? 'Invalid UDP converter Modbus configuration.',
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
        message: 'Tag was read from the UDP converter successfully.',
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
        message: 'UDP converter tag read failed.',
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
          message: opened.error ?? 'Invalid UDP converter Modbus configuration.',
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
        message: 'UDP converter grouped read failed.',
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
    const completedAt = new Date();
    return {
      tagId: tag.id,
      tagName: tag.name,
      deviceId: device.id,
      deviceName: device.name,
      ok: false,
      value,
      writtenAt: completedAt.toISOString(),
      elapsedMs: completedAt.getTime() - startedAt.getTime(),
      message: 'Tag write is not supported by the plain UDP converter driver. Write through a meter driver attached below this converter.',
      error: 'Plain UDP converter does not define writable registers.'
    };
  }
}
