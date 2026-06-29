import type { Tag } from '@prisma/client';
import { setTimeout as delay } from 'node:timers/promises';
import type { ReadTagOnceResult } from '../types.js';
import type { ModbusClient } from './clientTypes.js';
import { applyScaleOffset, decodeRegisterValue, registerLength } from './codec.js';
import { resolveRtuProfile, resolveTcpProfile, validateTagForModbus, type RuntimeDevice } from './profile.js';

type EffectiveRegisterType = 'coil' | 'discrete_input' | 'input_register' | 'holding_register';

type ModbusReadGroup = {
  registerType: EffectiveRegisterType;
  start: number;
  end: number;
  tags: Tag[];
};

function formatModbusError(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object') {
    const err = error as Record<string, unknown>;
    const parts = [
      typeof err.message === 'string' ? err.message : undefined,
      typeof err.modbusCode === 'number' || typeof err.modbusCode === 'string' ? `modbusCode=${err.modbusCode}` : undefined,
      typeof err.err === 'string' ? err.err : undefined,
      typeof err.name === 'string' ? err.name : undefined
    ].filter(Boolean);
    if (parts.length > 0) return parts.join(' ');
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
  return String(error);
}

function effectiveRegisterType(tag: Tag): EffectiveRegisterType {
  if (tag.registerType === 'coil') return 'coil';
  if (tag.registerType === 'discrete_input') return 'discrete_input';
  if (tag.registerType === 'input_register' || tag.functionCode === 4) return 'input_register';
  return 'holding_register';
}

function tagRegisterLength(tag: Tag) {
  return Math.max(tag.registers || 0, registerLength(tag.dataType));
}

function resolveEffectiveTransport(device: RuntimeDevice) {
  return String(device.parent?.protocol ?? device.protocol ?? '').toLowerCase();
}

function resolveLittleEndianData(device: RuntimeDevice) {
  const transport = resolveEffectiveTransport(device);
  if (transport === 'modbus_tcp' || transport === 'tcp' || transport === 'udp') return resolveTcpProfile(device).profile?.littleEndianData ?? false;
  if (transport === 'modbus_rtu') return resolveRtuProfile(device).profile?.littleEndianData ?? false;
  return device.littleEndianData ?? device.parent?.littleEndianData ?? false;
}

function resolveMaxRegistersPerGroup(device: RuntimeDevice) {
  const transport = resolveEffectiveTransport(device);
  if (transport === 'modbus_tcp' || transport === 'tcp' || transport === 'udp') return resolveTcpProfile(device).profile?.maxRegistersPerGroup ?? 120;
  if (transport === 'modbus_rtu') return resolveRtuProfile(device).profile?.maxRegistersPerGroup ?? 120;
  return device.maxRegistersPerGroup ?? device.parent?.maxRegistersPerGroup ?? 120;
}

function getReadRetryCount() {
  const value = Number(process.env.ENERGYLINK_MODBUS_READ_RETRIES ?? 1);
  if (!Number.isInteger(value) || value < 0) return 1;
  return Math.min(value, 5);
}

async function retryModbusRead<T>(operation: () => Promise<T>): Promise<T> {
  const retries = getReadRetryCount();
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await delay(50 * (attempt + 1));
      }
    }
  }
  throw lastError;
}

function makeReadResult(
  tag: Tag,
  device: RuntimeDevice,
  startedAt: Date,
  ok: boolean,
  data: Partial<ReadTagOnceResult>
): ReadTagOnceResult {
  const completedAt = new Date();
  return {
    tagId: tag.id,
    tagName: tag.name,
    deviceId: device.id,
    deviceName: device.name,
    ok,
    quality: ok ? 'good' : 'bad',
    unit: tag.unit,
    readAt: completedAt.toISOString(),
    elapsedMs: completedAt.getTime() - startedAt.getTime(),
    message: ok ? 'Tag was read from a grouped Modbus request.' : 'Grouped Modbus tag read failed.',
    ...data
  };
}

function groupTagsForModbusRead(tags: Tag[], maxRegistersPerGroup: number): ModbusReadGroup[] {
  const sorted = [...tags].sort((a, b) => {
    const typeCompare = effectiveRegisterType(a).localeCompare(effectiveRegisterType(b));
    if (typeCompare !== 0) return typeCompare;
    return a.address - b.address;
  });
  const groups: ModbusReadGroup[] = [];

  for (const tag of sorted) {
    const registerType = effectiveRegisterType(tag);
    const start = tag.address;
    const end = tag.address + tagRegisterLength(tag);
    const last = groups[groups.length - 1];
    if (last && last.registerType === registerType && Math.max(last.end, end) - last.start <= maxRegistersPerGroup) {
      last.tags.push(tag);
      last.end = Math.max(last.end, end);
    } else {
      groups.push({ registerType, start, end, tags: [tag] });
    }
  }

  return groups;
}

export async function readModbusTagValue(client: ModbusClient, tag: Tag, device: RuntimeDevice): Promise<{ value: number | boolean; rawValue: unknown }> {
  const length = tagRegisterLength(tag);
  
  const littleEndian = resolveLittleEndianData(device);

  if (tag.registerType === 'coil') {
    const result = await client.readCoils(tag.address, length);
    return { rawValue: result.data, value: Boolean(result.data[0]) };
  }
  if (tag.registerType === 'discrete_input') {
    const result = await client.readDiscreteInputs(tag.address, length);
    return { rawValue: result.data, value: Boolean(result.data[0]) };
  }
  if (tag.registerType === 'input_register' || tag.functionCode === 4) {
    const result = await client.readInputRegisters(tag.address, length);
    return { rawValue: result.data, value: applyScaleOffset(decodeRegisterValue(result.buffer, tag.dataType, littleEndian), tag) };
  }
  // Default to holding registers (FC3)
  const result = await client.readHoldingRegisters(tag.address, length);
  return { rawValue: result.data, value: applyScaleOffset(decodeRegisterValue(result.buffer, tag.dataType, littleEndian), tag) };
}

export async function readModbusTagsWithClient(
  client: ModbusClient,
  device: RuntimeDevice,
  tags: Tag[],
  endpoint?: Record<string, unknown>
): Promise<ReadTagOnceResult[]> {
  const startedAt = new Date();
  const littleEndian = resolveLittleEndianData(device);
  const maxRegistersPerGroup = Math.max(1, resolveMaxRegistersPerGroup(device));
  const resultByTagId = new Map<string, ReadTagOnceResult>();
  const validTags: Tag[] = [];

  for (const tag of tags) {
    const tagInvalid = validateTagForModbus(tag);
    if (tagInvalid) {
      resultByTagId.set(tag.id, makeReadResult(tag, device, startedAt, false, {
        message: tagInvalid,
        error: tagInvalid,
        endpoint
      }));
    } else {
      validTags.push(tag);
    }
  }

  const groups = groupTagsForModbusRead(validTags, maxRegistersPerGroup);

  for (const group of groups) {
    const length = group.end - group.start;
    try {
      if (group.registerType === 'coil') {
        const result = await retryModbusRead(() => client.readCoils(group.start, length));
        for (const tag of group.tags) {
          const offset = tag.address - group.start;
          const rawValue = result.data.slice(offset, offset + tagRegisterLength(tag));
          resultByTagId.set(tag.id, makeReadResult(tag, device, startedAt, true, {
            value: Boolean(rawValue[0]),
            rawValue,
            endpoint
          }));
        }
      } else if (group.registerType === 'discrete_input') {
        const result = await retryModbusRead(() => client.readDiscreteInputs(group.start, length));
        for (const tag of group.tags) {
          const offset = tag.address - group.start;
          const rawValue = result.data.slice(offset, offset + tagRegisterLength(tag));
          resultByTagId.set(tag.id, makeReadResult(tag, device, startedAt, true, {
            value: Boolean(rawValue[0]),
            rawValue,
            endpoint
          }));
        }
      } else {
        const result = group.registerType === 'input_register'
          ? await retryModbusRead(() => client.readInputRegisters(group.start, length))
          : await retryModbusRead(() => client.readHoldingRegisters(group.start, length));
        for (const tag of group.tags) {
          const offset = tag.address - group.start;
          const tagLength = tagRegisterLength(tag);
          const rawValue = result.data.slice(offset, offset + tagLength);
          const buffer = result.buffer.subarray(offset * 2, (offset + tagLength) * 2);
          resultByTagId.set(tag.id, makeReadResult(tag, device, startedAt, true, {
            value: applyScaleOffset(decodeRegisterValue(buffer, tag.dataType, littleEndian), tag),
            rawValue,
            endpoint
          }));
        }
      }
    } catch (error) {
      const message = formatModbusError(error);
      for (const tag of group.tags) {
        resultByTagId.set(tag.id, makeReadResult(tag, device, startedAt, false, {
          message: 'Grouped Modbus tag read failed.',
          error: message,
          endpoint
        }));
      }
    }
  }

  return tags.map((tag) => resultByTagId.get(tag.id) ?? makeReadResult(tag, device, startedAt, false, {
    message: 'Grouped Modbus tag read did not produce a result.',
    error: 'missing_read_result',
    endpoint
  }));
}
