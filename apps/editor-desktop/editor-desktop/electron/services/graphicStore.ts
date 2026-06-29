import { PrismaClient } from '@prisma/client';
import type { CreateGraphicInput, GraphicDatabaseStatus, GraphicLayout, GraphicSummary, UpdateGraphicInput } from '@energylink/shared-types';
import { getDatabaseUrl } from '@energylink/shared-data';

let prisma: PrismaClient | null = null;

const emptyLayout = (): GraphicLayout => ({ version: 1, backgroundColor: '#fbfdff', objects: [] });

function getClient() {
  process.env.DATABASE_URL = getDatabaseUrl();
  prisma ??= new PrismaClient();
  return prisma;
}

function parseLayout(layoutJson: string | null | undefined): GraphicLayout {
  if (!layoutJson) return emptyLayout();
  try {
    const parsed = JSON.parse(layoutJson) as GraphicLayout;
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.objects)) return emptyLayout();
    return {
      version: 1,
      backgroundColor: parsed.backgroundColor || '#fbfdff',
      backgroundImage: parsed.backgroundImage || null,
      objects: parsed.objects.map((obj, index) => ({
        ...obj,
        id: obj.id || `object_${index + 1}`,
        name: obj.name || `${obj.type || 'object'}_${index + 1}`,
        x: Number.isFinite(obj.x) ? obj.x : 40,
        y: Number.isFinite(obj.y) ? obj.y : 40,
        width: Number.isFinite(obj.width) ? obj.width : 120,
        height: Number.isFinite(obj.height) ? obj.height : 60,
        visible: obj.visible ?? true,
        locked: obj.locked ?? false,
        layer: obj.layer ?? index
      }))
    };
  } catch {
    return emptyLayout();
  }
}

function serializeLayout(layout?: GraphicLayout): string {
  const cleanLayout = layout || emptyLayout();
  if (cleanLayout.version !== 1) throw new Error('Graphic layout version must be 1');
  if (!Array.isArray(cleanLayout.objects)) throw new Error('Graphic layout objects must be an array');
  return JSON.stringify({
    version: 1,
    backgroundColor: cleanLayout.backgroundColor || '#fbfdff',
    backgroundImage: cleanLayout.backgroundImage || null,
    objects: cleanLayout.objects.map((obj, index) => ({
      ...obj,
      id: obj.id,
      type: obj.type,
      name: obj.name,
      x: Math.round(Number(obj.x) || 0),
      y: Math.round(Number(obj.y) || 0),
      width: Math.max(1, Math.round(Number(obj.width) || 1)),
      height: Math.max(1, Math.round(Number(obj.height) || 1)),
      visible: obj.visible ?? true,
      locked: obj.locked ?? false,
      layer: obj.layer ?? index
    }))
  });
}

function toGraphicSummary(graphic: any): GraphicSummary {
  return {
    id: graphic.id,
    projectId: graphic.projectId,
    name: graphic.name,
    description: graphic.description,
    width: Number(graphic.width),
    height: Number(graphic.height),
    refreshIntervalMs: Number(graphic.refreshIntervalMs),
    isDefault: Boolean(graphic.isDefault),
    layout: parseLayout(graphic.layoutJson),
    createdAt: graphic.createdAt instanceof Date ? graphic.createdAt.toISOString() : String(graphic.createdAt),
    updatedAt: graphic.updatedAt instanceof Date ? graphic.updatedAt.toISOString() : String(graphic.updatedAt)
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

function assertGraphicInput(input: CreateGraphicInput) {
  if (!input.name?.trim()) throw new Error('Graphic Name is required.');
  if (input.width !== undefined && input.width < 320) throw new Error('Graphic Width must be at least 320.');
  if (input.height !== undefined && input.height < 240) throw new Error('Graphic Height must be at least 240.');
  if (input.refreshIntervalMs !== undefined && input.refreshIntervalMs < 250) throw new Error('Refresh Interval must be at least 250 ms.');
}

async function clearOtherDefaults(projectId: string) {
  const client = getClient();
  await client.graphic.updateMany({ where: { projectId }, data: { isDefault: false } });
}

export async function listGraphics(projectId?: string): Promise<GraphicSummary[]> {
  const client = getClient();
  const activeProjectId = await getActiveProjectId(projectId);
  const graphics = await client.graphic.findMany({ where: { projectId: activeProjectId }, orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }] });
  return graphics.map(toGraphicSummary);
}

export async function getGraphic(id: string): Promise<GraphicSummary | null> {
  const client = getClient();
  const graphic = await client.graphic.findUnique({ where: { id } });
  return graphic ? toGraphicSummary(graphic) : null;
}

export async function createGraphic(input: CreateGraphicInput): Promise<GraphicSummary> {
  assertGraphicInput(input);
  const client = getClient();
  const activeProjectId = await getActiveProjectId(input.projectId);
  if (input.isDefault) await clearOtherDefaults(activeProjectId);
  const graphic = await client.graphic.create({
    data: {
      projectId: activeProjectId,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      width: input.width ?? 1366,
      height: input.height ?? 768,
      refreshIntervalMs: input.refreshIntervalMs ?? 1000,
      isDefault: input.isDefault ?? false,
      layoutJson: serializeLayout(input.layout || emptyLayout())
    }
  });
  return toGraphicSummary(graphic);
}

export async function updateGraphic(input: UpdateGraphicInput): Promise<GraphicSummary> {
  const client = getClient();
  const existing = await client.graphic.findUnique({ where: { id: input.id } });
  if (!existing) throw new Error('The graphic to edit was not found.');
  const data: any = {};
  if (input.name !== undefined) {
    if (!input.name.trim()) throw new Error('Graphic Name is required.');
    data.name = input.name.trim();
  }
  if (input.description !== undefined) data.description = input.description?.trim() || null;
  if (input.width !== undefined) {
    if (input.width < 320) throw new Error('Graphic Width must be at least 320.');
    data.width = input.width;
  }
  if (input.height !== undefined) {
    if (input.height < 240) throw new Error('Graphic Height must be at least 240.');
    data.height = input.height;
  }
  if (input.refreshIntervalMs !== undefined) {
    if (input.refreshIntervalMs < 250) throw new Error('Refresh Interval must be at least 250 ms.');
    data.refreshIntervalMs = input.refreshIntervalMs;
  }
  if (input.layout !== undefined) data.layoutJson = serializeLayout(input.layout);
  if (input.isDefault !== undefined) {
    data.isDefault = input.isDefault;
    if (input.isDefault) await clearOtherDefaults(existing.projectId);
  }
  const graphic = await client.graphic.update({ where: { id: input.id }, data });
  return toGraphicSummary(graphic);
}

export async function deleteGraphic(id: string): Promise<boolean> {
  const client = getClient();
  await client.graphic.delete({ where: { id } });
  return true;
}

export async function getGraphicDatabaseStatus(projectId?: string): Promise<GraphicDatabaseStatus> {
  const client = getClient();
  const activeProjectId = await getActiveProjectId(projectId);
  const graphics = await client.graphic.findMany({ where: { projectId: activeProjectId } });
  const defaultGraphic = graphics.find((g: any) => g.isDefault);
  const objectCount = graphics.reduce((sum: number, graphic: any) => sum + parseLayout(graphic.layoutJson).objects.length, 0);
  return { activeProjectId, graphicCount: graphics.length, objectCount, defaultGraphicId: defaultGraphic?.id || null };
}

export async function disconnectGraphicStore() {
  if (prisma) await prisma.$disconnect();
  prisma = null;
}
