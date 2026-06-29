import type { FastifyInstance } from 'fastify';
import { getPrismaClient } from '../services/database.js';
import { appendEngineLog } from '../services/engineLogger.js';

type ProjectInput = {
  name?: string;
  customerName?: string | null;
  location?: string | null;
  timezone?: string;
  currency?: string;
  energyCostRate?: number;
  facilityType?: string;
  emissionFactorKgPerKwh?: number;
  netMetering?: boolean;
  floorAreaM2?: number | null;
  status?: 'draft' | 'active' | 'archived';
};

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function optionalText(value: unknown) {
  const text = cleanText(value);
  return text.length ? text : null;
}

function numberOrDefault(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function validateProjectInput(input: ProjectInput, partial = false) {
  const errors: string[] = [];
  const name = cleanText(input.name);
  if (!partial || input.name !== undefined) {
    if (!name) errors.push('Project name is required.');
    if (name.length > 120) errors.push('Project name must be 120 characters or less.');
  }

  if (input.energyCostRate !== undefined && (!Number.isFinite(Number(input.energyCostRate)) || Number(input.energyCostRate) < 0)) {
    errors.push('Energy cost rate must be a number greater than or equal to zero.');
  }

  if (
    input.emissionFactorKgPerKwh !== undefined &&
    (!Number.isFinite(Number(input.emissionFactorKgPerKwh)) || Number(input.emissionFactorKgPerKwh) < 0)
  ) {
    errors.push('Emission factor must be a number greater than or equal to zero.');
  }

  if (input.floorAreaM2 !== undefined && input.floorAreaM2 !== null) {
    const area = Number(input.floorAreaM2);
    if (!Number.isFinite(area) || area < 0) errors.push('Floor area must be zero or a positive number.');
  }

  if (input.status !== undefined && !['draft', 'active', 'archived'].includes(String(input.status))) {
    errors.push('Project status must be draft, active, or archived.');
  }

  return { valid: errors.length === 0, errors };
}

function optionalNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function projectPayload(input: ProjectInput) {
  return {
    name: cleanText(input.name),
    customerName: optionalText(input.customerName),
    location: optionalText(input.location),
    timezone: cleanText(input.timezone) || 'Asia/Bangkok',
    currency: cleanText(input.currency) || 'THB',
    energyCostRate: numberOrDefault(input.energyCostRate, 0),
    facilityType: cleanText(input.facilityType) || 'mixed',
    emissionFactorKgPerKwh: numberOrDefault(input.emissionFactorKgPerKwh, 0.45),
    netMetering: Boolean(input.netMetering),
    floorAreaM2: optionalNumber(input.floorAreaM2),
    status: input.status ?? 'draft'
  };
}

function projectUpdatePayload(input: ProjectInput) {
  const data: Record<string, unknown> = {};
  if (input.name !== undefined) data.name = cleanText(input.name);
  if (input.customerName !== undefined) data.customerName = optionalText(input.customerName);
  if (input.location !== undefined) data.location = optionalText(input.location);
  if (input.timezone !== undefined) data.timezone = cleanText(input.timezone) || 'Asia/Bangkok';
  if (input.currency !== undefined) data.currency = cleanText(input.currency) || 'THB';
  if (input.energyCostRate !== undefined) data.energyCostRate = numberOrDefault(input.energyCostRate, 0);
  if (input.facilityType !== undefined) data.facilityType = cleanText(input.facilityType) || 'mixed';
  if (input.emissionFactorKgPerKwh !== undefined) {
    data.emissionFactorKgPerKwh = numberOrDefault(input.emissionFactorKgPerKwh, 0.45);
  }
  if (input.netMetering !== undefined) data.netMetering = Boolean(input.netMetering);
  if (input.floorAreaM2 !== undefined) data.floorAreaM2 = optionalNumber(input.floorAreaM2);
  if (input.status !== undefined) data.status = input.status;
  return data;
}

function serializeProject(project: any) {
  return {
    id: project.id,
    name: project.name,
    customerName: project.customerName,
    location: project.location,
    timezone: project.timezone,
    currency: project.currency,
    energyCostRate: project.energyCostRate,
    facilityType: project.facilityType,
    emissionFactorKgPerKwh: project.emissionFactorKgPerKwh,
    netMetering: project.netMetering,
    floorAreaM2: project.floorAreaM2,
    status: project.status,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    counts: project._count
  };
}

export async function registerProjectRoutes(app: FastifyInstance) {
  app.get('/api/projects', async () => {
    const prisma = getPrismaClient();
    const projects = await prisma.project.findMany({
      orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
      include: {
        _count: {
          select: {
            devices: true,
            tags: true,
            graphics: true,
            reports: true,
            alarms: true,
            historyValues: true
          }
        }
      }
    });
    return { projects: projects.map(serializeProject) };
  });

  app.get('/api/projects/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const prisma = getPrismaClient();
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        devices: { include: { tags: true, children: true, parent: true }, orderBy: [{ type: 'asc' }, { name: 'asc' }] },
        graphics: { orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }] },
        reports: { orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }] },
        _count: { select: { devices: true, tags: true, graphics: true, reports: true, alarms: true, historyValues: true } }
      }
    });
    if (!project) return reply.code(404).send({ message: `Project not found: ${id}` });
    return { project };
  });

  app.post('/api/projects', async (request, reply) => {
    const input = (request.body ?? {}) as ProjectInput;
    const validation = validateProjectInput(input);
    if (!validation.valid) return reply.code(400).send({ message: 'Project validation failed.', errors: validation.errors });

    const prisma = getPrismaClient();
    try {
      const project = await prisma.project.create({ data: projectPayload(input) as any });
      appendEngineLog('info', 'Project created', { projectId: project.id, name: project.name });
      return reply.code(201).send({ project });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return reply.code(409).send({ message });
    }
  });

  app.put('/api/projects/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const input = (request.body ?? {}) as ProjectInput;
    const validation = validateProjectInput(input, true);
    if (!validation.valid) return reply.code(400).send({ message: 'Project validation failed.', errors: validation.errors });

    const prisma = getPrismaClient();
    try {
      const project = await prisma.project.update({ where: { id }, data: projectUpdatePayload(input) as any });
      appendEngineLog('info', 'Project updated', { projectId: project.id, name: project.name });
      return { project };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return reply.code(404).send({ message });
    }
  });

  app.delete('/api/projects/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const prisma = getPrismaClient();
    try {
      const project = await prisma.project.delete({ where: { id } });
      appendEngineLog('info', 'Project deleted', { projectId: project.id, name: project.name });
      return { ok: true, projectId: project.id };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return reply.code(404).send({ message });
    }
  });

  app.post('/api/projects/:id/activate', async (request, reply) => {
    const { id } = request.params as { id: string };
    const prisma = getPrismaClient();
    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) return reply.code(404).send({ message: `Project not found: ${id}` });

    await prisma.appSetting.upsert({
      where: { key: 'activeProjectId' },
      update: { value: id },
      create: { key: 'activeProjectId', value: id },
    });

    appendEngineLog('info', 'Active project set', { projectId: id, name: project.name });
    return { ok: true, projectId: id, projectName: project.name };
  });
}
