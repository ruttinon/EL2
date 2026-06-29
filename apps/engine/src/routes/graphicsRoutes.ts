import type { FastifyInstance } from 'fastify';
import type { GraphicLayout } from '@energylink/shared-types';
import { normalizeGraphicLayout } from '@energylink/shared-types';
import { getPrismaClient } from '../services/database.js';
import { appendEngineLog } from '../services/engineLogger.js';

const MAX_REVISIONS = 30;

async function pushLayoutRevision(
  prisma: ReturnType<typeof getPrismaClient>,
  graphicId: string,
  layoutJson: string,
  width: number,
  height: number,
  refreshIntervalMs: number,
  label?: string,
) {
  let objectCount = 0;
  try {
    const parsed = JSON.parse(layoutJson) as { objects?: unknown[] };
    objectCount = Array.isArray(parsed.objects) ? parsed.objects.length : 0;
  } catch {
    objectCount = 0;
  }
  await prisma.graphicLayoutRevision.create({
    data: {
      graphicId,
      label: label ?? `Save ${new Date().toISOString()}`,
      layoutJson,
      width,
      height,
      refreshIntervalMs,
      objectCount,
    },
  });
  const excess = await prisma.graphicLayoutRevision.findMany({
    where: { graphicId },
    orderBy: { createdAt: 'desc' },
    skip: MAX_REVISIONS,
    select: { id: true },
  });
  if (excess.length > 0) {
    await prisma.graphicLayoutRevision.deleteMany({ where: { id: { in: excess.map((r) => r.id) } } });
  }
}

type GraphicInput = {
  projectId?: string;
  name?: string;
  description?: string | null;
  width?: number;
  height?: number;
  refreshIntervalMs?: number;
  isDefault?: boolean;
  layout?: unknown;
  layoutJson?: string;
};

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function optionalText(value: unknown) {
  const text = cleanText(value);
  return text.length ? text : null;
}

function numberValue(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function layoutString(input: GraphicInput) {
  if (typeof input.layoutJson === 'string') return input.layoutJson;
  if (input.layout !== undefined) return JSON.stringify(input.layout);
  return '{"version":1,"backgroundColor":"#fbfdff","objects":[]}';
}

function validateGraphicInput(input: GraphicInput, partial = false) {
  const errors: string[] = [];
  if (!partial || input.projectId !== undefined) {
    if (!cleanText(input.projectId)) errors.push('Project is required.');
  }
  if (!partial || input.name !== undefined) {
    const name = cleanText(input.name);
    if (!name) errors.push('Graphic name is required.');
    if (name.length > 120) errors.push('Graphic name must be 120 characters or less.');
  }
  if (input.width !== undefined && numberValue(input.width, 0) < 320) errors.push('Graphic width must be at least 320.');
  if (input.height !== undefined && numberValue(input.height, 0) < 240) errors.push('Graphic height must be at least 240.');
  if (input.refreshIntervalMs !== undefined && numberValue(input.refreshIntervalMs, 0) < 250) errors.push('Refresh interval must be at least 250 ms.');
  if (input.layoutJson !== undefined) {
    try { JSON.parse(input.layoutJson); } catch { errors.push('Graphic layoutJson must be valid JSON.'); }
  }
  return { valid: errors.length === 0, errors };
}

function graphicCreateData(input: GraphicInput) {
  return {
    projectId: cleanText(input.projectId),
    name: cleanText(input.name),
    description: optionalText(input.description),
    width: numberValue(input.width, 1366),
    height: numberValue(input.height, 768),
    refreshIntervalMs: numberValue(input.refreshIntervalMs, 1000),
    isDefault: Boolean(input.isDefault),
    layoutJson: layoutString(input)
  };
}

function graphicUpdateData(input: GraphicInput) {
  const data: Record<string, unknown> = {};
  if (input.projectId !== undefined) data.projectId = cleanText(input.projectId);
  if (input.name !== undefined) data.name = cleanText(input.name);
  if (input.description !== undefined) data.description = optionalText(input.description);
  if (input.width !== undefined) data.width = numberValue(input.width, 1366);
  if (input.height !== undefined) data.height = numberValue(input.height, 768);
  if (input.refreshIntervalMs !== undefined) data.refreshIntervalMs = numberValue(input.refreshIntervalMs, 1000);
  if (input.isDefault !== undefined) data.isDefault = Boolean(input.isDefault);
  if (input.layout !== undefined || input.layoutJson !== undefined) data.layoutJson = layoutString(input);
  return data;
}


function parseLayout(layoutJson: string | null | undefined): GraphicLayout {
  if (!layoutJson) return normalizeGraphicLayout({ version: 1, backgroundColor: '#fbfdff', objects: [] });
  try {
    const parsed = JSON.parse(layoutJson) as GraphicLayout;
    if (!parsed || typeof parsed !== 'object') {
      return normalizeGraphicLayout({ version: 1, backgroundColor: '#fbfdff', objects: [] });
    }
    return normalizeGraphicLayout(parsed);
  } catch {
    return normalizeGraphicLayout({ version: 1, backgroundColor: '#fff5f5', objects: [] });
  }
}

export async function registerGraphicsRoutes(app: FastifyInstance) {
  app.get('/api/graphics', async () => {
    const prisma = getPrismaClient();
    const graphics = await prisma.graphic.findMany({
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }]
    });

    return {
      graphics: graphics.map((graphic) => ({
        id: graphic.id,
        projectId: graphic.projectId,
        name: graphic.name,
        description: graphic.description,
        width: graphic.width,
        height: graphic.height,
        refreshIntervalMs: graphic.refreshIntervalMs,
        isDefault: graphic.isDefault,
        layout: parseLayout(graphic.layoutJson),
        updatedAt: graphic.updatedAt
      }))
    };
  });

  app.get('/api/graphics/default', async (_, reply) => {
    const prisma = getPrismaClient();
    const graphic = await prisma.graphic.findFirst({
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }]
    });

    if (!graphic) {
      reply.code(404);
      return { message: 'No graphic has been created in the database.' };
    }

    appendEngineLog('info', 'Graphic runtime layout requested', { graphicId: graphic.id, name: graphic.name });

    return {
      graphic: {
        id: graphic.id,
        projectId: graphic.projectId,
        name: graphic.name,
        description: graphic.description,
        width: graphic.width,
        height: graphic.height,
        refreshIntervalMs: graphic.refreshIntervalMs,
        isDefault: graphic.isDefault,
        layout: parseLayout(graphic.layoutJson),
        updatedAt: graphic.updatedAt
      },
      runtime: {
        currentValues: 'available_via_/api/tags/current',
        polling: 'available',
        runtimeSource: 'not_present',
        note: 'Phase 12 renders saved layout, real current values, and active alarm indicators when tags have been read by the Engine.'
      }
    };
  });


  app.post('/api/graphics', async (request, reply) => {
    const input = (request.body ?? {}) as GraphicInput;
    const validation = validateGraphicInput(input);
    if (!validation.valid) return reply.code(400).send({ message: 'Graphic validation failed.', errors: validation.errors });
    const prisma = getPrismaClient();
    try {
      const data = graphicCreateData(input);
      if (data.isDefault) await prisma.graphic.updateMany({ where: { projectId: data.projectId }, data: { isDefault: false } });
      const graphic = await prisma.graphic.create({ data: data as any });
      appendEngineLog('info', 'Graphic created', { graphicId: graphic.id, name: graphic.name });
      return reply.code(201).send({ graphic: { ...graphic, layout: parseLayout(graphic.layoutJson) } });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return reply.code(409).send({ message });
    }
  });

  app.put('/api/graphics/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const input = (request.body ?? {}) as GraphicInput;
    const validation = validateGraphicInput(input, true);
    if (!validation.valid) return reply.code(400).send({ message: 'Graphic validation failed.', errors: validation.errors });
    const prisma = getPrismaClient();
    try {
      const existing = await prisma.graphic.findUnique({ where: { id } });
      if (!existing) return reply.code(404).send({ message: `Graphic not found: ${id}` });
      const data = graphicUpdateData(input);
      if (data.isDefault === true) await prisma.graphic.updateMany({ where: { projectId: existing.projectId }, data: { isDefault: false } });
      const graphic = await prisma.graphic.update({ where: { id }, data: data as any });
      if (data.layoutJson) {
        await pushLayoutRevision(
          prisma,
          graphic.id,
          String(data.layoutJson),
          graphic.width,
          graphic.height,
          graphic.refreshIntervalMs,
          `Save ${graphic.name}`,
        );
      }
      appendEngineLog('info', 'Graphic updated', { graphicId: graphic.id, name: graphic.name });
      return { graphic: { ...graphic, layout: parseLayout(graphic.layoutJson) } };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return reply.code(409).send({ message });
    }
  });

  app.post('/api/graphics/:id/set-default', async (request, reply) => {
    const { id } = request.params as { id: string };
    const prisma = getPrismaClient();
    const existing = await prisma.graphic.findUnique({ where: { id } });
    if (!existing) return reply.code(404).send({ message: `Graphic not found: ${id}` });
    await prisma.graphic.updateMany({ where: { projectId: existing.projectId }, data: { isDefault: false } });
    const graphic = await prisma.graphic.update({ where: { id }, data: { isDefault: true } });
    appendEngineLog('info', 'Default graphic selected', { graphicId: graphic.id, name: graphic.name });
    return { graphic };
  });

  app.delete('/api/graphics/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const prisma = getPrismaClient();
    try {
      const graphic = await prisma.graphic.delete({ where: { id } });
      appendEngineLog('info', 'Graphic deleted', { graphicId: id, name: graphic.name });
      return { ok: true, graphicId: id };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return reply.code(404).send({ message });
    }
  });

  app.get('/api/graphics/:id', async (request, reply) => {
    const params = request.params as { id: string };
    const prisma = getPrismaClient();
    const graphic = await prisma.graphic.findUnique({ where: { id: params.id } });

    if (!graphic) {
      reply.code(404);
      return { message: `Graphic not found: ${params.id}` };
    }

    appendEngineLog('info', 'Graphic runtime layout requested', { graphicId: graphic.id, name: graphic.name });

    return {
      graphic: {
        id: graphic.id,
        projectId: graphic.projectId,
        name: graphic.name,
        description: graphic.description,
        width: graphic.width,
        height: graphic.height,
        refreshIntervalMs: graphic.refreshIntervalMs,
        isDefault: graphic.isDefault,
        layout: parseLayout(graphic.layoutJson),
        updatedAt: graphic.updatedAt
      },
      runtime: {
        currentValues: 'available_via_/api/tags/current',
        polling: 'available',
        runtimeSource: 'not_present',
        note: 'Phase 12 renders saved layout, real current values, and active alarm indicators when tags have been read by the Engine.'
      }
    };
  });

  app.get('/api/graphics/:id/history', async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const prisma = getPrismaClient();
      const graphic = await prisma.graphic.findUnique({ where: { id } });
      if (!graphic) return reply.code(404).send({ message: `Graphic not found: ${id}` });
      const revisions = await prisma.graphicLayoutRevision.findMany({
        where: { graphicId: id },
        orderBy: { createdAt: 'desc' },
        take: MAX_REVISIONS,
      });
      return {
        revisions: revisions.map((r) => ({
          id: r.id,
          savedAt: r.createdAt.toISOString(),
          label: r.label,
          objectCount: r.objectCount,
          width: r.width,
          height: r.height,
          refreshIntervalMs: r.refreshIntervalMs,
          layout: parseLayout(r.layoutJson),
        })),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      appendEngineLog('error', 'Graphic history list failed', { graphicId: id, message });
      return reply.code(500).send({ message: `Graphic history failed: ${message}`, revisions: [] });
    }
  });

  app.post('/api/graphics/:id/history/:revisionId/restore', async (request, reply) => {
    const { id, revisionId } = request.params as { id: string; revisionId: string };
    const prisma = getPrismaClient();
    const revision = await prisma.graphicLayoutRevision.findFirst({ where: { id: revisionId, graphicId: id } });
    if (!revision) return reply.code(404).send({ message: 'Revision not found.' });
    const layout = parseLayout(revision.layoutJson);
    const layoutJson = JSON.stringify(layout);
    const graphic = await prisma.graphic.update({
      where: { id },
      data: {
        layoutJson,
        width: revision.width,
        height: revision.height,
        refreshIntervalMs: revision.refreshIntervalMs,
      },
    });
    await pushLayoutRevision(prisma, id, layoutJson, revision.width, revision.height, revision.refreshIntervalMs, `Restored: ${revision.label}`);
    return { graphic: { ...graphic, layout: parseLayout(graphic.layoutJson) } };
  });

  app.delete('/api/graphics/:id/history/:revisionId', async (request, reply) => {
    const { id, revisionId } = request.params as { id: string; revisionId: string };
    const prisma = getPrismaClient();
    const revision = await prisma.graphicLayoutRevision.findFirst({ where: { id: revisionId, graphicId: id } });
    if (!revision) return reply.code(404).send({ message: 'Revision not found.' });
    await prisma.graphicLayoutRevision.delete({ where: { id: revisionId } });
    const revisions = await prisma.graphicLayoutRevision.findMany({
      where: { graphicId: id },
      orderBy: { createdAt: 'desc' },
      take: MAX_REVISIONS,
    });
    return {
      revisions: revisions.map((r) => ({
        id: r.id,
        savedAt: r.createdAt.toISOString(),
        label: r.label,
        objectCount: r.objectCount,
        width: r.width,
        height: r.height,
        refreshIntervalMs: r.refreshIntervalMs,
        layout: parseLayout(r.layoutJson),
      })),
    };
  });
}
