import { PrismaClient } from '@prisma/client';
import type { CreateTagInput, TagDatabaseStatus, TagSummary, UpdateTagInput } from '@energylink/shared-types';
import { getDatabaseUrl } from '@energylink/shared-data';

let prisma: PrismaClient | null = null;

function getClient() {
  process.env.DATABASE_URL = getDatabaseUrl();
  prisma ??= new PrismaClient();
  return prisma;
}

function toTagSummary(tag: any): TagSummary {
  return {
    id: tag.id,
    projectId: tag.projectId,
    deviceId: tag.deviceId,
    name: tag.name,
    description: tag.description,
    address: Number(tag.address),
    registers: Number(tag.registers),
    functionCode: Number(tag.functionCode),
    functionWriteCode: Number(tag.functionWriteCode),
    registerType: tag.registerType,
    dataType: tag.dataType,
    unit: tag.unit,
    scale: Number(tag.scale),
    offset: Number(tag.offset),
    decimalPlaces: Number(tag.decimalPlaces),
    historyEnabled: Boolean(tag.historyEnabled),
    alarmHigh: tag.alarmHigh,
    alarmLow: tag.alarmLow,
    energyTagRole: tag.energyTagRole ?? 'none',
    currentValue: tag.currentValue,
    quality: tag.quality,
    lastValueAt: tag.lastValueAt ? (tag.lastValueAt instanceof Date ? tag.lastValueAt.toISOString() : String(tag.lastValueAt)) : null,
    createdAt: tag.createdAt instanceof Date ? tag.createdAt.toISOString() : String(tag.createdAt),
    updatedAt: tag.updatedAt instanceof Date ? tag.updatedAt.toISOString() : String(tag.updatedAt),
    deviceName: tag.device?.name
  };
}

async function getActiveProjectId(projectId?: string): Promise<string> {
  if (projectId) return projectId;
  const client = getClient();
  const active = await client.appSetting.findUnique({ where: { key: 'activeProjectId' } });
  if (active?.value) return active.value;
  const project = await client.project.findFirst({ orderBy: { updatedAt: 'desc' } });
  if (!project) throw new Error('No active project. Create or open a project from the File menu first.');
  await client.appSetting.upsert({ where: { key: 'activeProjectId' }, update: { value: project.id }, create: { key: 'activeProjectId', value: project.id } });
  return project.id;
}

function assertTagInput(input: CreateTagInput) {
  if (!input.deviceId) throw new Error('Select a device for the tag.');
  if (!input.name?.trim()) throw new Error('Tag Name is required.');
  if (!Number.isInteger(input.address) || input.address <= 0) throw new Error('Address must be an integer greater than 0.');
  if (input.decimalPlaces !== undefined && (input.decimalPlaces < 0 || input.decimalPlaces > 8)) throw new Error('Decimal Places must be between 0 and 8.');
  if (input.alarmHigh !== undefined && input.alarmLow !== undefined && input.alarmHigh !== null && input.alarmLow !== null && input.alarmLow >= input.alarmHigh) {
    throw new Error('Alarm Low must be less than Alarm High.');
  }
}

export async function listTags(projectId?: string): Promise<TagSummary[]> {
  const client = getClient();
  const activeProjectId = await getActiveProjectId(projectId);
  const tags = await client.tag.findMany({
    where: { projectId: activeProjectId },
    include: { device: true },
    orderBy: [{ deviceId: 'asc' }, { name: 'asc' }]
  });
  return tags.map(toTagSummary);
}

export async function listTagsByDevice(deviceId: string): Promise<TagSummary[]> {
  const client = getClient();
  const tags = await client.tag.findMany({
    where: { deviceId },
    include: { device: true },
    orderBy: { name: 'asc' }
  });
  return tags.map(toTagSummary);
}

export async function createTag(input: CreateTagInput): Promise<TagSummary> {
  assertTagInput(input);
  const client = getClient();
  const activeProjectId = await getActiveProjectId(input.projectId);
  const device = await client.device.findFirst({ where: { id: input.deviceId, projectId: activeProjectId } });
  if (!device) throw new Error('Device was not found in the current project.');

  const tag = await client.tag.create({
    data: {
      projectId: activeProjectId,
      deviceId: input.deviceId,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      address: input.address,
      registers: input.registers ?? 1,
      functionCode: input.functionCode ?? 3,
      functionWriteCode: input.functionWriteCode ?? 16,
      registerType: input.registerType || 'holding_register',
      dataType: input.dataType || 'float32',
      unit: input.unit?.trim() || null,
      scale: input.scale ?? 1,
      offset: input.offset ?? 0,
      decimalPlaces: input.decimalPlaces ?? 2,
      historyEnabled: input.historyEnabled ?? true,
      alarmHigh: input.alarmHigh ?? null,
      alarmLow: input.alarmLow ?? null,
      energyTagRole: input.energyTagRole?.trim() || 'none',
      quality: 'unknown',
      currentValue: null,
      lastValueAt: null
    },
    include: { device: true }
  });
  return toTagSummary(tag);
}

export async function updateTag(input: UpdateTagInput): Promise<TagSummary> {
  const client = getClient();
  const { id, projectId: _projectId, ...rest } = input;
  const data: any = { ...rest };
  if ('name' in data && typeof data.name === 'string') data.name = data.name.trim();
  if ('description' in data && typeof data.description === 'string') data.description = data.description.trim() || null;
  if ('unit' in data && typeof data.unit === 'string') data.unit = data.unit.trim() || null;
  if ('alarmHigh' in data && data.alarmHigh === undefined) delete data.alarmHigh;
  if ('alarmLow' in data && data.alarmLow === undefined) delete data.alarmLow;
  const tag = await client.tag.update({ where: { id }, data, include: { device: true } });
  return toTagSummary(tag);
}

export async function deleteTag(id: string): Promise<boolean> {
  const client = getClient();
  await client.tag.delete({ where: { id } });
  return true;
}

export async function getTagDatabaseStatus(projectId?: string): Promise<TagDatabaseStatus> {
  const client = getClient();
  const activeProjectId = await getActiveProjectId(projectId);
  const [tagCount, historyEnabledCount, alarmConfiguredCount] = await Promise.all([
    client.tag.count({ where: { projectId: activeProjectId } }),
    client.tag.count({ where: { projectId: activeProjectId, historyEnabled: true } }),
    client.tag.count({ where: { projectId: activeProjectId, OR: [{ alarmHigh: { not: null } }, { alarmLow: { not: null } }] } })
  ]);
  return { activeProjectId, tagCount, historyEnabledCount, alarmConfiguredCount };
}

export async function disconnectTagStore() {
  if (prisma) await prisma.$disconnect();
  prisma = null;
}
