import type { CarbonSummaryResult } from './carbonCalculation.js';
import type { CarbonDeviceInput, CarbonTagInput } from './carbonCalculation.js';
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
export declare const DEFAULT_THAILAND_TOU_BANDS: TariffTouBand[];
export declare const DEFAULT_TIERED_TARIFF: TariffTier[];
export declare function normalizeTariffConfig(raw: unknown, fallbackRate?: number): EnergyTariffConfig;
/** Apply block/tier pricing to total kWh. */
export declare function calculateTieredCost(totalKwh: number, tiers: TariffTier[]): {
    cost: number;
    breakdown: TierBreakdownItem[];
};
/** Map hour (0–23) and weekday to TOU band. Handles overnight bands (e.g. 22–09). */
export declare function resolveTouBand(hour: number, weekday: number, bands: TariffTouBand[]): TariffTouBand | undefined;
/** Apply TOU rates to hourly kWh buckets. */
export declare function calculateTouCost(hourlyKwh: Map<number, number>, bands: TariffTouBand[], timezone?: string): {
    cost: number;
    breakdown: TouBreakdownItem[];
};
export type HourlyConsumptionInput = {
    readAt: Date;
    deltaKwh: number;
    timezone?: string;
};
/** Build hour buckets (weekday*100+hour → kWh) from interval readings. */
export declare function buildHourlyKwhBuckets(readings: HourlyConsumptionInput[]): Map<number, number>;
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
export declare function computeEnergyBill(input: ComputeBillInput): EnergyBillResult;
/** Resolve peak demand kW from power tags and optional history maxima. */
export declare function resolvePeakDemandKw(tags: CarbonTagInput[], livePeakByTag?: Map<string, number>): number;
