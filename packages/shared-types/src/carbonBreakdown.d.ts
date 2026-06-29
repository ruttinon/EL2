import type { CarbonDeviceContribution, CarbonDeviceInput, CarbonSummaryResult, CarbonTagInput } from './carbonCalculation.js';
export type CarbonBreakdownBy = 'loadCategory' | 'device' | 'source';
export type CarbonBreakdownItem = {
    key: string;
    label: string;
    deviceId?: string;
    kWh: number;
    carbonKg: number;
    sharePct: number;
};
export type CarbonBreakdownResult = {
    by: CarbonBreakdownBy;
    items: CarbonBreakdownItem[];
    totalKwh: number;
    totalCarbonKg: number;
    emissionFactorKgPerKwh: number;
};
/** Breakdown for sub-meters / devices — avoids duplicating site_main total in category view. */
export declare function computeCarbonBreakdown(devices: CarbonDeviceInput[], contributions: CarbonDeviceContribution[], emissionFactorKgPerKwh: number, by: CarbonBreakdownBy, strategy: CarbonSummaryResult['strategy'], tags?: CarbonTagInput[], netMetering?: boolean): CarbonBreakdownResult;
