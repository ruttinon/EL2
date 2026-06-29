import { getPrismaClient } from './database.js';
import { buildCarbonSummary, resolveProjectId } from './carbonService.js';
import {
  buildHourlyKwhBuckets,
  computeEnergyBill,
  normalizeTariffConfig,
  resolvePeakDemandKw,
  type EnergyBillResult,
  type EnergyTariffConfig,
  type HourlyConsumptionInput,
} from '@energylink/shared-types';
import { inferTagEnergyRole, normalizeTagEnergyRole } from '@energylink/shared-types';

export type BillingQueryOptions = {
  from?: string;
  to?: string;
  period?: 'live' | 'today' | '7d' | '30d';
  tariffId?: string;
  deviceScope?: 'site' | 'all';
};

export type BillingSummaryPayload = EnergyBillResult & {
  projectId: string;
  projectName: string;
  period: string;
  from?: string;
  to?: string;
  dataSource: 'live' | 'history';
  strategy: string;
  energyCostRate: number;
  estimatedCostFlat: number;
};

function defaultTariffConfig(project: { energyCostRate: number; currency: string }): EnergyTariffConfig {
  return normalizeTariffConfig(
    {
      mode: 'flat',
      currency: project.currency,
      flatRatePerKwh: project.energyCostRate,
      vatPercent: 7,
      fixedCharge: 0,
    },
    project.energyCostRate,
  );
}

export async function listEnergyTariffs(projectId?: string) {
  const resolvedId = await resolveProjectId(projectId);
  if (!resolvedId) return [];
  const prisma = getPrismaClient();
  return prisma.energyTariff.findMany({
    where: { projectId: resolvedId },
    orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
  });
}

export async function getEnergyTariff(tariffId: string) {
  const prisma = getPrismaClient();
  return prisma.energyTariff.findUnique({ where: { id: tariffId } });
}

export async function upsertEnergyTariff(input: {
  id?: string;
  projectId: string;
  name: string;
  description?: string | null;
  isDefault?: boolean;
  config: EnergyTariffConfig;
  effectiveFrom?: string | null;
}) {
  const prisma = getPrismaClient();
  const configJson = JSON.stringify(input.config);

  if (input.isDefault) {
    await prisma.energyTariff.updateMany({
      where: { projectId: input.projectId },
      data: { isDefault: false },
    });
  }

  if (input.id) {
    return prisma.energyTariff.update({
      where: { id: input.id },
      data: {
        name: input.name,
        description: input.description ?? null,
        isDefault: input.isDefault ?? false,
        configJson,
        effectiveFrom: input.effectiveFrom ? new Date(input.effectiveFrom) : null,
      },
    });
  }

  return prisma.energyTariff.create({
    data: {
      projectId: input.projectId,
      name: input.name,
      description: input.description ?? null,
      isDefault: input.isDefault ?? false,
      configJson,
      effectiveFrom: input.effectiveFrom ? new Date(input.effectiveFrom) : null,
    },
  });
}

export async function deleteEnergyTariff(tariffId: string) {
  const prisma = getPrismaClient();
  return prisma.energyTariff.delete({ where: { id: tariffId } });
}

async function resolveTariff(projectId: string, tariffId?: string, fallbackRate = 0) {
  const prisma = getPrismaClient();
  if (tariffId) {
    const t = await prisma.energyTariff.findFirst({ where: { id: tariffId, projectId } });
    if (t) {
      return {
        id: t.id,
        name: t.name,
        config: normalizeTariffConfig(JSON.parse(t.configJson), fallbackRate),
      };
    }
  }
  const def = await prisma.energyTariff.findFirst({
    where: { projectId, isDefault: true },
    orderBy: { updatedAt: 'desc' },
  });
  if (def) {
    return {
      id: def.id,
      name: def.name,
      config: normalizeTariffConfig(JSON.parse(def.configJson), fallbackRate),
    };
  }
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  return {
    id: null as string | null,
    name: 'Project flat rate',
    config: defaultTariffConfig({
      energyCostRate: project?.energyCostRate ?? fallbackRate,
      currency: project?.currency ?? 'THB',
    }),
  };
}

function isEnergyTag(tag: { name: string; unit?: string | null; energyTagRole?: string | null }) {
  const role = normalizeTagEnergyRole(tag.energyTagRole);
  if (role === 'import_kwh' || role === 'net_kwh' || role === 'export_kwh') return true;
  if (role !== 'none') return false;
  const inferred = inferTagEnergyRole(tag.name, tag.unit);
  return inferred === 'import_kwh' || inferred === 'net_kwh';
}

async function loadHourlyConsumption(
  projectId: string,
  tagIds: string[],
  from: Date,
  to: Date,
  timezone: string,
): Promise<Map<number, number>> {
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
    select: { tagId: true, value: true, readAt: true },
  });

  const byTag = new Map<string, { value: number; readAt: Date }[]>();
  for (const row of rows) {
    const value = Number(row.value);
    if (!Number.isFinite(value)) continue;
    const list = byTag.get(row.tagId) ?? [];
    list.push({ value, readAt: row.readAt });
    byTag.set(row.tagId, list);
  }

  const readings: HourlyConsumptionInput[] = [];
  for (const points of byTag.values()) {
    for (let i = 1; i < points.length; i++) {
      const delta = points[i].value - points[i - 1].value;
      if (delta > 0) {
        readings.push({ readAt: points[i].readAt, deltaKwh: delta, timezone });
      }
    }
  }

  return buildHourlyKwhBuckets(readings);
}

async function loadPeakDemandFromHistory(
  projectId: string,
  powerTagIds: string[],
  from: Date,
  to: Date,
): Promise<number> {
  if (!powerTagIds.length) return 0;
  const prisma = getPrismaClient();
  const agg = await prisma.historyValue.aggregate({
    where: {
      projectId,
      tagId: { in: powerTagIds },
      readAt: { gte: from, lte: to },
      value: { not: null },
    },
    _max: { value: true },
  });
  const peak = Number(agg._max.value);
  return Number.isFinite(peak) ? peak : 0;
}

export async function buildBillingSummary(
  projectId?: string,
  options?: BillingQueryOptions,
): Promise<BillingSummaryPayload | null> {
  const resolvedId = await resolveProjectId(projectId);
  if (!resolvedId) return null;

  const prisma = getPrismaClient();
  const project = await prisma.project.findUnique({ where: { id: resolvedId } });
  if (!project) return null;

  const carbonSummary = await buildCarbonSummary(resolvedId, {
    from: options?.from,
    to: options?.to,
    period: options?.period,
  });
  if (!carbonSummary) return null;

  const [devices, tags] = await Promise.all([
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
  ]);

  const tariff = await resolveTariff(resolvedId, options?.tariffId, project.energyCostRate);

  let hourlyKwh: Map<number, number> | undefined;
  let peakDemandKw = resolvePeakDemandKw(tags);

  if (carbonSummary.from && carbonSummary.to) {
    const from = new Date(carbonSummary.from);
    const to = new Date(carbonSummary.to);
    const energyTagIds = tags.filter(isEnergyTag).map(t => t.id);
    hourlyKwh = await loadHourlyConsumption(resolvedId, energyTagIds, from, to, project.timezone);

    const powerTagIds = tags
      .filter(t => normalizeTagEnergyRole(t.energyTagRole) === 'power_kw')
      .map(t => t.id);
    const histPeak = await loadPeakDemandFromHistory(resolvedId, powerTagIds, from, to);
    peakDemandKw = Math.max(peakDemandKw, histPeak);
  }

  const bill = computeEnergyBill({
    tariff: tariff.config,
    tariffName: tariff.name,
    currency: project.currency,
    totalKwh: carbonSummary.kWhQualified,
    importKwh: carbonSummary.importKwh,
    exportKwh: carbonSummary.exportKwh,
    peakDemandKw,
    hourlyKwh,
    carbonSummary,
    devices,
    tags,
  });

  return {
    ...bill,
    projectId: resolvedId,
    projectName: project.name,
    period: carbonSummary.period,
    from: carbonSummary.from,
    to: carbonSummary.to,
    dataSource: carbonSummary.dataSource,
    strategy: carbonSummary.strategy,
    energyCostRate: project.energyCostRate,
    estimatedCostFlat: Math.round(carbonSummary.kWhQualified * project.energyCostRate * 100) / 100,
  };
}

export async function simulateBill(
  projectId?: string,
  options?: BillingQueryOptions,
): Promise<BillingSummaryPayload | null> {
  return buildBillingSummary(projectId, options);
}

export async function ensureDefaultTariffs(projectId: string) {
  const prisma = getPrismaClient();
  const existing = await prisma.energyTariff.count({ where: { projectId } });
  if (existing > 0) return;

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return;

  const rate = project.energyCostRate || 4.5;
  const presets: Array<{ name: string; description: string; isDefault: boolean; config: EnergyTariffConfig }> = [
    {
      name: 'Flat rate',
      description: 'Simple flat THB/kWh from project settings',
      isDefault: true,
      config: normalizeTariffConfig({ mode: 'flat', flatRatePerKwh: rate, vatPercent: 7 }, rate),
    },
    {
      name: 'Residential tier (PEA style)',
      description: 'Block tier 0–150 / 151–400 / 401+ kWh',
      isDefault: false,
      config: normalizeTariffConfig({ mode: 'tiered', vatPercent: 7, fixedCharge: 38.22 }, rate),
    },
    {
      name: 'TOU Peak/Off-peak',
      description: 'Time-of-use 09:00–22:00 peak / off-peak',
      isDefault: false,
      config: normalizeTariffConfig({ mode: 'tou', vatPercent: 7 }, rate),
    },
    {
      name: 'Industrial TOU + Demand',
      description: 'TOU energy + demand charge (kW)',
      isDefault: false,
      config: normalizeTariffConfig({
        mode: 'combined',
        vatPercent: 7,
        demandCharge: { ratePerKw: 132.93, label: 'Demand charge' },
      }, rate),
    },
  ];

  for (const p of presets) {
    await prisma.energyTariff.create({
      data: {
        projectId,
        name: p.name,
        description: p.description,
        isDefault: p.isDefault,
        configJson: JSON.stringify(p.config),
      },
    });
  }
}
