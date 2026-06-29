import { getPrismaClient } from './database.js';
import { getCurrentValuesSnapshot } from './runtimePollingService.js';
import {
  computeCarbonSummary,
  computeCarbonBreakdown,
  normalizeProjectCarbonProfile,
  validateCarbonConfig,
  inferTagEnergyRole,
  normalizeTagEnergyRole,
  type CarbonBreakdownBy,
  type CarbonConfigIssue,
  type CarbonSummaryResult,
} from '@energylink/shared-types';

export type CarbonSummaryPayload = CarbonSummaryResult & {
  configIssues: CarbonConfigIssue[];
  dataSource: 'live' | 'history';
  period: string;
  from?: string;
  to?: string;
};

export type CarbonQueryOptions = {
  from?: string;
  to?: string;
  period?: 'live' | 'today' | '7d' | '30d';
};

export type CarbonBreakdownPayload = ReturnType<typeof computeCarbonBreakdown> & {
  projectId: string;
  period: string;
  from?: string;
  to?: string;
  dataSource: 'live' | 'history';
  strategy: CarbonSummaryResult['strategy'];
};

type CarbonWindow = {
  mode: 'live' | 'history';
  period: string;
  from?: Date;
  to?: Date;
};

function resolveCarbonWindow(options?: CarbonQueryOptions): CarbonWindow {
  if (options?.from && options?.to) {
    const from = new Date(options.from);
    const to = new Date(options.to);
    if (Number.isFinite(from.getTime()) && Number.isFinite(to.getTime())) {
      return { mode: 'history', period: 'custom', from, to };
    }
  }

  const period = options?.period ?? 'live';
  if (period === 'live') return { mode: 'live', period: 'live' };

  const to = new Date();
  const from = new Date(to);
  if (period === 'today') {
    from.setHours(0, 0, 0, 0);
  } else if (period === '7d') {
    from.setDate(from.getDate() - 7);
  } else if (period === '30d') {
    from.setDate(from.getDate() - 30);
  } else {
    return { mode: 'live', period: 'live' };
  }

  return { mode: 'history', period, from, to };
}

export async function resolveProjectId(projectId?: string): Promise<string | null> {
  const prisma = getPrismaClient();
  const explicit = projectId?.trim();
  if (explicit) return explicit;
  const active = await prisma.appSetting.findUnique({ where: { key: 'activeProjectId' } });
  const activeId = active?.value?.trim();
  if (activeId) return activeId;
  const latest = await prisma.project.findFirst({ orderBy: { updatedAt: 'desc' }, select: { id: true } });
  return latest?.id ?? null;
}

async function loadHistoryDeltas(
  projectId: string,
  tagIds: string[],
  from: Date,
  to: Date,
): Promise<Map<string, number>> {
  if (!tagIds.length) return new Map();

  const prisma = getPrismaClient();
  const rows = await prisma.historyValue.findMany({
    where: {
      projectId,
      tagId: { in: tagIds },
      readAt: { gte: from, lte: to },
      value: { not: null },
    },
    orderBy: [{ tagId: 'asc' }, { readAt: 'asc' }],
    select: { tagId: true, value: true },
  });

  const byTag = new Map<string, { first: number; last: number }>();
  for (const row of rows) {
    const value = Number(row.value);
    if (!Number.isFinite(value)) continue;
    const existing = byTag.get(row.tagId);
    if (!existing) byTag.set(row.tagId, { first: value, last: value });
    else existing.last = value;
  }

  const deltas = new Map<string, number>();
  for (const [tagId, range] of byTag) {
    const delta = range.last - range.first;
    if (delta >= 0) deltas.set(tagId, delta);
  }
  return deltas;
}

async function loadCarbonContext(resolvedId: string, window: CarbonWindow) {
  const prisma = getPrismaClient();
  const project = await prisma.project.findUnique({ where: { id: resolvedId } });
  if (!project) return null;

  const carbon = normalizeProjectCarbonProfile({
    facilityType: project.facilityType as any,
    emissionFactorKgPerKwh: project.emissionFactorKgPerKwh,
    netMetering: project.netMetering,
    floorAreaM2: project.floorAreaM2,
  });

  const [devices, tags, liveValues] = await Promise.all([
    prisma.device.findMany({
      where: { projectId: resolvedId },
      select: { id: true, name: true, description: true, energyMappingJson: true },
    }),
    prisma.tag.findMany({
      where: { projectId: resolvedId },
      select: {
        id: true,
        deviceId: true,
        name: true,
        unit: true,
        energyTagRole: true,
        currentValue: true,
      },
    }),
    getCurrentValuesSnapshot({ projectId: resolvedId }),
  ]);

  const valueByTagId = new Map(liveValues.map(v => [v.id, v.value]));
  const qualityByTagId = Object.fromEntries(liveValues.map(v => [v.id, v.quality]));

  let dataSource: 'live' | 'history' = 'live';
  let historyDeltas = new Map<string, number>();

  if (window.mode === 'history' && window.from && window.to) {
    historyDeltas = await loadHistoryDeltas(
      resolvedId,
      tags.map(t => t.id),
      window.from,
      window.to,
    );
    if (historyDeltas.size > 0) dataSource = 'history';
  }

  const tagInputs = tags.map(tag => {
    const snapVal = valueByTagId.get(tag.id);
    const snap =
      snapVal != null && Number.isFinite(Number(snapVal)) ? Number(snapVal) : null;
    const stored = tag.currentValue == null ? null : Number(tag.currentValue);
    let currentValue: number | null =
      snap != null && snap > 0 ? snap : stored != null && stored > 0 ? stored : snap ?? stored;

    if (dataSource === 'history' && historyDeltas.has(tag.id)) {
      currentValue = historyDeltas.get(tag.id) ?? null;
    }

    return {
      id: tag.id,
      deviceId: tag.deviceId,
      name: tag.name,
      unit: tag.unit,
      energyTagRole: tag.energyTagRole,
      currentValue,
    };
  });

  return {
    project,
    carbon,
    devices,
    tags: tagInputs,
    qualityByTagId,
    dataSource,
    window,
  };
}

export async function buildCarbonSummary(
  projectId?: string,
  options?: CarbonQueryOptions,
): Promise<CarbonSummaryPayload | null> {
  const resolvedId = await resolveProjectId(projectId);
  if (!resolvedId) return null;

  const window = resolveCarbonWindow(options);
  const ctx = await loadCarbonContext(resolvedId, window);
  if (!ctx) return null;

  const summary = computeCarbonSummary({
    emissionFactorKgPerKwh: ctx.carbon.emissionFactorKgPerKwh,
    netMetering: ctx.carbon.netMetering,
    devices: ctx.devices,
    tags: ctx.tags,
  });

  const extraWarnings: string[] = [];
  if (window.mode === 'history' && ctx.dataSource === 'live') {
    extraWarnings.push('No history records in selected period — using live meter readings.');
  }

  const configIssues = validateCarbonConfig({
    devices: ctx.devices,
    tags: ctx.tags,
    strategy: summary.strategy,
    kWhQualified: summary.kWhQualified,
    tagQuality: ctx.qualityByTagId,
  });

  return {
    ...summary,
    warnings: [...summary.warnings, ...extraWarnings, ...configIssues.map(i => i.message)],
    configIssues,
    dataSource: ctx.dataSource,
    period: window.period,
    from: window.from?.toISOString(),
    to: window.to?.toISOString(),
  };
}

export async function buildCarbonBreakdown(
  projectId?: string,
  by: CarbonBreakdownBy = 'loadCategory',
  options?: CarbonQueryOptions,
): Promise<CarbonBreakdownPayload | null> {
  const resolvedId = await resolveProjectId(projectId);
  if (!resolvedId) return null;

  const window = resolveCarbonWindow(options);
  const ctx = await loadCarbonContext(resolvedId, window);
  if (!ctx) return null;

  const summary = computeCarbonSummary({
    emissionFactorKgPerKwh: ctx.carbon.emissionFactorKgPerKwh,
    netMetering: ctx.carbon.netMetering,
    devices: ctx.devices,
    tags: ctx.tags,
  });

  const breakdown = computeCarbonBreakdown(
    ctx.devices,
    summary.devices,
    ctx.carbon.emissionFactorKgPerKwh,
    by,
    summary.strategy,
    ctx.tags,
    ctx.carbon.netMetering,
  );

  return {
    projectId: resolvedId,
    ...breakdown,
    period: window.period,
    from: window.from?.toISOString(),
    to: window.to?.toISOString(),
    dataSource: ctx.dataSource,
    strategy: summary.strategy,
  };
}

export type BackfillTagRolesResult = {
  projectId: string;
  dryRun: boolean;
  scanned: number;
  updated: number;
  samples: Array<{ id: string; name: string; unit: string | null; role: string }>;
};

export async function backfillTagEnergyRoles(
  projectId?: string,
  dryRun = false,
): Promise<BackfillTagRolesResult | null> {
  const resolvedId = await resolveProjectId(projectId);
  if (!resolvedId) return null;

  const prisma = getPrismaClient();
  const tags = await prisma.tag.findMany({
    where: { projectId: resolvedId },
    select: { id: true, name: true, unit: true, energyTagRole: true },
  });

  const samples: BackfillTagRolesResult['samples'] = [];
  let updated = 0;

  for (const tag of tags) {
    if (normalizeTagEnergyRole(tag.energyTagRole) !== 'none') continue;
    const inferred = inferTagEnergyRole(tag.name, tag.unit);
    if (inferred === 'none') continue;
    updated += 1;
    if (samples.length < 25) {
      samples.push({ id: tag.id, name: tag.name, unit: tag.unit, role: inferred });
    }
    if (!dryRun) {
      await prisma.tag.update({ where: { id: tag.id }, data: { energyTagRole: inferred } });
    }
  }

  return {
    projectId: resolvedId,
    dryRun,
    scanned: tags.length,
    updated,
    samples,
  };
}

export function serializeProjectCarbon(project: {
  facilityType: string;
  emissionFactorKgPerKwh: number;
  netMetering: boolean;
  floorAreaM2: number | null;
}) {
  return JSON.stringify(
    normalizeProjectCarbonProfile({
      facilityType: project.facilityType as any,
      emissionFactorKgPerKwh: project.emissionFactorKgPerKwh,
      netMetering: project.netMetering,
      floorAreaM2: project.floorAreaM2,
    }),
  );
}

export type SeedCarbonSampleResult = {
  projectId: string;
  projectName: string;
  tagsUpdated: number;
  misTaggedFixed: number;
  summary: CarbonSummaryPayload | null;
  breakdown: CarbonBreakdownPayload | null;
};

const DEMO_IMPORT_TAG = 'TOTAL Active Energy +';

const DEMO_CARBON_READINGS: Array<{
  deviceName: string;
  mapping: {
    role: string;
    loadCategory: string;
    includeInCarbon: boolean;
    source?: string;
  };
  kWh: number;
}> = [
  {
    deviceName: 'C11',
    mapping: { role: 'site_main', loadCategory: 'total_site', includeInCarbon: true, source: 'grid' },
    kWh: 12_500,
  },
  {
    deviceName: 'C11-2',
    mapping: { role: 'sub_meter', loadCategory: 'office', includeInCarbon: true, source: 'grid' },
    kWh: 3_200,
  },
  {
    deviceName: 'CVM-C11/2',
    mapping: { role: 'sub_meter', loadCategory: 'hvac', includeInCarbon: true, source: 'grid' },
    kWh: 1_800,
  },
];

async function resolveSeedProject(input?: string) {
  const prisma = getPrismaClient();
  const needle = input?.trim();
  if (needle) {
    const byId = await prisma.project.findUnique({ where: { id: needle }, select: { id: true, name: true } });
    if (byId) return byId;
    const byName = await prisma.project.findFirst({ where: { name: needle }, select: { id: true, name: true } });
    if (byName) return byName;
    throw new Error(`Project not found: ${needle}`);
  }
  const latest = await prisma.project.findFirst({ orderBy: { updatedAt: 'desc' }, select: { id: true, name: true } });
  if (!latest) throw new Error('No projects in database.');
  return latest;
}

/** @deprecated */ export type SeedCarbonDemoResult = SeedCarbonSampleResult;

/** Inject sample kWh readings for carbon UI testing when meters are offline. */
export async function seedCarbonSample(projectRef?: string): Promise<SeedCarbonSampleResult> {
  const prisma = getPrismaClient();
  const project = await resolveSeedProject(projectRef ?? 'test');

  await prisma.appSetting.upsert({
    where: { key: 'activeProjectId' },
    update: { value: project.id },
    create: { key: 'activeProjectId', value: project.id },
  });

  await prisma.project.update({
    where: { id: project.id },
    data: {
      emissionFactorKgPerKwh: 0.52,
      facilityType: 'factory',
      netMetering: false,
      floorAreaM2: 2500,
    },
  });

  const now = new Date();
  let tagsUpdated = 0;

  for (const row of DEMO_CARBON_READINGS) {
    const device = await prisma.device.findFirst({
      where: { projectId: project.id, name: row.deviceName },
      select: { id: true },
    });
    if (!device) continue;

    await prisma.device.update({
      where: { id: device.id },
      data: {
        energyMappingJson: JSON.stringify({
          role: row.mapping.role,
          source: row.mapping.source ?? '',
          loadCategory: row.mapping.loadCategory,
          includeInCarbon: row.mapping.includeInCarbon,
          viewerVisible: true,
        }),
      },
    });

    const importTag = await prisma.tag.findFirst({
      where: { projectId: project.id, deviceId: device.id, name: DEMO_IMPORT_TAG },
      select: { id: true },
    });
    if (!importTag) continue;

    await prisma.tag.update({
      where: { id: importTag.id },
      data: {
        energyTagRole: 'import_kwh',
        currentValue: row.kWh,
        quality: 'good',
        lastValueAt: now,
      },
    });
    tagsUpdated += 1;

    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekDelta = Math.round(row.kWh * 0.08);
    await prisma.historyValue.deleteMany({
      where: { tagId: importTag.id, readAt: { gte: weekAgo } },
    });
    await prisma.historyValue.createMany({
      data: [
        {
          projectId: project.id,
          tagId: importTag.id,
          deviceId: device.id,
          value: row.kWh - weekDelta,
          readAt: weekAgo,
          quality: 'good',
        },
        {
          projectId: project.id,
          tagId: importTag.id,
          deviceId: device.id,
          value: row.kWh,
          readAt: now,
          quality: 'good',
        },
      ],
    });
  }

  const misTagged = await prisma.tag.findMany({
    where: {
      projectId: project.id,
      energyTagRole: 'import_kwh',
      OR: [
        { name: { contains: 'Apparent' } },
        { name: { contains: 'Capacitive' } },
        { name: { contains: 'Inductive' } },
      ],
    },
    select: { id: true },
  });
  if (misTagged.length > 0) {
    await prisma.tag.updateMany({
      where: { id: { in: misTagged.map(t => t.id) } },
      data: { energyTagRole: 'none' },
    });
  }

  const summary = await buildCarbonSummary(project.id, { period: 'live' });
  const breakdown = await buildCarbonBreakdown(project.id, 'loadCategory', { period: 'live' });

  return {
    projectId: project.id,
    projectName: project.name,
    tagsUpdated,
    misTaggedFixed: misTagged.length,
    summary,
    breakdown,
  };
}

/** Clear injected sample kWh readings so carbon uses live meter data only. */
export async function clearCarbonSample(projectRef?: string): Promise<{ projectId: string; projectName: string; tagsCleared: number }> {
  const prisma = getPrismaClient();
  const project = await resolveSeedProject(projectRef ?? 'test');

  const tags = await prisma.tag.findMany({
    where: {
      projectId: project.id,
      name: DEMO_IMPORT_TAG,
      currentValue: { not: null },
    },
    select: { id: true },
  });

  if (tags.length > 0) {
    await prisma.tag.updateMany({
      where: { id: { in: tags.map(t => t.id) } },
      data: { currentValue: null, quality: 'unknown' },
    });
  }

  return { projectId: project.id, projectName: project.name, tagsCleared: tags.length };
}

/** @deprecated Use seedCarbonSample */
export const seedCarbonDemo = seedCarbonSample;
/** @deprecated Use clearCarbonSample */
export const clearCarbonDemo = clearCarbonSample;

export async function validateCarbonForPublish(projectId: string) {
  const summary = await buildCarbonSummary(projectId, { period: 'live' });
  if (!summary) return { ok: false, issues: [] as CarbonConfigIssue[] };
  const blocking = summary.configIssues.filter(i => i.severity === 'error');
  return { ok: blocking.length === 0, issues: summary.configIssues, summary };
}
