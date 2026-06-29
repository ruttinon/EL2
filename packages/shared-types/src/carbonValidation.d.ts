import type { CarbonDeviceInput, CarbonSummaryResult, CarbonTagInput } from './carbonCalculation.js';
export type CarbonConfigIssue = {
    code: 'no_main_meter' | 'using_fallback' | 'no_import_tag' | 'unmapped_kwh_tags' | 'meters_offline' | 'zero_kwh_reading';
    severity: 'error' | 'warning' | 'info';
    message: string;
    messageTh: string;
};
export type CarbonValidationInput = {
    devices: CarbonDeviceInput[];
    tags: CarbonTagInput[];
    strategy: CarbonSummaryResult['strategy'];
    kWhQualified: number;
    /** tagId → quality (good, bad, unknown) */
    tagQuality?: Record<string, string | null | undefined>;
};
export declare function validateCarbonConfig(input: CarbonValidationInput): CarbonConfigIssue[];
/** Suggest primary import kWh tag name for a meter wizard. */
export declare function suggestPrimaryImportTagName(tags: Array<{
    name: string;
    unit?: string | null;
}>): string;
