/** Project-level carbon / sustainability configuration. */
export type FacilityType = 'factory' | 'office' | 'retail' | 'hospital' | 'data_center' | 'mixed' | 'other';
/** Thailand grid average — used when project has no custom factor. */
export declare const DEFAULT_EMISSION_FACTOR_KG_PER_KWH = 0.45;
export type ProjectCarbonProfile = {
    facilityType: FacilityType;
    emissionFactorKgPerKwh: number;
    netMetering: boolean;
    floorAreaM2?: number | null;
};
export declare const FACILITY_TYPE_OPTIONS: Array<{
    value: FacilityType;
    label: string;
}>;
export declare function normalizeProjectCarbonProfile(input?: Partial<ProjectCarbonProfile> | null): ProjectCarbonProfile;
