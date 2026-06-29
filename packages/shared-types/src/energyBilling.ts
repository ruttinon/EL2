import type { CarbonDeviceContribution, CarbonSummaryResult } from './carbonCalculation.js';
import { computeDeviceQualifiedKwh } from './carbonCalculation.js';
import { resolveDeviceEnergyMapping } from './deviceEnergyMapping.js';
import type { CarbonDeviceInput, CarbonTagInput } from './carbonCalculation.js';
import { inferTagEnergyRole, normalizeTagEnergyRole } from './tagEnergyMapping.js';

/** Tariff calculation mode */
export type TariffMode = 'flat' | 'tiered' | 'tou' | 'combined';

export type TariffTier = {
  fromKwh: number;
  toKwh?: number;
  ratePerKwh: number;
  label?: string;
};

export type TariffTouBand = {
  id: string;
  label: string;
  ratePerKwh: number;
  /** 0=Sun … 6=Sat; empty = all days */
  weekdays?: number[];
  startHour: number;
  endHour: number;
};

export type TariffDemandCharge = {
  ratePerKw: number;
  label?: string;
};

export type EnergyTariffConfig = {
  mode: TariffMode;
  currency?: string;
  fixedCharge?: number;
  vatPercent?: number;
  serviceCharge?: number;
  flatRatePerKwh?: number;
  tiers?: TariffTier[];
  touBands?: TariffTouBand[];
  demandCharge?: TariffDemandCharge;
};

export type BillLineItem = {
  category: 'energy' | 'demand' | 'fixed' | 'service' | 'vat' | 'other';
  label: string;
  quantity?: number;
  unit?: string;
  unitPrice?: number;
  amount: number;
};

export type DeviceBillItem = {
  deviceId: string;
  deviceName: string;
  role: string;
  loadCategory: string;
  kwh: number;
  sharePct: number;
  energyCost: number;
  demandKw?: number;
  demandCost?: number;
  subtotal: number;
};

export type TouBreakdownItem = {
  bandId: string;
  label: string;
  kwh: number;
  ratePerKwh: number;
  cost: number;
};

export type TierBreakdownItem = {
  label: string;
  kwh: number;
  ratePerKwh: number;
  cost: number;
};

export type EnergyBillResult = {
  currency: string;
  tariffName: string;
  tariffMode: TariffMode;
  totalKwh: number;
  importKwh: number;
  exportKwh: number;
  peakDemandKw: number;
  energyCost: number;
  demandCost: number;
  fixedCost: number;
  serviceCost: number;
  subtotal: number;
  vat: number;
  grandTotal: number;
  lineItems: BillLineItem[];
  devices: DeviceBillItem[];
  touBreakdown: TouBreakdownItem[];
  tierBreakdown: TierBreakdownItem[];
  warnings: string[];
};

export const DEFAULT_THAILAND_TOU_BANDS: TariffTouBand[] = [
  { id: 'peak', label: 'Peak (09:00–22:00)', ratePerKwh: 5.798, startHour: 9, endHour: 22 },
  { id: 'offpeak', label: 'Off-peak (22:00–09:00)', ratePerKwh: 2.636, startHour: 22, endHour: 9 },
];

export const DEFAULT_TIERED_TARIFF: TariffTier[] = [
  { fromKwh: 0, toKwh: 150, ratePerKwh: 3.2484, label: 'Block 1 (0–150)' },
  { fromKwh: 150, toKwh: 400, ratePerKwh: 4.2218, label: 'Block 2 (151–400)' },
  { fromKwh: 400, toKwh: undefined, ratePerKwh: 4.4217, label: 'Block 3 (401+)' },
];

export function normalizeTariffConfig(raw: unknown, fallbackRate = 0): EnergyTariffConfig {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const mode = (['flat', 'tiered', 'tou', 'combined'] as const).includes(o.mode as TariffMode)
    ? (o.mode as TariffMode)
    : 'flat';
  return {
    mode,
    currency: typeof o.currency === 'string' ? o.currency : 'THB',
    fixedCharge: numOr(o.fixedCharge, 0),
    vatPercent: numOr(o.vatPercent, 7),
    serviceCharge: numOr(o.serviceCharge, 0),
    flatRatePerKwh: numOr(o.flatRatePerKwh, fallbackRate),
    tiers: Array.isArray(o.tiers) ? (o.tiers as TariffTier[]) : DEFAULT_TIERED_TARIFF,
    touBands: Array.isArray(o.touBands) ? (o.touBands as TariffTouBand[]) : DEFAULT_THAILAND_TOU_BANDS,
    demandCharge: o.demandCharge && typeof o.demandCharge === 'object'
      ? (o.demandCharge as TariffDemandCharge)
      : undefined,
  };
}

function numOr(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Apply block/tier pricing to total kWh. */
export function calculateTieredCost(totalKwh: number, tiers: TariffTier[]): { cost: number; breakdown: TierBreakdownItem[] } {
  const sorted = [...tiers].sort((a, b) => a.fromKwh - b.fromKwh);
  let remaining = Math.max(0, totalKwh);
  let cursor = 0;
  let cost = 0;
  const breakdown: TierBreakdownItem[] = [];

  for (const tier of sorted) {
    if (remaining <= 0) break;
    const spanStart = Math.max(tier.fromKwh, cursor);
    const spanEnd = tier.toKwh ?? Infinity;
    const spanSize = Math.max(0, Math.min(spanEnd, totalKwh) - spanStart);
    if (spanSize <= 0) continue;
    const tierCost = spanSize * tier.ratePerKwh;
    cost += tierCost;
    breakdown.push({
      label: tier.label ?? `${tier.fromKwh}–${tier.toKwh ?? '∞'} kWh`,
      kwh: spanSize,
      ratePerKwh: tier.ratePerKwh,
      cost: roundMoney(tierCost),
    });
    remaining -= spanSize;
    cursor = spanEnd;
  }

  return { cost: roundMoney(cost), breakdown };
}

/** Map hour (0–23) and weekday to TOU band. Handles overnight bands (e.g. 22–09). */
export function resolveTouBand(
  hour: number,
  weekday: number,
  bands: TariffTouBand[],
): TariffTouBand | undefined {
  for (const band of bands) {
    if (band.weekdays?.length && !band.weekdays.includes(weekday)) continue;
    const { startHour, endHour } = band;
    if (startHour <= endHour) {
      if (hour >= startHour && hour < endHour) return band;
    } else if (hour >= startHour || hour < endHour) {
      return band;
    }
  }
  return bands[0];
}

/** Apply TOU rates to hourly kWh buckets. */
export function calculateTouCost(
  hourlyKwh: Map<number, number>,
  bands: TariffTouBand[],
  timezone = 'Asia/Bangkok',
): { cost: number; breakdown: TouBreakdownItem[] } {
  const bandTotals = new Map<string, TouBreakdownItem>();

  for (const [hourKey, kwh] of hourlyKwh) {
    if (kwh <= 0) continue;
    const hour = hourKey % 100;
    const weekday = Math.floor(hourKey / 100);
    const band = resolveTouBand(hour, weekday, bands);
    if (!band) continue;
    const existing = bandTotals.get(band.id);
    if (existing) {
      existing.kwh += kwh;
      existing.cost = roundMoney(existing.kwh * existing.ratePerKwh);
    } else {
      bandTotals.set(band.id, {
        bandId: band.id,
        label: band.label,
        kwh,
        ratePerKwh: band.ratePerKwh,
        cost: roundMoney(kwh * band.ratePerKwh),
      });
    }
  }

  const breakdown = [...bandTotals.values()];
  const cost = roundMoney(breakdown.reduce((s, b) => s + b.cost, 0));
  return { cost, breakdown };
}

export type HourlyConsumptionInput = {
  readAt: Date;
  deltaKwh: number;
  timezone?: string;
};

/** Build hour buckets (weekday*100+hour → kWh) from interval readings. */
export function buildHourlyKwhBuckets(readings: HourlyConsumptionInput[]): Map<number, number> {
  const buckets = new Map<number, number>();
  const tz = readings[0]?.timezone ?? 'Asia/Bangkok';

  for (const row of readings) {
    if (row.deltaKwh <= 0) continue;
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: 'numeric',
      weekday: 'short',
      hour12: false,
    }).formatToParts(row.readAt);
    const hour = Number(parts.find(p => p.type === 'hour')?.value ?? 0);
    const wdStr = parts.find(p => p.type === 'weekday')?.value ?? 'Mon';
    const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const weekday = weekdayMap[wdStr] ?? 1;
    const key = weekday * 100 + hour;
    buckets.set(key, (buckets.get(key) ?? 0) + row.deltaKwh);
  }
  return buckets;
}

export type ComputeBillInput = {
  tariff: EnergyTariffConfig;
  tariffName?: string;
  currency?: string;
  totalKwh: number;
  importKwh?: number;
  exportKwh?: number;
  peakDemandKw?: number;
  hourlyKwh?: Map<number, number>;
  carbonSummary: CarbonSummaryResult;
  devices: CarbonDeviceInput[];
  tags: CarbonTagInput[];
};

/** Full site bill with per-device allocation and all tariff modes. */
export function computeEnergyBill(input: ComputeBillInput): EnergyBillResult {
  const tariff = input.tariff;
  const currency = input.currency ?? tariff.currency ?? 'THB';
  const warnings: string[] = [];
  const totalKwh = Math.max(0, input.totalKwh);
  const peakDemandKw = Math.max(0, input.peakDemandKw ?? 0);

  let energyCost = 0;
  let touBreakdown: TouBreakdownItem[] = [];
  let tierBreakdown: TierBreakdownItem[] = [];

  const flatRate = tariff.flatRatePerKwh ?? 0;

  if (tariff.mode === 'flat' || (tariff.mode === 'combined' && !input.hourlyKwh?.size && !tariff.tiers?.length)) {
    energyCost = roundMoney(totalKwh * flatRate);
    touBreakdown = [{ bandId: 'flat', label: 'Flat rate', kwh: totalKwh, ratePerKwh: flatRate, cost: energyCost }];
  } else if (tariff.mode === 'tiered' || (tariff.mode === 'combined' && !input.hourlyKwh?.size)) {
    const tiers = tariff.tiers ?? DEFAULT_TIERED_TARIFF;
    const tiered = calculateTieredCost(totalKwh, tiers);
    energyCost = tiered.cost;
    tierBreakdown = tiered.breakdown;
  } else if (tariff.mode === 'tou' || (tariff.mode === 'combined' && input.hourlyKwh?.size)) {
    const bands = tariff.touBands ?? DEFAULT_THAILAND_TOU_BANDS;
    if (input.hourlyKwh?.size) {
      const tou = calculateTouCost(input.hourlyKwh, bands);
      energyCost = tou.cost;
      touBreakdown = tou.breakdown;
    } else {
      warnings.push('No hourly history for TOU — falling back to flat rate.');
      energyCost = roundMoney(totalKwh * flatRate);
    }
  }

  const demandCost = tariff.demandCharge
    ? roundMoney(peakDemandKw * tariff.demandCharge.ratePerKw)
    : 0;
  const fixedCost = roundMoney(tariff.fixedCharge ?? 0);
  const serviceCost = roundMoney(tariff.serviceCharge ?? 0);
  const subtotal = roundMoney(energyCost + demandCost + fixedCost + serviceCost);
  const vat = roundMoney(subtotal * ((tariff.vatPercent ?? 0) / 100));
  const grandTotal = roundMoney(subtotal + vat);

  const lineItems: BillLineItem[] = [];
  if (energyCost > 0) {
    lineItems.push({ category: 'energy', label: 'Energy charge', quantity: totalKwh, unit: 'kWh', amount: energyCost });
  }
  for (const t of tierBreakdown) {
    lineItems.push({
      category: 'energy',
      label: t.label,
      quantity: t.kwh,
      unit: 'kWh',
      unitPrice: t.ratePerKwh,
      amount: t.cost,
    });
  }
  for (const t of touBreakdown) {
    if (tariff.mode !== 'flat') {
      lineItems.push({
        category: 'energy',
        label: t.label,
        quantity: t.kwh,
        unit: 'kWh',
        unitPrice: t.ratePerKwh,
        amount: t.cost,
      });
    }
  }
  if (demandCost > 0) {
    lineItems.push({
      category: 'demand',
      label: tariff.demandCharge?.label ?? 'Demand charge',
      quantity: peakDemandKw,
      unit: 'kW',
      unitPrice: tariff.demandCharge?.ratePerKw,
      amount: demandCost,
    });
  }
  if (fixedCost > 0) {
    lineItems.push({ category: 'fixed', label: 'Fixed charge', amount: fixedCost });
  }
  if (serviceCost > 0) {
    lineItems.push({ category: 'service', label: 'Service charge', amount: serviceCost });
  }
  if (vat > 0) {
    lineItems.push({ category: 'vat', label: `VAT ${tariff.vatPercent ?? 0}%`, amount: vat });
  }

  const deviceBills = buildDeviceBills(
    input.devices,
    input.tags,
    input.carbonSummary,
    energyCost,
    totalKwh,
    peakDemandKw,
    tariff,
  );

  return {
    currency,
    tariffName: input.tariffName ?? 'Default',
    tariffMode: tariff.mode,
    totalKwh,
    importKwh: input.importKwh ?? input.carbonSummary.importKwh,
    exportKwh: input.exportKwh ?? input.carbonSummary.exportKwh,
    peakDemandKw,
    energyCost,
    demandCost,
    fixedCost,
    serviceCost,
    subtotal,
    vat,
    grandTotal,
    lineItems,
    devices: deviceBills,
    touBreakdown,
    tierBreakdown,
    warnings,
  };
}

function buildDeviceBills(
  devices: CarbonDeviceInput[],
  tags: CarbonTagInput[],
  summary: CarbonSummaryResult,
  siteEnergyCost: number,
  siteTotalKwh: number,
  sitePeakKw: number,
  tariff: EnergyTariffConfig,
): DeviceBillItem[] {
  const contribById = new Map(summary.devices.map(d => [d.deviceId, d]));
  const items: DeviceBillItem[] = [];

  for (const device of devices) {
    const mapping = resolveDeviceEnergyMapping(device);
    if (mapping.role === 'excluded' || mapping.role === 'monitoring') continue;

    const contrib = contribById.get(device.id);
    const deviceTags = tags.filter(t => t.deviceId === device.id);
    const parts = contrib ?? {
      deviceId: device.id,
      deviceName: device.name,
      role: mapping.role,
      importKwh: 0,
      exportKwh: 0,
      netKwh: 0,
      qualifiedKwh: computeDeviceQualifiedKwh(deviceTags, {
        netMetering: summary.netMetering,
        fallbackKwh: summary.strategy === 'fallback_all_kwh',
      }).qualifiedKwh,
    };

    const kwh = parts.qualifiedKwh;
    if (kwh <= 0 && mapping.role !== 'sub_meter') continue;

    let energyCost: number;
    if (siteTotalKwh > 0 && mapping.role === 'site_main') {
      energyCost = siteEnergyCost;
    } else if (tariff.mode === 'flat') {
      energyCost = roundMoney(kwh * (tariff.flatRatePerKwh ?? 0));
    } else if (tariff.mode === 'tiered') {
      energyCost = calculateTieredCost(kwh, tariff.tiers ?? DEFAULT_TIERED_TARIFF).cost;
    } else {
      energyCost = roundMoney(siteTotalKwh > 0 ? (kwh / siteTotalKwh) * siteEnergyCost : 0);
    }

    const powerTags = deviceTags.filter(t => {
      const role = normalizeTagEnergyRole(t.energyTagRole);
      if (role === 'power_kw') return true;
      const unit = String(t.unit ?? '').toLowerCase();
      return unit === 'kw' || unit === 'kW'.toLowerCase();
    });
    const demandKw = mapping.role === 'site_main' ? sitePeakKw : 0;
    const demandCost = tariff.demandCharge && demandKw > 0 && mapping.role === 'site_main'
      ? roundMoney(demandKw * tariff.demandCharge.ratePerKw)
      : 0;

    items.push({
      deviceId: device.id,
      deviceName: device.name,
      role: mapping.role,
      loadCategory: mapping.loadCategory || 'unspecified',
      kwh,
      sharePct: siteTotalKwh > 0 ? roundMoney((kwh / siteTotalKwh) * 100) : 0,
      energyCost,
      demandKw: demandKw || undefined,
      demandCost: demandCost || undefined,
      subtotal: roundMoney(energyCost + demandCost),
    });
  }

  return items.sort((a, b) => b.kwh - a.kwh);
}

/** Resolve peak demand kW from power tags and optional history maxima. */
export function resolvePeakDemandKw(
  tags: CarbonTagInput[],
  livePeakByTag?: Map<string, number>,
): number {
  let peak = 0;
  for (const tag of tags) {
    const role = normalizeTagEnergyRole(tag.energyTagRole);
    const unit = String(tag.unit ?? '').toLowerCase();
    const isPower = role === 'power_kw' || unit === 'kw';
    if (!isPower) continue;
    const live = livePeakByTag?.get(tag.id);
    const current = Number(tag.currentValue);
    const val = live ?? (Number.isFinite(current) ? current : 0);
    peak = Math.max(peak, val);
  }
  return peak;
}
