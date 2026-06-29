import type { DeviceEnergyMapping } from './deviceEnergyMapping.js';
import { resolveDeviceEnergyMapping } from './deviceEnergyMapping.js';
import type { TagEnergyRole } from './tagEnergyMapping.js';
import { inferTagEnergyRole, normalizeTagEnergyRole } from './tagEnergyMapping.js';
import { DEFAULT_EMISSION_FACTOR_KG_PER_KWH } from './projectCarbon.js';

export type CarbonDeviceInput = {
  id: string;
  name: string;
  description?: string | null;
  energyMappingJson?: string | null;
};

export type CarbonTagInput = {
  id: string;
  deviceId: string;
  name: string;
  unit?: string | null;
  energyTagRole?: string | null;
  currentValue?: number | null;
};

export type CarbonSummaryInput = {
  emissionFactorKgPerKwh?: number;
  netMetering?: boolean;
  devices: CarbonDeviceInput[];
  tags: CarbonTagInput[];
};

export type CarbonDeviceContribution = {
  deviceId: string;
  deviceName: string;
  role: DeviceEnergyMapping['role'];
  importKwh: number;
  exportKwh: number;
  netKwh: number;
  qualifiedKwh: number;
};

export type CarbonSummaryResult = {
  emissionFactorKgPerKwh: number;
  netMetering: boolean;
  kWhQualified: number;
  carbonKg: number;
  importKwh: number;
  exportKwh: number;
  netKwh: number;
  strategy: 'site_main' | 'include_in_carbon' | 'fallback_all_kwh';
  deviceCount: number;
  tagCount: number;
  devices: CarbonDeviceContribution[];
  warnings: string[];
};

function tagRole(tag: CarbonTagInput): TagEnergyRole {
  const explicit = normalizeTagEnergyRole(tag.energyTagRole);
  if (explicit !== 'none') return explicit;
  return inferTagEnergyRole(tag.name, tag.unit);
}

function tagValue(tag: CarbonTagInput): number {
  const v = Number(tag.currentValue);
  return Number.isFinite(v) ? Math.max(0, v) : 0;
}

export function computeDeviceQualifiedKwh(
  deviceTags: CarbonTagInput[],
  options: { netMetering: boolean; fallbackKwh?: boolean },
): Pick<CarbonDeviceContribution, 'importKwh' | 'exportKwh' | 'netKwh' | 'qualifiedKwh'> {
  const fallbackKwh = Boolean(options.fallbackKwh);
  let dImport = 0;
  let dExport = 0;
  let dNet = 0;
  let dFallback = 0;

  for (const tag of deviceTags) {
    const role = tagRole(tag);
    const value = tagValue(tag);
    if (value <= 0) continue;

    switch (role) {
      case 'import_kwh':
        dImport += value;
        break;
      case 'export_kwh':
        dExport += value;
        break;
      case 'net_kwh':
        dNet += value;
        break;
      case 'power_kw':
      case 'none':
      default:
        if (fallbackKwh) {
          const unit = String(tag.unit ?? '').toLowerCase();
          const name = String(tag.name ?? '').toLowerCase();
          if (unit === 'kwh' || name.includes('kwh') || name.includes('energy')) {
            dFallback += value;
          }
        }
        break;
    }
  }

  let qualified = 0;
  if (dNet > 0 && dImport === 0 && dExport === 0) {
    qualified = dNet;
  } else if (options.netMetering) {
    qualified = Math.max(0, dImport + dFallback - dExport);
  } else {
    qualified = dImport + dFallback;
  }

  return {
    importKwh: dImport + dFallback,
    exportKwh: dExport,
    netKwh: dNet,
    qualifiedKwh: qualified,
  };
}

export function selectCarbonDeviceIds(devices: CarbonDeviceInput[]): {
  ids: Set<string>;
  strategy: CarbonSummaryResult['strategy'];
} {
  const resolved = devices.map(d => ({
    id: d.id,
    mapping: resolveDeviceEnergyMapping(d),
  }));

  const mains = resolved.filter(d => d.mapping.role === 'site_main' && d.mapping.includeInCarbon);
  if (mains.length > 0) {
    return { ids: new Set(mains.map(d => d.id)), strategy: 'site_main' };
  }

  const included = resolved.filter(
    d =>
      d.mapping.includeInCarbon &&
      d.mapping.role !== 'excluded' &&
      d.mapping.role !== 'monitoring',
  );
  if (included.length > 0) {
    return { ids: new Set(included.map(d => d.id)), strategy: 'include_in_carbon' };
  }

  return { ids: new Set(devices.map(d => d.id)), strategy: 'fallback_all_kwh' };
}

export function computeCarbonSummary(input: CarbonSummaryInput): CarbonSummaryResult {
  const emissionFactorKgPerKwh =
    Number.isFinite(Number(input.emissionFactorKgPerKwh)) && Number(input.emissionFactorKgPerKwh) >= 0
      ? Number(input.emissionFactorKgPerKwh)
      : DEFAULT_EMISSION_FACTOR_KG_PER_KWH;
  const netMetering = Boolean(input.netMetering);
  const warnings: string[] = [];

  const { ids: deviceIds, strategy } = selectCarbonDeviceIds(input.devices);
  const deviceById = new Map(input.devices.map(d => [d.id, d]));

  const contributions: CarbonDeviceContribution[] = [];
  let importKwh = 0;
  let exportKwh = 0;
  let netKwh = 0;

  for (const deviceId of deviceIds) {
    const device = deviceById.get(deviceId);
    if (!device) continue;
    const mapping = resolveDeviceEnergyMapping(device);
    const deviceTags = input.tags.filter(t => t.deviceId === deviceId);
    const parts = computeDeviceQualifiedKwh(deviceTags, {
      netMetering,
      fallbackKwh: strategy === 'fallback_all_kwh',
    });

    importKwh += parts.importKwh;
    exportKwh += parts.exportKwh;
    netKwh += parts.netKwh > 0 ? parts.netKwh : parts.qualifiedKwh;

    contributions.push({
      deviceId,
      deviceName: device.name,
      role: mapping.role,
      importKwh: parts.importKwh,
      exportKwh: parts.exportKwh,
      netKwh: parts.netKwh,
      qualifiedKwh: parts.qualifiedKwh,
    });
  }

  let kWhQualified = contributions.reduce((sum, d) => sum + d.qualifiedKwh, 0);

  if (kWhQualified <= 0 && strategy !== 'fallback_all_kwh') {
    warnings.push('No qualifying energy tags found on selected meters.');
  }
  if (strategy === 'site_main' && deviceIds.size > 1) {
    warnings.push(`Using ${deviceIds.size} main meter(s) for site carbon total.`);
  }

  return {
    emissionFactorKgPerKwh,
    netMetering,
    kWhQualified,
    carbonKg: kWhQualified * emissionFactorKgPerKwh,
    importKwh,
    exportKwh,
    netKwh,
    strategy,
    deviceCount: deviceIds.size,
    tagCount: input.tags.filter(t => deviceIds.has(t.deviceId)).length,
    devices: contributions,
    warnings,
  };
}
