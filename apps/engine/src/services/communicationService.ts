import type { Device } from '@prisma/client';
import { getPrismaClient } from './database.js';
import { getDriver } from '../drivers/driverFactory.js';
import type { DeviceConnectionResult, ReadTagOnceResult, WriteTagResult } from '../drivers/types.js';
import { appendEngineLog } from './engineLogger.js';
import { resolveRtuProfile, resolveTcpProfile, validateTagForModbus } from '../drivers/modbus/profile.js';

type DeviceStatus = Device['status'];

export async function listRuntimeDevices() {
  const prisma = getPrismaClient();
  return prisma.device.findMany({
    orderBy: [{ type: 'asc' }, { name: 'asc' }],
    include: { tags: true, children: true, parent: true }
  });
}

function mapDeviceStatus(result: DeviceConnectionResult): DeviceStatus {
  if (result.status === 'online') return 'online';
  if (result.status === 'offline') return 'offline';
  if (result.status === 'unsupported' || result.status === 'invalid_configuration') return 'warning';
  return 'unknown';
}

export async function testDeviceConnection(deviceId: string): Promise<DeviceConnectionResult> {
  const prisma = getPrismaClient();
  const device = await prisma.device.findUnique({ where: { id: deviceId }, include: { parent: true } });
  if (!device) throw new Error(`Device not found: ${deviceId}`);

  const healthProtocol = device.type === 'converter' && device.protocol === 'modbus_tcp' ? 'tcp' : device.protocol;
  const driver = getDriver(healthProtocol);
  const result = await driver.testConnection(device);

  await prisma.device.update({
    where: { id: device.id },
    data: {
      status: mapDeviceStatus(result),
      lastTestAt: new Date(),
      lastError: result.ok ? null : result.error ?? result.message
    }
  });

  appendEngineLog(result.ok ? 'info' : 'warn', 'Device connection test completed', {
    deviceId: device.id,
    deviceName: device.name,
    protocol: device.protocol,
    ok: result.ok,
    status: result.status,
    message: result.message,
    error: result.error,
    endpoint: result.endpoint
  });

  return result;
}

export async function readTagOnce(tagId: string): Promise<ReadTagOnceResult> {
  const prisma = getPrismaClient();
  const tag = await prisma.tag.findUnique({ where: { id: tagId }, include: { device: { include: { parent: true } } } });
  if (!tag) throw new Error(`Tag not found: ${tagId}`);

  const driver = getDriver(tag.device.protocol);
  const result = await driver.readTagOnce(tag.device, tag);

  appendEngineLog(result.ok ? 'info' : 'warn', 'One-time tag read completed', {
    tagId: tag.id,
    tagName: tag.name,
    deviceId: tag.deviceId,
    deviceName: tag.device.name,
    protocol: tag.device.protocol,
    ok: result.ok,
    message: result.message,
    error: result.error,
    endpoint: result.endpoint
  });

  return result;
}

export async function validateDeviceCommunication(deviceId: string) {
  const prisma = getPrismaClient();
  const device = await prisma.device.findUnique({ where: { id: deviceId }, include: { parent: true, tags: true } });
  if (!device) throw new Error(`Device not found: ${deviceId}`);

  const errors: string[] = [];
  const warnings: string[] = [];
  let endpoint: Record<string, unknown> | undefined;

  if (!device.communicationEnabled) warnings.push('Communication is disabled for this device.');
  if (device.protocol === 'tcp') {
    const ipAddress = device.ipAddress?.trim();
    const port = Number(device.port ?? 0);
    if (!ipAddress) errors.push('TCP converter requires an IP address.');
    if (!Number.isInteger(port) || port < 1 || port > 65535) errors.push('TCP converter requires a valid TCP port between 1 and 65535.');
    if (errors.length === 0) endpoint = {
      transport: 'tcp',
      ipAddress,
      port,
      timeoutMs: device.timeoutMs ?? 2000,
      sourceDeviceName: device.name
    };
  } else if (device.protocol === 'modbus_tcp') {
    const resolved = resolveTcpProfile(device);
    if (resolved.error) errors.push(resolved.error);
    if (resolved.profile) endpoint = {
      transport: 'tcp',
      ipAddress: resolved.profile.ipAddress,
      port: resolved.profile.port,
      peripheralNumber: resolved.profile.peripheralNumber,
      sourceDeviceName: resolved.profile.sourceDeviceName
    };
  } else if (device.protocol === 'modbus_rtu') {
    const resolved = resolveRtuProfile(device);
    if (resolved.error) errors.push(resolved.error);
    if (resolved.profile) endpoint = {
      transport: 'rtu',
      serialPort: resolved.profile.serialPort,
      baudRate: resolved.profile.baudRate,
      dataBits: resolved.profile.dataBits,
      stopBits: resolved.profile.stopBits,
      parity: resolved.profile.parity,
      peripheralNumber: resolved.profile.peripheralNumber,
      sourceDeviceName: resolved.profile.sourceDeviceName
    };
  } else if (device.protocol === 'mqtt') {
    const host = device.ipAddress?.trim();
    const port = Number(device.port ?? 1883);
    if (!host) errors.push('MQTT broker requires a host/IP address.');
    if (!Number.isInteger(port) || port < 1 || port > 65535) errors.push('MQTT broker port must be between 1 and 65535.');
    if (errors.length === 0) {
      endpoint = {
        transport: 'mqtt',
        host,
        port,
        username: device.mqttUsername ?? null,
        clientId: device.mqttClientId ?? null,
        sourceDeviceName: device.name,
      };
    }
  } else {
    errors.push(`Protocol ${device.protocol} is not implemented for physical device communication.`);
  }

  if (device.protocol !== 'tcp' && device.protocol !== 'udp' && device.protocol !== 'mqtt') {
    for (const tag of device.tags) {
      const tagError = validateTagForModbus(tag);
      if (tagError) errors.push(`Tag ${tag.name}: ${tagError}`);
    }
  } else if (device.protocol === 'mqtt') {
    for (const tag of device.tags) {
      const topic = tag.mqttTopic?.trim() || tag.description?.trim() || tag.name.trim();
      if (!topic) errors.push(`Tag ${tag.name}: MQTT topic is required.`);
    }
  } else if (device.tags.length > 0) {
    warnings.push('Plain TCP/UDP converters should not have tags directly. Add a meter below the converter and create tags on the meter.');
  }

  return {
    deviceId: device.id,
    deviceName: device.name,
    protocol: device.protocol,
    valid: errors.length === 0,
    errors,
    warnings,
    endpoint,
    tagCount: device.tags.length
  };
}

export async function runDeviceDiagnostics(deviceId: string) {
  const prisma = getPrismaClient();
  const device = await prisma.device.findUnique({ where: { id: deviceId }, include: { tags: true } });
  if (!device) throw new Error(`Device not found: ${deviceId}`);
  const validation = await validateDeviceCommunication(deviceId);
  if (!validation.valid) {
    return {
      deviceId,
      ok: false,
      validation,
      connection: null,
      reads: [] as ReadTagOnceResult[],
      message: 'Device diagnostics stopped because configuration validation failed.'
    };
  }

  const connection = await testDeviceConnection(deviceId);
  const reads: ReadTagOnceResult[] = [];
  if (connection.ok) {
    for (const tag of device.tags.slice(0, 10)) {
      reads.push(await readTagOnce(tag.id));
    }
  }
  return {
    deviceId,
    ok: connection.ok && reads.every((read) => read.ok),
    validation,
    connection,
    reads,
    message: 'Diagnostics completed against configured physical communication endpoints.'
  };
}

export async function writeTag(tagId: string, value: number | boolean): Promise<WriteTagResult> {
  const prisma = getPrismaClient();
  const tag = await prisma.tag.findUnique({ where: { id: tagId }, include: { device: { include: { parent: true } } } });
  if (!tag) throw new Error(`Tag not found: ${tagId}`);

  const driver = getDriver(tag.device.protocol);
  const result = await driver.writeTag(tag.device, tag, value);

  if (result.ok) {
    const numericValue = typeof value === 'boolean' ? (value ? 1 : 0) : value;
    await prisma.tag.update({
      where: { id: tagId },
      data: {
        currentValue: numericValue,
        quality: 'good',
        lastValueAt: new Date()
      }
    });
  }

  appendEngineLog(result.ok ? 'info' : 'warn', 'Manual tag write completed', {
    tagId: tag.id,
    tagName: tag.name,
    deviceId: tag.deviceId,
    deviceName: tag.device.name,
    protocol: tag.device.protocol,
    value,
    ok: result.ok,
    message: result.message,
    error: result.error,
    endpoint: result.endpoint
  });

  return result;
}

