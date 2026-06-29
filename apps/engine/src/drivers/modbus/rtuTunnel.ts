import type { Tag } from '@prisma/client';
import { Socket } from 'node:net';
import dgram from 'node:dgram';
import type { DeviceConnectionResult, ReadTagOnceResult, RuntimeDevice, WriteTagResult } from '../types.js';
import { finishConnectionResult } from '../types.js';
import { applyScaleOffset, bufferToUInt16Array, decodeRegisterValue, encodeRegisterValue, registerLength } from './codec.js';
import { resolveTcpProfile, validateTagForModbus } from './profile.js';

type TunnelTransport = 'tcp' | 'udp';
type TunnelProfile = {
  transport: TunnelTransport;
  ipAddress: string;
  port: number;
  peripheralNumber: number;
  timeoutMs: number;
  littleEndianData: boolean;
  maxRegistersPerGroup: number;
  sourceDeviceId: string;
  sourceDeviceName: string;
};

type ReadRegisterType = 'coil' | 'discrete_input' | 'input_register' | 'holding_register';

type ReadGroup = {
  registerType: ReadRegisterType;
  start: number;
  end: number;
  tags: Tag[];
};

function parentProtocol(device: RuntimeDevice): TunnelTransport | undefined {
  const protocol = String(device.parent?.protocol ?? device.protocol ?? '').toLowerCase();
  return protocol === 'tcp' || protocol === 'udp' ? protocol : undefined;
}

function resolveTunnelProfile(device: RuntimeDevice): { profile?: TunnelProfile; error?: string } {
  const transport = parentProtocol(device);
  if (!transport) return { error: 'Parent converter must use TCP or UDP tunnel mode.' };
  const resolved = resolveTcpProfile(device);
  if (!resolved.profile) return { error: resolved.error ?? `Invalid Modbus RTU over ${transport.toUpperCase()} tunnel configuration.` };
  return {
    profile: {
      transport,
      ipAddress: resolved.profile.ipAddress,
      port: resolved.profile.port,
      peripheralNumber: resolved.profile.peripheralNumber,
      timeoutMs: resolved.profile.timeoutMs,
      littleEndianData: resolved.profile.littleEndianData,
      maxRegistersPerGroup: resolved.profile.maxRegistersPerGroup,
      sourceDeviceId: resolved.profile.sourceDeviceId,
      sourceDeviceName: resolved.profile.sourceDeviceName
    }
  };
}

function endpointSummary(profile: TunnelProfile) {
  return {
    transport: `modbus_rtu_over_${profile.transport}`,
    ipAddress: profile.ipAddress,
    port: profile.port,
    peripheralNumber: profile.peripheralNumber,
    sourceDeviceId: profile.sourceDeviceId,
    sourceDeviceName: profile.sourceDeviceName
  };
}

function crc16Modbus(buffer: Buffer) {
  let crc = 0xffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) {
      const carry = crc & 1;
      crc >>= 1;
      if (carry) crc ^= 0xa001;
    }
  }
  return crc & 0xffff;
}

function appendCrc(payload: Buffer) {
  const crc = crc16Modbus(payload);
  const frame = Buffer.alloc(payload.length + 2);
  payload.copy(frame, 0);
  frame.writeUInt16LE(crc, payload.length);
  return frame;
}

function validateCrc(frame: Buffer) {
  if (frame.length < 4) throw new Error('RTU response is too short.');
  const data = frame.subarray(0, frame.length - 2);
  const expected = frame.readUInt16LE(frame.length - 2);
  const actual = crc16Modbus(data);
  if (actual !== expected) throw new Error(`RTU CRC mismatch. expected=${expected} actual=${actual}`);
}

function expectedReadLength(functionCode: number, quantity: number) {
  if (functionCode === 1 || functionCode === 2) return 3 + Math.ceil(quantity / 8) + 2;
  return 3 + quantity * 2 + 2;
}

function requestReadFrame(unitId: number, functionCode: number, address: number, quantity: number) {
  const payload = Buffer.alloc(6);
  payload.writeUInt8(unitId, 0);
  payload.writeUInt8(functionCode, 1);
  payload.writeUInt16BE(address, 2);
  payload.writeUInt16BE(quantity, 4);
  return appendCrc(payload);
}

function requestWriteSingleFrame(unitId: number, functionCode: 5 | 6, address: number, value: number) {
  const payload = Buffer.alloc(6);
  payload.writeUInt8(unitId, 0);
  payload.writeUInt8(functionCode, 1);
  payload.writeUInt16BE(address, 2);
  payload.writeUInt16BE(value, 4);
  return appendCrc(payload);
}

function requestWriteMultipleRegistersFrame(unitId: number, address: number, values: number[]) {
  const byteCount = values.length * 2;
  const payload = Buffer.alloc(7 + byteCount);
  payload.writeUInt8(unitId, 0);
  payload.writeUInt8(16, 1);
  payload.writeUInt16BE(address, 2);
  payload.writeUInt16BE(values.length, 4);
  payload.writeUInt8(byteCount, 6);
  values.forEach((value, index) => payload.writeUInt16BE(value, 7 + index * 2));
  return appendCrc(payload);
}

async function exchangeTcp(profile: TunnelProfile, frame: Buffer, expectedLength?: number): Promise<Buffer> {
  return await new Promise<Buffer>((resolve, reject) => {
    const socket = new Socket();
    const chunks: Buffer[] = [];
    let done = false;
    const finish = (error?: Error, data?: Buffer) => {
      if (done) return;
      done = true;
      socket.destroy();
      if (error) reject(error);
      else resolve(data ?? Buffer.concat(chunks));
    };
    const timer = setTimeout(() => finish(new Error(`TCP tunnel timeout after ${profile.timeoutMs} ms.`)), profile.timeoutMs);
    timer.unref?.();
    socket.setTimeout(profile.timeoutMs);
    socket.once('error', (error) => {
      clearTimeout(timer);
      finish(error);
    });
    socket.once('timeout', () => {
      clearTimeout(timer);
      finish(new Error(`TCP tunnel timeout after ${profile.timeoutMs} ms.`));
    });
    socket.on('data', (chunk) => {
      chunks.push(chunk);
      const data = Buffer.concat(chunks);
      if (expectedLength && data.length >= expectedLength) {
        clearTimeout(timer);
        finish(undefined, data.subarray(0, expectedLength));
      }
    });
    socket.connect(profile.port, profile.ipAddress, () => {
      socket.write(frame);
    });
  });
}

async function exchangeUdp(profile: TunnelProfile, frame: Buffer, expectedLength?: number): Promise<Buffer> {
  return await new Promise<Buffer>((resolve, reject) => {
    const socket = dgram.createSocket('udp4');
    let done = false;
    const finish = (error?: Error, data?: Buffer) => {
      if (done) return;
      done = true;
      socket.close();
      if (error) reject(error);
      else resolve(expectedLength && data ? data.subarray(0, expectedLength) : data ?? Buffer.alloc(0));
    };
    const timer = setTimeout(() => finish(new Error(`UDP tunnel timeout after ${profile.timeoutMs} ms.`)), profile.timeoutMs);
    timer.unref?.();
    socket.once('error', (error) => {
      clearTimeout(timer);
      finish(error);
    });
    socket.once('message', (message) => {
      clearTimeout(timer);
      finish(undefined, message);
    });
    socket.send(frame, profile.port, profile.ipAddress, (error) => {
      if (error) {
        clearTimeout(timer);
        finish(error);
      }
    });
  });
}

async function exchange(profile: TunnelProfile, frame: Buffer, expectedLength?: number) {
  const response = profile.transport === 'udp'
    ? await exchangeUdp(profile, frame, expectedLength)
    : await exchangeTcp(profile, frame, expectedLength);
  validateCrc(response);
  if (response[0] !== profile.peripheralNumber) {
    throw new Error(`Unexpected RTU slave id ${response[0]}; expected ${profile.peripheralNumber}.`);
  }
  if ((response[1] & 0x80) === 0x80) {
    throw new Error(`Modbus RTU exception. function=${response[1] & 0x7f} code=${response[2]}`);
  }
  return response;
}

function effectiveRegisterType(tag: Tag): ReadRegisterType {
  if (tag.registerType === 'coil') return 'coil';
  if (tag.registerType === 'discrete_input') return 'discrete_input';
  if (tag.registerType === 'input_register' || tag.functionCode === 4) return 'input_register';
  return 'holding_register';
}

function functionCodeForRead(type: ReadRegisterType) {
  if (type === 'coil') return 1;
  if (type === 'discrete_input') return 2;
  if (type === 'input_register') return 4;
  return 3;
}

function tagRegisterLength(tag: Tag) {
  return Math.max(tag.registers || 0, registerLength(tag.dataType));
}

function groupTags(tags: Tag[], maxRegistersPerGroup: number): ReadGroup[] {
  const sorted = [...tags].sort((a, b) => {
    const typeCompare = effectiveRegisterType(a).localeCompare(effectiveRegisterType(b));
    if (typeCompare !== 0) return typeCompare;
    return a.address - b.address;
  });
  const groups: ReadGroup[] = [];
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

function decodeCoilBits(buffer: Buffer, quantity: number) {
  const values: boolean[] = [];
  for (let i = 0; i < quantity; i += 1) {
    const byte = buffer[Math.floor(i / 8)] ?? 0;
    values.push(Boolean(byte & (1 << (i % 8))));
  }
  return values;
}

function makeReadResult(tag: Tag, device: RuntimeDevice, startedAt: Date, ok: boolean, data: Partial<ReadTagOnceResult>): ReadTagOnceResult {
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
    message: ok ? 'Tag was read through the Modbus RTU tunnel.' : 'Modbus RTU tunnel tag read failed.',
    ...data
  };
}

async function readGroup(profile: TunnelProfile, group: ReadGroup, device: RuntimeDevice, startedAt: Date, endpoint: Record<string, unknown>, resultByTagId: Map<string, ReadTagOnceResult>) {
  const quantity = group.end - group.start;
  const fc = functionCodeForRead(group.registerType);
  const response = await exchange(profile, requestReadFrame(profile.peripheralNumber, fc, group.start, quantity), expectedReadLength(fc, quantity));
  if (response[1] !== fc) throw new Error(`Unexpected Modbus RTU function ${response[1]}; expected ${fc}.`);
  const byteCount = response[2];
  const data = response.subarray(3, 3 + byteCount);

  if (group.registerType === 'coil' || group.registerType === 'discrete_input') {
    const bits = decodeCoilBits(data, quantity);
    for (const tag of group.tags) {
      const offset = tag.address - group.start;
      const rawValue = bits.slice(offset, offset + tagRegisterLength(tag));
      resultByTagId.set(tag.id, makeReadResult(tag, device, startedAt, true, {
        value: Boolean(rawValue[0]),
        rawValue,
        endpoint
      }));
    }
    return;
  }

  const registers = bufferToUInt16Array(data);
  for (const tag of group.tags) {
    const offset = tag.address - group.start;
    const length = tagRegisterLength(tag);
    const rawValue = registers.slice(offset, offset + length);
    const buffer = data.subarray(offset * 2, (offset + length) * 2);
    resultByTagId.set(tag.id, makeReadResult(tag, device, startedAt, true, {
      value: applyScaleOffset(decodeRegisterValue(buffer, tag.dataType, profile.littleEndianData), tag),
      rawValue,
      endpoint
    }));
  }
}

export function isModbusRtuTunnelDevice(device: RuntimeDevice) {
  const protocol = parentProtocol(device);
  return protocol === 'tcp' || protocol === 'udp';
}

export async function testModbusRtuTunnelConnection(device: RuntimeDevice, driverName: string): Promise<DeviceConnectionResult> {
  const startedAt = new Date();
  try {
    const resolved = resolveTunnelProfile(device);
    if (!resolved.profile) {
      return finishConnectionResult(device, startedAt, false, 'invalid_configuration', resolved.error ?? 'Invalid Modbus RTU tunnel configuration.', resolved.error);
    }
    const profile = resolved.profile;
    const endpoint = endpointSummary(profile);
    const response = await exchange(profile, requestReadFrame(profile.peripheralNumber, 3, 0, 1), expectedReadLength(3, 1));
    return finishConnectionResult(device, startedAt, true, 'online', `${driverName} Modbus RTU tunnel responded successfully.`, undefined, { ...endpoint, probeFunction: response[1] });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return finishConnectionResult(device, startedAt, false, 'offline', `${driverName} Modbus RTU tunnel connection failed.`, message);
  }
}

export async function readModbusRtuTunnelTagOnce(device: RuntimeDevice, tag: Tag, driverName: string): Promise<ReadTagOnceResult> {
  const results = await readModbusRtuTunnelTags(device, [tag], driverName);
  return results[0];
}

export async function readModbusRtuTunnelTags(device: RuntimeDevice, tags: Tag[], driverName: string): Promise<ReadTagOnceResult[]> {
  const startedAt = new Date();
  const resolved = resolveTunnelProfile(device);
  if (!resolved.profile) {
    const completedAt = new Date().toISOString();
    return tags.map((tag) => ({
      tagId: tag.id,
      tagName: tag.name,
      deviceId: device.id,
      deviceName: device.name,
      ok: false,
      quality: 'bad',
      unit: tag.unit,
      readAt: completedAt,
      elapsedMs: 0,
      message: resolved.error ?? `Invalid ${driverName} Modbus RTU tunnel configuration.`,
      error: resolved.error,
      endpoint: undefined
    }));
  }

  const endpoint = endpointSummary(resolved.profile);
  const profile = resolved.profile;

  const resultByTagId = new Map<string, ReadTagOnceResult>();
  const validTags: Tag[] = [];
  for (const tag of tags) {
    const tagInvalid = validateTagForModbus(tag);
    if (tagInvalid) {
      resultByTagId.set(tag.id, makeReadResult(tag, device, startedAt, false, { message: tagInvalid, error: tagInvalid, endpoint }));
    } else {
      validTags.push(tag);
    }
  }

  for (const group of groupTags(validTags, Math.max(1, profile.maxRegistersPerGroup))) {
    try {
      await readGroup(profile, group, device, startedAt, endpoint, resultByTagId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      for (const tag of group.tags) {
        resultByTagId.set(tag.id, makeReadResult(tag, device, startedAt, false, {
          message: `${driverName} Modbus RTU tunnel grouped read failed.`,
          error: message,
          endpoint
        }));
      }
    }
  }

  return tags.map((tag) => resultByTagId.get(tag.id) ?? makeReadResult(tag, device, startedAt, false, {
    message: `${driverName} Modbus RTU tunnel read did not produce a result.`,
    error: 'missing_read_result',
    endpoint
  }));
}

export async function writeModbusRtuTunnelTag(device: RuntimeDevice, tag: Tag, value: number | boolean, driverName: string): Promise<WriteTagResult> {
  const startedAt = new Date();
  const tagInvalid = validateTagForModbus(tag);
  const resolved = resolveTunnelProfile(device);
  const endpoint = resolved.profile ? endpointSummary(resolved.profile) : undefined;
  if (tagInvalid) {
    return { tagId: tag.id, tagName: tag.name, deviceId: device.id, deviceName: device.name, ok: false, value, writtenAt: new Date().toISOString(), elapsedMs: 0, message: tagInvalid, error: tagInvalid, endpoint };
  }
  if (!resolved.profile) {
    return { tagId: tag.id, tagName: tag.name, deviceId: device.id, deviceName: device.name, ok: false, value, writtenAt: new Date().toISOString(), elapsedMs: 0, message: resolved.error ?? `Invalid ${driverName} Modbus RTU tunnel configuration.`, error: resolved.error, endpoint };
  }
  if (tag.registerType === 'discrete_input' || tag.registerType === 'input_register') {
    const err = `Writing to ${tag.registerType} tags is not supported (read-only).`;
    return { tagId: tag.id, tagName: tag.name, deviceId: device.id, deviceName: device.name, ok: false, value, writtenAt: new Date().toISOString(), elapsedMs: 0, message: err, error: err, endpoint };
  }

  try {
    const profile = resolved.profile;
    if (tag.registerType === 'coil') {
      const valBool = typeof value === 'boolean' ? value : Boolean(value);
      await exchange(profile, requestWriteSingleFrame(profile.peripheralNumber, 5, tag.address, valBool ? 0xff00 : 0x0000), 8);
    } else {
      const valNum = Number(value);
      const rawValue = (valNum - tag.offset) / tag.scale;
      const processedValue = tag.dataType === 'float32' || tag.dataType === 'float64' ? rawValue : Math.round(rawValue);
      const buffer = encodeRegisterValue(processedValue, tag.dataType);
      const uint16s = bufferToUInt16Array(buffer);
      if (uint16s.length === 1) await exchange(profile, requestWriteSingleFrame(profile.peripheralNumber, 6, tag.address, uint16s[0]), 8);
      else await exchange(profile, requestWriteMultipleRegistersFrame(profile.peripheralNumber, tag.address, uint16s), 8);
    }
    const completedAt = new Date();
    return { tagId: tag.id, tagName: tag.name, deviceId: device.id, deviceName: device.name, ok: true, value, writtenAt: completedAt.toISOString(), elapsedMs: completedAt.getTime() - startedAt.getTime(), message: `${driverName} value written through Modbus RTU tunnel successfully.`, endpoint };
  } catch (error) {
    const completedAt = new Date();
    const message = error instanceof Error ? error.message : String(error);
    return { tagId: tag.id, tagName: tag.name, deviceId: device.id, deviceName: device.name, ok: false, value, writtenAt: completedAt.toISOString(), elapsedMs: completedAt.getTime() - startedAt.getTime(), message: `${driverName} Modbus RTU tunnel write failed.`, error: message, endpoint };
  }
}
