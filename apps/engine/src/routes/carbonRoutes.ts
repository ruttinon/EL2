import type { FastifyInstance } from 'fastify';
import {
  backfillTagEnergyRoles,
  buildCarbonBreakdown,
  buildCarbonSummary,
  resolveProjectId,
  seedCarbonSample,
  clearCarbonSample,
} from '../services/carbonService.js';
import { generateCarbonReport } from '../services/carbonReportService.js';
import { getPrismaClient } from '../services/database.js';
import { appendEngineLog } from '../services/engineLogger.js';
import { initSnapshotFromDb } from '../services/runtimePollingService.js';
import { normalizeProjectCarbonProfile, type CarbonBreakdownBy } from '@energylink/shared-types';

type CarbonPeriod = 'live' | 'today' | '7d' | '30d';

function parseCarbonPeriod(value: unknown): CarbonPeriod | undefined {
  if (value === 'today' || value === '7d' || value === '30d' || value === 'live') return value;
  return undefined;
}

function parseCarbonQuery(query: Record<string, unknown>) {
  return {
    projectId: typeof query.projectId === 'string' ? query.projectId : undefined,
    from: typeof query.from === 'string' ? query.from : undefined,
    to: typeof query.to === 'string' ? query.to : undefined,
    period: parseCarbonPeriod(query.period),
  };
}

function parseBreakdownBy(value: unknown): CarbonBreakdownBy {
  if (value === 'device' || value === 'source' || value === 'loadCategory') return value;
  return 'loadCategory';
}

export async function registerCarbonRoutes(app: FastifyInstance) {
  app.get('/api/carbon/summary', async (request, reply) => {
    const query = parseCarbonQuery(request.query as Record<string, unknown>);
    const summary = await buildCarbonSummary(query.projectId, {
      from: query.from,
      to: query.to,
      period: query.period,
    });
    if (!summary) return reply.code(404).send({ message: 'No project found for carbon summary.' });

    const resolvedId = await resolveProjectId(query.projectId);
    const prisma = getPrismaClient();
    const project = resolvedId
      ? await prisma.project.findUnique({
          where: { id: resolvedId },
          select: {
            id: true,
            name: true,
            facilityType: true,
            emissionFactorKgPerKwh: true,
            netMetering: true,
            floorAreaM2: true,
            energyCostRate: true,
            currency: true,
          },
        })
      : null;

    const carbon = normalizeProjectCarbonProfile(
      project
        ? {
            facilityType: project.facilityType as any,
            emissionFactorKgPerKwh: project.emissionFactorKgPerKwh,
            netMetering: project.netMetering,
            floorAreaM2: project.floorAreaM2,
          }
        : undefined,
    );

    const floorAreaM2 = carbon.floorAreaM2 ?? null;
    const carbonIntensityKgPerM2 =
      floorAreaM2 && floorAreaM2 > 0 ? summary.carbonKg / floorAreaM2 : null;

    return {
      projectId: project?.id ?? resolvedId,
      projectName: project?.name ?? null,
      facilityType: carbon.facilityType,
      floorAreaM2,
      energyCostRate: project?.energyCostRate ?? 0,
      currency: project?.currency ?? 'THB',
      carbonIntensityKgPerM2,
      estimatedEnergyCost:
        project && project.energyCostRate > 0
          ? summary.kWhQualified * project.energyCostRate
          : null,
      ...summary,
      computedAt: new Date().toISOString(),
    };
  });

  app.get('/api/carbon/breakdown', async (request, reply) => {
    const raw = request.query as Record<string, unknown>;
    const query = parseCarbonQuery(raw);
    const by = parseBreakdownBy(raw.by);
    const breakdown = await buildCarbonBreakdown(query.projectId, by, {
      from: query.from,
      to: query.to,
      period: query.period,
    });
    if (!breakdown) return reply.code(404).send({ message: 'No project found for carbon breakdown.' });
    return { ...breakdown, computedAt: new Date().toISOString() };
  });

  app.post('/api/carbon/backfill-tag-roles', async (request, reply) => {
    const body = (request.body ?? {}) as { projectId?: string; dryRun?: boolean };
    const result = await backfillTagEnergyRoles(body.projectId, Boolean(body.dryRun));
    if (!result) return reply.code(404).send({ message: 'No project found for tag role backfill.' });

    appendEngineLog('info', 'Carbon tag role backfill', result);
    return reply.code(body.dryRun ? 200 : 201).send({ ok: true, ...result });
  });

  app.post('/api/carbon/seed-sample', async (request, reply) => {
    const body = (request.body ?? {}) as { projectId?: string; projectName?: string };
    try {
      const result = await seedCarbonSample(body.projectId ?? body.projectName ?? 'test');
      await initSnapshotFromDb();
      appendEngineLog('info', 'Carbon sample data seeded', {
        projectId: result.projectId,
        tagsUpdated: result.tagsUpdated,
      });
      return reply.code(201).send({
        ok: true,
        projectId: result.projectId,
        projectName: result.projectName,
        tagsUpdated: result.tagsUpdated,
        misTaggedFixed: result.misTaggedFixed,
        kWhQualified: result.summary?.kWhQualified ?? 0,
        carbonKg: result.summary?.carbonKg ?? 0,
        breakdownItems: result.breakdown?.items ?? [],
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return reply.code(400).send({ message });
    }
  });

  app.post('/api/carbon/clear-sample', async (request, reply) => {
    const body = (request.body ?? {}) as { projectId?: string; projectName?: string };
    try {
      const result = await clearCarbonSample(body.projectId ?? body.projectName ?? 'test');
      await initSnapshotFromDb();
      appendEngineLog('info', 'Carbon sample data cleared', result);
      return { ok: true, ...result };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return reply.code(400).send({ message });
    }
  });

  app.post('/api/carbon/report/generate', async (request, reply) => {
    const body = (request.body ?? {}) as {
      projectId?: string;
      period?: string;
      format?: string;
      from?: string;
      to?: string;
      requestedBy?: string;
    };
    const period = parseCarbonPeriod(body.period) ?? '30d';

    try {
      const generated = await generateCarbonReport({
        projectId: body.projectId,
        period,
        format: body.format,
        from: body.from,
        to: body.to,
        requestedBy: body.requestedBy,
      });
      return { generated };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      appendEngineLog('error', 'Carbon report generation failed', { message });
      return reply.code(400).send({ message });
    }
  });
}
