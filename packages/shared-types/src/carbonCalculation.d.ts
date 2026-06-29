import type { DeviceEnergyMapping } from './deviceEnergyMapping.js';
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
export declare function computeDeviceQualifiedKwh(deviceTags: CarbonTagInput[], options: {
    netMetering: boolean;
    fallbackKwh?: boolean;
}): Pick<CarbonDeviceContribution, 'importKwh' | 'exportKwh' | 'netKwh' | 'qualifiedKwh'>;
export declare function selectCarbonDeviceIds(devices: CarbonDeviceInput[]): {
    ids: Set<string>;
    strategy: CarbonSummaryResult['strategy'];
};
export declare function computeCarbonSummary(input: CarbonSummaryInput): CarbonSummaryResult;
