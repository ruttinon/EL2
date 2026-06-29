import type { FastifyInstance } from 'fastify';
import { getPrismaClient, withSqliteRetry } from '../services/database.js';
import { appendEngineLog } from '../services/engineLogger.js';
import { parseXgmbFile, parseXgmbContent } from '../services/xgmbParser.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { getTemplatesDir, getLibraryTemplatesDir, getUserTemplatesDir } from '@energylink/shared-data';
import { inferTagEnergyRole, normalizeTagEnergyRole } from '@energylink/shared-types';


function isUnknownTemplateVendor(value?: string | null) {
  const v = String(value || '').trim().toLowerCase();
  return !v || v === 'unknown' || v === 'undefined' || v === 'null';
}


const KNOWN_METER_VENDORS = [
  'CIRCUTOR',
  'Socomec',
  'Janitza',
  'Schneider Electric',
  'ABB',
  'Siemens',
  'Carlo Gavazzi',
  'Lovato',
  'Eastron',
  'Acrel'
];

function normalizeVendorName(value?: string | null) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  return KNOWN_METER_VENDORS.find(v => v.toLowerCase() === raw.toLowerCase()) || raw;
}

function isLikelyMeterModelValue(value?: string | null) {
  const raw = String(value || '').trim();
  if (!raw) return false;
  const key = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (/^(CVM|CEM|CIRWATT|DHB|DHH|DHC|TR|EDMK|STM)/.test(key)) return true;
  if (/^(DIRIS|COUNTIS|PM|ION|PAC|SENTRON|EM|SDM|ACR)[A-Z0-9]+/.test(key)) return true;
  if (/\d/.test(raw) && /[-_]/.test(raw)) return true;
  return false;
}

function isValidVendorName(value?: string | null) {
  const raw = String(value || '').trim();
  if (isUnknownTemplateVendor(raw)) return false;
  if (isLikelyMeterModelValue(raw)) return false;
  return /^[A-Za-z][A-Za-z0-9 .&+/-]{1,40}$/.test(raw);
}

function inferMeterModelName(value?: string | null) {
  const raw = String(value || '').trim().replace(/\.(xgmb|json)$/i, '');
  if (!raw) return 'Imported Meter';
  const normalized = raw.replace(/[ _]+/g, '-').toUpperCase();
  const patterns = [
    /CVM-?B?100/,
    /CVM-?C11/,
    /CVM-?C4/,
    /CVM-?C5/,
    /CVM-?C10/,
    /CVM-?B150/,
    /CVM-?1D/,
    /CVM-?MINI/,
    /CEM-?[A-Z0-9-]+/,
    /CIRWATT-?[A-Z0-9-]+/,
    /DH[BH]-?[0-9A-Z-]+/,
    /DHC-?[0-9A-Z-]+/,
    /TR[0-9]+/,
    /EDMK/,
    /STM/
  ];
  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match?.[0]) return match[0].replace(/CVM-?B100/, 'CVMB100').replace(/CVM-?C11/, 'CVM-C11').replace(/CVM-?C4/, 'CVM-C4');
  }
  return raw;
}

function inferMeterVendorFromModel(model?: string | null) {
  const key = inferMeterModelName(model).toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (/^(CVM|CEM|CIRWATT|DHB|DHH|DHC|TR|EDMK|STM)/.test(key)) return 'CIRCUTOR';
  if (/^(DIRIS|COUNTIS)/.test(key)) return 'Socomec';
  if (/^A\d{1,2}$/.test(key)) return 'Socomec';
  if (/^(UMG|JANITZA)/.test(key)) return 'Janitza';
  if (/^(PM|ION|POWERLOGIC)/.test(key)) return 'Schneider Electric';
  if (/^(SENTRON|PAC)/.test(key)) return 'Siemens';
  if (/^(M2M|ABB)/.test(key)) return 'ABB';
  return 'Unknown';
}

function resolveTemplateVendor(config: any, folderVendor: string, modelName: string) {
  const fromConfig = normalizeVendorName(
    config.vendor || config.metadata?.vendor || config.metadata?.brand || ''
  );
  if (isValidVendorName(fromConfig)) return fromConfig;

  const folder = normalizeVendorName(folderVendor);
  if (isValidVendorName(folder) && !isUnknownTemplateVendor(folder)) return folder;

  const inferred = inferMeterVendorFromModel(modelName);
  if (!isUnknownTemplateVendor(inferred)) return inferred;

  return isUnknownTemplateVendor(folder) ? 'Other' : folder;
}

function buildTemplateConfig(category: string, vendor: string, name: string, config?: any) {
  const modelName = String(config?.model || config?.name || name).trim();
  return {
    maxRegisters: 120,
    littleEndianData: false,
    swapRegisterBytes: false,
    variables: [],
    ...(config || {}),
    name: modelName,
    model: modelName,
    category,
    vendor,
    metadata: {
      ...(config?.metadata || {}),
      category: 'meter',
      vendor,
      brand: vendor,
      model: modelName
    }
  };
}

type DeviceInput = {
  projectId?: string;
  parentDeviceId?: string | null;
  name?: string;
  description?: string | null;
  type?: 'converter' | 'meter' | 'sensor';
  protocol?: 'tcp' | 'udp' | 'modbus_tcp' | 'modbus_rtu' | 'cvm_c4' | 'cvm_c11' | 'xgmb_meter' | 'mqtt';
  ipAddress?: string | null;
  port?: number | null;
  serialPort?: string | null;
  baudRate?: number | null;
  dataBits?: number | null;
  stopBits?: number | null;
  parity?: string | null;
  littleEndianData?: boolean;
  swapRegisterBytes?: boolean;
  maxRegistersPerGroup?: number;
  peripheralNumber?: number | null;
  mqttUsername?: string | null;
  mqttPassword?: string | null;
  mqttClientId?: string | null;
  model?: string | null;
  location?: string | null;
  imageDataUrl?: string | null;
  model3dUrl?: string | null;
  energyMappingJson?: string | null;
  communicationEnabled?: boolean;
  historyEnabled?: boolean;
  visible?: boolean;
  pollingIntervalMs?: number;
  timeoutMs?: number;
  tags?: any[];
};

type TagInput = {
  projectId?: string;
  deviceId?: string;
  name?: string;
  description?: string | null;
  mqttTopic?: string | null;
  address?: number;
  registers?: number;
  functionCode?: number;
  functionWriteCode?: number;
  registerType?: 'coil' | 'discrete_input' | 'input_register' | 'holding_register';
  dataType?: 'bool' | 'int16' | 'uint16' | 'int32' | 'uint32' | 'float32' | 'float64';
  unit?: string | null;
  scale?: number;
  offset?: number;
  decimals?: number;
  decimalPlaces?: number;
  historyEnabled?: boolean;
  alarmHigh?: number | null;
  alarmLow?: number | null;
  energyTagRole?: string | null;
};

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function optionalText(value: unknown) {
  const text = cleanText(value);
  return text.length ? text : null;
}

function optionalImageDataUrl(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text.length ? text : null;
}

const MAX_DEVICE_IMAGE_DATA_URL_LENGTH = 750_000;
/** Data URL or asset:// reference for imported GLB/GLTF */
const MAX_DEVICE_MODEL3D_URL_LENGTH = 500_000;

function numberValue(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function optionalNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function registerLengthForDataType(dataType: unknown) {
  if (dataType === 'int32' || dataType === 'uint32' || dataType === 'float32') return 2;
  if (dataType === 'float64') return 4;
  return 1;
}

function normalizedRegisterCount(registers: unknown, dataType: unknown) {
  return Math.max(numberValue(registers, 1), registerLengthForDataType(dataType));
}

function scaleFromDecimals(decimals: unknown) {
  const parsed = Number(decimals);
  if (!Number.isInteger(parsed) || parsed <= 0) return 1;
  return 1 / Math.pow(10, Math.min(parsed, 12));
}

function normalizeDeviceProtocol(protocol: unknown, fallback: DeviceInput['protocol'] = 'modbus_tcp'): DeviceInput['protocol'] {
  const value = typeof protocol === 'string' ? protocol.trim() : '';
  if (value === 'tcp' || value === 'udp' || value === 'modbus_tcp' || value === 'modbus_rtu' || value === 'cvm_c4' || value === 'cvm_c11' || value === 'xgmb_meter' || value === 'mqtt') return value;
  return fallback;
}

async function prepareDeviceInput(input: DeviceInput, existingId?: string): Promise<DeviceInput> {
  const prisma = getPrismaClient();
  const existing = existingId ? await prisma.device.findUnique({ where: { id: existingId } }) : null;
  if (existingId && !existing) throw new Error(`Device not found: ${existingId}`);

  const type = (input.type ?? existing?.type ?? 'meter') as DeviceInput['type'];
  const parentDeviceId = input.parentDeviceId !== undefined ? input.parentDeviceId : (existing?.parentDeviceId ?? null);
  let protocol = normalizeDeviceProtocol(input.protocol ?? existing?.protocol ?? 'modbus_tcp');

  if ((type === 'meter' || type === 'sensor') && parentDeviceId) {
    const parent = await prisma.device.findUnique({ where: { id: parentDeviceId } });
    if (!parent || parent.type !== 'converter') throw new Error('Parent device must be a converter.');
  }

  if (type === 'converter') {
    return { ...input, type, parentDeviceId: null, protocol };
  }

  return { ...input, type, parentDeviceId, protocol };
}

async function assertProjectExists(projectId: string) {
  const prisma = getPrismaClient();
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new Error(`Project not found: ${projectId}`);
}

async function validateDeviceInput(input: DeviceInput, partial = false) {
  const errors: string[] = [];
  const prisma = getPrismaClient();
  const type = input.type;
  const protocol = input.protocol ?? 'modbus_tcp';

  if (!partial || input.projectId !== undefined) {
    if (!input.projectId) errors.push('Project is required.');
    else {
      const project = await prisma.project.findUnique({ where: { id: input.projectId } });
      if (!project) errors.push(`Project not found: ${input.projectId}`);
    }
  }

  if (!partial || input.name !== undefined) {
    const name = cleanText(input.name);
    if (!name) errors.push('Device name is required.');
    if (name.length > 120) errors.push('Device name must be 120 characters or less.');
  }

  if (!partial || input.type !== undefined) {
    if (!type || !['converter', 'meter', 'sensor'].includes(type)) errors.push('Device type must be converter, meter, or sensor.');
  }

  if (protocol && !['tcp', 'udp', 'modbus_tcp', 'modbus_rtu', 'cvm_c4', 'cvm_c11', 'xgmb_meter', 'mqtt'].includes(protocol)) errors.push('Unsupported protocol.');

  if (type === 'converter' && input.parentDeviceId) errors.push('Converter must not have a parent device.');
  if ((type === 'meter' || type === 'sensor') && !input.parentDeviceId) errors.push('Meter and sensor devices require a parent converter.');

  if (input.parentDeviceId) {
    const parent = await prisma.device.findUnique({ where: { id: input.parentDeviceId } });
    if (parent && parent.type !== 'converter') {
      errors.push('Parent device must be a converter.');
    }
  }

  if (protocol === 'tcp' || protocol === 'udp' || protocol === 'modbus_tcp') {
    if (type === 'converter') {
      if (!cleanText(input.ipAddress)) errors.push('Modbus TCP converter requires an IP address.');
    }
  }

  if (protocol === 'modbus_rtu') {
    if (type === 'converter') {
      if (!cleanText(input.serialPort)) errors.push('Modbus RTU converter requires a serial port.');
      const baudRate = optionalNumber(input.baudRate);
      if (baudRate == null || baudRate < 300) errors.push('Baud rate must be 300 or greater.');
      const dataBits = optionalNumber(input.dataBits);
      if (dataBits == null || ![5, 6, 7, 8].includes(dataBits)) errors.push('Data bits must be 5, 6, 7, or 8.');
      const stopBits = optionalNumber(input.stopBits);
      if (stopBits == null || ![1, 2].includes(stopBits)) errors.push('Stop bits must be 1 or 2.');
      const parity = cleanText(input.parity || 'none');
      if (!['none', 'even', 'odd'].includes(parity)) errors.push('Parity must be none, even, or odd.');
    }
  }

  if (protocol === 'mqtt') {
    if (type === 'converter') {
      if (!cleanText(input.ipAddress)) errors.push('MQTT broker requires a host/IP address.');
      const port = optionalNumber(input.port);
      if (port != null && (port < 1 || port > 65535)) errors.push('MQTT broker port must be between 1 and 65535.');
    }
  }

  if (protocol === 'modbus_tcp' || protocol === 'modbus_rtu' || protocol === 'cvm_c4' || protocol === 'cvm_c11' || protocol === 'xgmb_meter') {
    const peripheralNumber = optionalNumber(input.peripheralNumber);
    if (peripheralNumber == null) {
      errors.push('Peripheral number is required for Modbus devices.');
    } else if (peripheralNumber < 0 || peripheralNumber > 255) {
      errors.push('Peripheral number must be between 0 and 255.');
    }
  }

  if (input.imageDataUrl !== undefined && input.imageDataUrl !== null && String(input.imageDataUrl).length > MAX_DEVICE_IMAGE_DATA_URL_LENGTH) {
    errors.push('Device image is too large (max ~500KB).');
  }

  if (input.model3dUrl !== undefined && input.model3dUrl !== null) {
    const m3d = String(input.model3dUrl);
    if (m3d.startsWith('asset://')) {
      if (m3d.length > 120) errors.push('Invalid 3D asset reference.');
    } else if (m3d.length > MAX_DEVICE_MODEL3D_URL_LENGTH) {
      errors.push('3D model reference is too large — use Asset Library (asset://) for big GLB files.');
    }
  }

  return { valid: errors.length === 0, errors };
}

function deviceCreateData(input: DeviceInput) {
  const protocol = input.protocol ?? 'modbus_tcp';
  const type = input.type ?? 'meter';
  const peripheralNumber = optionalNumber(input.peripheralNumber);

  const data: any = {
    projectId: String(input.projectId),
    parentDeviceId: input.parentDeviceId ?? null,
    name: cleanText(input.name),
    description: optionalText(input.description),
    type,
    protocol,
    ipAddress: optionalText(input.ipAddress),
    port: optionalNumber(input.port),
    serialPort: optionalText(input.serialPort),
    baudRate: optionalNumber(input.baudRate) ?? 9600,
    dataBits: optionalNumber(input.dataBits) ?? 8,
    stopBits: optionalNumber(input.stopBits) ?? 1,
    parity: cleanText(input.parity) || 'none',
    littleEndianData: input.littleEndianData ?? false,
    swapRegisterBytes: input.swapRegisterBytes ?? false,
    maxRegistersPerGroup: optionalNumber(input.maxRegistersPerGroup) ?? 120,
    peripheralNumber,
    mqttUsername: optionalText(input.mqttUsername),
    mqttPassword: optionalText(input.mqttPassword),
    mqttClientId: optionalText(input.mqttClientId),
    model: optionalText(input.model),
    location: optionalText(input.location),
    imageDataUrl: optionalImageDataUrl(input.imageDataUrl),
    model3dUrl: optionalImageDataUrl(input.model3dUrl),
    energyMappingJson: optionalText(input.energyMappingJson),
    communicationEnabled: input.communicationEnabled ?? true,
    historyEnabled: input.historyEnabled ?? true,
    visible: input.visible ?? true,
    pollingIntervalMs: numberValue(input.pollingIntervalMs, 1000),
    timeoutMs: numberValue(input.timeoutMs, 2000)
  };

  if (input.tags && Array.isArray(input.tags)) {
    data.tags = {
      create: input.tags.map(t => {
        const dataType = t.dataType ?? 'float32';
        const decimalPlaces = numberValue(t.decimals ?? t.decimalPlaces, 2);
        const tagName = cleanText(t.name);
        const tagUnit = optionalText(t.unit);
        return {
          projectId: data.projectId,
          name: tagName,
          description: optionalText(t.description),
          address: numberValue(t.address, 0),
          registers: normalizedRegisterCount(t.registers, dataType),
          functionCode: numberValue(t.functionCode, 3),
          functionWriteCode: numberValue(t.functionWriteCode, 16),
          registerType: t.registerType ?? 'holding_register',
          dataType,
          unit: tagUnit,
          scale: numberValue(t.scale, scaleFromDecimals(t.decimals)),
          offset: numberValue(t.offset, 0),
          decimalPlaces,
          historyEnabled: t.historyEnabled ?? true,
          energyTagRole: normalizeTagEnergyRole(
            t.energyTagRole ?? inferTagEnergyRole(tagName, tagUnit),
          ),
        };
      })
    };
  }

  return data;
}

function deviceUpdateData(input: DeviceInput) {
  const data: Record<string, unknown> = {};
  const baseData = deviceCreateData(input);

  for (const [key, value] of Object.entries(baseData)) {
    if ((input as Record<string, unknown>)[key] !== undefined) {
      data[key] = value;
    }
  }

  // If tags are provided in update, we replace them (Prisma nested update)
  if (input.tags && Array.isArray(input.tags)) {
    data.tags = {
      deleteMany: {}, // Clear existing tags
      create: baseData.tags.create // Create new ones from template
    };
  }

  if (input.projectId === undefined) delete data.projectId;
  return data;
}

async function validateTagInput(input: TagInput, partial = false) {
  const errors: string[] = [];
  const prisma = getPrismaClient();

  if (!partial || input.projectId !== undefined) {
    if (!input.projectId) errors.push('Project is required.');
    else await assertProjectExists(input.projectId).catch(error => errors.push(error.message));
  }

  if (!partial || input.deviceId !== undefined) {
    if (!input.deviceId) errors.push('Device is required.');
    else {
      const device = await prisma.device.findUnique({ where: { id: input.deviceId } });
      if (!device) errors.push(`Device not found: ${input.deviceId}`);
    }
  }

  if (!partial || input.name !== undefined) {
    const name = cleanText(input.name);
    if (!name) errors.push('Tag name is required.');
    if (name.length > 120) errors.push('Tag name must be 120 characters or less.');
  }

  if (!partial || input.address !== undefined) {
    const device = input.deviceId
      ? await prisma.device.findUnique({ where: { id: input.deviceId } })
      : null;
    if (device?.protocol === 'mqtt') {
      const topic = cleanText(input.mqttTopic ?? input.description);
      if (!topic) errors.push('MQTT tag requires a topic.');
    } else {
      const address = optionalNumber(input.address);
      if (address == null || address < 0) errors.push('Tag address must be zero or greater.');
    }
  }

  if (input.registerType !== undefined && !['coil', 'discrete_input', 'input_register', 'holding_register'].includes(input.registerType)) errors.push('Register type is invalid.');
  if (input.dataType !== undefined && !['bool', 'int16', 'uint16', 'int32', 'uint32', 'float32', 'float64'].includes(input.dataType)) errors.push('Data type is invalid.');

  const low = optionalNumber(input.alarmLow);
  const high = optionalNumber(input.alarmHigh);
  if (low != null && high != null && low >= high) errors.push('Alarm low must be lower than alarm high.');

  return { valid: errors.length === 0, errors };
}

function tagCreateData(input: TagInput) {
  const dataType = input.dataType ?? 'float32';
  const decimalPlaces = numberValue(input.decimals ?? input.decimalPlaces, 2);
  return {
    projectId: String(input.projectId),
    deviceId: String(input.deviceId),
    name: cleanText(input.name),
    description: optionalText(input.description),
    mqttTopic: optionalText(input.mqttTopic),
    address: numberValue(input.address, 0),
    registers: normalizedRegisterCount(input.registers, dataType),
    functionCode: numberValue(input.functionCode, 3),
    functionWriteCode: numberValue(input.functionWriteCode, 16),
    registerType: input.registerType ?? 'holding_register',
    dataType,
    unit: optionalText(input.unit),
    scale: numberValue(input.scale, scaleFromDecimals(input.decimals)),
    offset: numberValue(input.offset, 0),
    decimalPlaces,
    historyEnabled: input.historyEnabled ?? true,
    alarmHigh: optionalNumber(input.alarmHigh),
    alarmLow: optionalNumber(input.alarmLow),
    energyTagRole:
      input.energyTagRole !== undefined
        ? normalizeTagEnergyRole(input.energyTagRole)
        : inferTagEnergyRole(cleanText(input.name), optionalText(input.unit))
  };
}

function tagUpdateData(input: TagInput) {
  const data: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(tagCreateData(input))) {
    if ((input as Record<string, unknown>)[key] !== undefined) data[key] = value;
  }
  if (input.projectId === undefined) delete data.projectId;
  if (input.deviceId === undefined) delete data.deviceId;
  return data;
}


async function collectDeviceTreeIds(prisma: any, rootId: string) {
  const ids: string[] = [];
  const queue = [rootId];
  const seen = new Set<string>();
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
    const children = await prisma.device.findMany({
      where: { parentDeviceId: id },
      select: { id: true }
    });
    for (const child of children) queue.push(child.id);
  }
  return ids;
}

async function deleteRowsByIdsInBatches(model: any, where: any, batchSize = 500) {
  let deleted = 0;
  while (true) {
    const rows = await model.findMany({ where, select: { id: true }, take: batchSize });
    if (!rows.length) break;
    const ids = rows.map((row: { id: string }) => row.id);
    const result = await model.deleteMany({ where: { id: { in: ids } } });
    deleted += result.count || ids.length;
    if (rows.length < batchSize) break;
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  return deleted;
}

async function safeDeleteDeviceTree(prisma: any, rootId: string) {
  const target = await prisma.device.findUnique({ where: { id: rootId }, select: { id: true, name: true } });
  if (!target) return null;

  const deviceIds = await collectDeviceTreeIds(prisma, rootId);
  const tags = await prisma.tag.findMany({ where: { deviceId: { in: deviceIds } }, select: { id: true } });
  const tagIds = tags.map((tag: { id: string }) => tag.id);

  const alarms = tagIds.length
    ? await prisma.alarm.findMany({ where: { OR: [{ deviceId: { in: deviceIds } }, { tagId: { in: tagIds } }] }, select: { id: true } })
    : await prisma.alarm.findMany({ where: { deviceId: { in: deviceIds } }, select: { id: true } });
  const alarmIds = alarms.map((alarm: { id: string }) => alarm.id);

  if (alarmIds.length) {
    await deleteRowsByIdsInBatches(prisma.alarmNotificationEvent, { alarmId: { in: alarmIds } });
  }
  if (tagIds.length) {
    await deleteRowsByIdsInBatches(prisma.historyValue, { tagId: { in: tagIds } });
  }
  await deleteRowsByIdsInBatches(prisma.historyValue, { deviceId: { in: deviceIds } });
  if (tagIds.length) {
    await deleteRowsByIdsInBatches(prisma.alarm, { tagId: { in: tagIds } });
  }
  await deleteRowsByIdsInBatches(prisma.alarm, { deviceId: { in: deviceIds } });
  await prisma.tag.deleteMany({ where: { deviceId: { in: deviceIds } } });

  for (const id of [...deviceIds].reverse()) {
    await prisma.device.delete({ where: { id } }).catch(async (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      if (!/Record to delete does not exist|not found/i.test(message)) throw error;
    });
  }

  return { id: rootId, name: target.name, deletedDeviceIds: deviceIds };
}

export async function registerEditorDataRoutes(app: FastifyInstance) {
  app.post('/api/devices', async (request, reply) => {
    const input = await prepareDeviceInput((request.body ?? {}) as DeviceInput);
    const validation = await validateDeviceInput(input);
    if (!validation.valid) {
      return reply.code(400).send({ message: 'Device validation failed.', errors: validation.errors });
    }
    const prisma = getPrismaClient();
    try {
      const data = deviceCreateData(input) as any;
      const device = await prisma.device.create({ data, include: { tags: true, parent: true, children: true } });
      appendEngineLog('info', 'Device created', { deviceId: device.id, name: device.name });
      return reply.code(201).send({ device });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return reply.code(400).send({ message: 'Failed to create device in database.', error: msg, details: error });
    }
  });

  app.put('/api/devices/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const input = await prepareDeviceInput((request.body ?? {}) as DeviceInput, id);
    const validation = await validateDeviceInput(input, true);
    if (!validation.valid) {
      return reply.code(400).send({ message: 'Device validation failed.', errors: validation.errors });
    }
    const prisma = getPrismaClient();
    try {
      const device = await withSqliteRetry(() =>
        prisma.device.update({ where: { id }, data: deviceUpdateData(input) as any, include: { tags: true, parent: true, children: true } })
      );
      appendEngineLog('info', 'Device updated', { deviceId: device.id, name: device.name });
      return { device };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/not found|Record to update not found/i.test(message)) {
        return reply.code(404).send({ message: 'Device not found.' });
      }
      if (/timed out|timeout|database is locked|SQLITE_BUSY|failed to respond/i.test(message)) {
        return reply.code(503).send({ message: 'Database is busy. Please try again in a moment.', error: message });
      }
      return reply.code(500).send({ message: 'Failed to update device.', error: message });
    }
  });

  app.delete('/api/devices/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const prisma = getPrismaClient();
    try {
      const deleted = await safeDeleteDeviceTree(prisma, id);
      if (!deleted) return reply.code(404).send({ message: 'Device not found.' });
      appendEngineLog('info', 'Device deleted', { deviceId: id, name: deleted.name, deletedDeviceIds: deleted.deletedDeviceIds });
      return { ok: true, deviceId: id, deletedDeviceIds: deleted.deletedDeviceIds };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return reply.code(500).send({ message: 'Failed to delete device.', error: message });
    }
  });

  app.post('/api/templates/import-xgmb', async (request, reply) => {
    try {
      const { filePath, fileContent, category, vendor, templateName, imageDataUrl, previewOnly } = request.body as {
        filePath?: string; fileContent?: string; category?: string; vendor?: string; templateName?: string; imageDataUrl?: string; previewOnly?: boolean;
      };

      let config: any;
      let fileName = templateName;

      if (fileContent) {
        config = parseXgmbContent(fileContent) as any;
      } else if (filePath) {
        config = await parseXgmbFile(filePath) as any;
        if (!fileName) fileName = path.basename(filePath, '.xgmb');
      } else {
        return reply.code(400).send({ message: 'filePath or fileContent is required' });
      }

      if (!fileName) fileName = 'imported_device';

      const cleanCategory = category || 'Power Meter';
      const cleanModel = inferMeterModelName(templateName || config.model || config.name || fileName);
      const rawVendor = normalizeVendorName(vendor || config.vendor || config.metadata?.vendor || config.metadata?.brand || '');
      const inferredVendor = inferMeterVendorFromModel(cleanModel);
      const cleanVendor = isValidVendorName(rawVendor)
        ? rawVendor
        : (isValidVendorName(inferredVendor) ? inferredVendor : 'Other');
      fileName = cleanModel;
      config.name = cleanModel;
      config.model = cleanModel;
      config.vendor = cleanVendor;
      config.category = cleanCategory;
      config.driverKey = 'xgmb_meter';
      config.imageDataUrl = imageDataUrl || config.imageDataUrl || '';
      config.metadata = {
        ...(config.metadata || {}),
        category: 'meter',
        vendor: cleanVendor,
        brand: cleanVendor,
        model: fileName,
        driverKey: 'xgmb_meter',
        source: 'xgmb_import',
        imageDataUrl: config.imageDataUrl
      };

      if (previewOnly) return { ok: true, fileName, config };

      const userDir = getUserTemplatesDir();
      const targetDir = path.join(userDir, cleanCategory, cleanVendor);
      await fs.mkdir(targetDir, { recursive: true });

      const targetPath = path.join(targetDir, `${fileName}.json`);
      await fs.writeFile(targetPath, JSON.stringify(config, null, 2));

      return { ok: true, fileName, config };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return reply.code(500).send({ message });
    }
  });

  app.get('/api/templates', async () => {
    const libraryDir = getLibraryTemplatesDir();
    const userDir = getUserTemplatesDir();

    // Auto-create directories if not exist
    await fs.mkdir(libraryDir, { recursive: true }).catch(() => { });
    await fs.mkdir(userDir, { recursive: true }).catch(() => { });

    async function scan(dir: string, type: 'library' | 'user') {
      const results: any[] = [];
      try {
        const categories = await fs.readdir(dir).catch(() => []);
        console.log(`[DEBUG] Scanning ${type} templates in ${dir}, found categories:`, categories);
        for (const cat of categories) {
          const catPath = path.join(dir, cat);
          if (!(await fs.stat(catPath)).isDirectory()) continue;

          const vendors = await fs.readdir(catPath);
          for (const ven of vendors) {
            const venPath = path.join(catPath, ven);
            if (!(await fs.stat(venPath)).isDirectory()) continue;

            const files = await fs.readdir(venPath);
            for (const file of files) {
              if (!file.endsWith('.json')) continue;
              let config: any = {};
              try {
                config = JSON.parse(await fs.readFile(path.join(venPath, file), 'utf-8'));
              } catch {
                config = {};
              }
              const modelName = config.model || config.name || path.basename(file, '.json');
              const resolvedVendor = resolveTemplateVendor(config, ven, modelName);
              results.push({
                id: `${type}:${cat}:${ven}:${file}`,
                name: modelName,
                model: modelName,
                category: config.category || cat,
                vendor: resolvedVendor,
                folderCategory: cat,
                folderVendor: ven,
                driverKey: config.driverKey || config.metadata?.driverKey || 'xgmb_meter',
                imageDataUrl: config.imageDataUrl || config.metadata?.imageDataUrl || '',
                metadata: config.metadata || {},
                type
              });
            }
          }
        }
      } catch (e) {
        console.error(`[ERROR] Failed to scan ${type} templates:`, e);
      }
      return results;
    }

    const [lib, user] = await Promise.all([
      scan(libraryDir, 'library'),
      scan(userDir, 'user')
    ]);

    console.log(`[DEBUG] Total templates found:`, lib.length + user.length);
    return { templates: [...lib, ...user] };
  });

  app.get('/api/templates/detail', async (request, reply) => {
    try {
      const { id } = request.query as { id: string };
      if (!id) return reply.code(400).send({ message: 'Template ID is required' });

      const [type, cat, ven, file] = id.split(':');
      const baseDir = type === 'library' ? getLibraryTemplatesDir() : getUserTemplatesDir();
      const filePath = path.join(baseDir, cat, ven, file);

      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      return reply.code(404).send({ message: 'Template not found' });
    }
  });

  app.post('/api/templates', async (request, reply) => {
    try {
      const { category, vendor, name, config } = request.body as { category: string; vendor: string; name: string; config: any };
      if (!name || !category || !vendor) return reply.code(400).send({ message: 'Name, Category, and Vendor are required' });
      if (isUnknownTemplateVendor(vendor)) {
        return reply.code(400).send({ message: 'Please enter a vendor/brand name (e.g. Socomec, CIRCUTOR).' });
      }

      const userDir = getUserTemplatesDir();
      const targetDir = path.join(userDir, category, vendor);
      await fs.mkdir(targetDir, { recursive: true });

      const targetPath = path.join(targetDir, `${name}.json`);
      await fs.writeFile(targetPath, JSON.stringify(buildTemplateConfig(category, vendor, name, config), null, 2));

      return { ok: true, name };
    } catch (error) {
      return reply.code(500).send({ message: String(error) });
    }
  });

  app.delete('/api/templates', async (request, reply) => {
    try {
      const { id } = request.query as { id: string };
      if (!id) return reply.code(400).send({ message: 'Template ID is required' });

      const [type, cat, ven, file] = id.split(':');
      const baseDir = type === 'library' ? getLibraryTemplatesDir() : getUserTemplatesDir();
      const filePath = path.join(baseDir, cat, ven, file);

      await fs.unlink(filePath);
      return { ok: true };
    } catch (error) {
      return reply.code(500).send({ message: String(error) });
    }
  });

  app.get('/api/editor/tags', async (request) => {
    const query = request.query as { projectId?: string; deviceId?: string };
    const prisma = getPrismaClient();
    const tags = await prisma.tag.findMany({
      where: {
        ...(query.projectId ? { projectId: query.projectId } : {}),
        ...(query.deviceId ? { deviceId: query.deviceId } : {})
      },
      include: { device: true },
      orderBy: [{ deviceId: 'asc' }, { name: 'asc' }]
    });

    return {
      tags: tags.map((tag) => ({
        id: tag.id,
        projectId: tag.projectId,
        deviceId: tag.deviceId,
        name: tag.name,
        description: tag.description,
        address: tag.address,
        registerType: tag.registerType,
        dataType: tag.dataType,
        unit: tag.unit,
        scale: tag.scale,
        offset: tag.offset,
        decimalPlaces: tag.decimalPlaces,
        historyEnabled: tag.historyEnabled,
        alarmHigh: tag.alarmHigh,
        alarmLow: tag.alarmLow,
        energyTagRole: tag.energyTagRole,
        currentValue: tag.currentValue,
        quality: tag.quality,
        lastValueAt: tag.lastValueAt,
        createdAt: tag.createdAt,
        updatedAt: tag.updatedAt,
        deviceName: tag.device?.name
      }))
    };
  });

  app.post('/api/tags', async (request, reply) => {
    const input = (request.body ?? {}) as TagInput;
    const validation = await validateTagInput(input);
    if (!validation.valid) return reply.code(400).send({ message: 'Tag validation failed.', errors: validation.errors });
    const prisma = getPrismaClient();
    try {
      const tag = await prisma.tag.create({ data: tagCreateData(input) as any, include: { device: true } });
      appendEngineLog('info', 'Tag created', { tagId: tag.id, name: tag.name, deviceId: tag.deviceId });
      return reply.code(201).send({ tag });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return reply.code(409).send({ message });
    }
  });

  app.put('/api/tags/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const input = (request.body ?? {}) as TagInput;
    const validation = await validateTagInput(input, true);
    if (!validation.valid) return reply.code(400).send({ message: 'Tag validation failed.', errors: validation.errors });
    const prisma = getPrismaClient();
    try {
      const tag = await prisma.tag.update({ where: { id }, data: tagUpdateData(input) as any, include: { device: true } });
      appendEngineLog('info', 'Tag updated', { tagId: tag.id, name: tag.name });
      return { tag };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return reply.code(404).send({ message });
    }
  });

  app.delete('/api/tags/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const prisma = getPrismaClient();
    try {
      const tag = await prisma.tag.delete({ where: { id } });
      appendEngineLog('info', 'Tag deleted', { tagId: id, name: tag.name });
      return { ok: true, tagId: id };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return reply.code(404).send({ message });
    }
  });
}
