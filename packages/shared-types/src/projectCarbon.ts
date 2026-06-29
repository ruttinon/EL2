/** Project-level carbon / sustainability configuration. */

export type FacilityType =
  | 'factory'
  | 'office'
  | 'retail'
  | 'hospital'
  | 'data_center'
  | 'mixed'
  | 'other';

/** Thailand grid average — used when project has no custom factor. */
export const DEFAULT_EMISSION_FACTOR_KG_PER_KWH = 0.45;

export type ProjectCarbonProfile = {
  facilityType: FacilityType;
  emissionFactorKgPerKwh: number;
  netMetering: boolean;
  floorAreaM2?: number | null;
};

export const FACILITY_TYPE_OPTIONS: Array<{ value: FacilityType; label: string }> = [
  { value: 'factory', label: 'Factory / industrial' },
  { value: 'office', label: 'Office building' },
  { value: 'retail', label: 'Retail / mall' },
  { value: 'hospital', label: 'Hospital' },
  { value: 'data_center', label: 'Data center' },
  { value: 'mixed', label: 'Mixed use' },
  { value: 'other', label: 'Other' },
];

export function normalizeProjectCarbonProfile(
  input?: Partial<ProjectCarbonProfile> | null,
): ProjectCarbonProfile {
  const facilityType = (input?.facilityType as FacilityType) || 'mixed';
  const factor = Number(input?.emissionFactorKgPerKwh);
  const floor = input?.floorAreaM2;
  return {
    facilityType: FACILITY_TYPE_OPTIONS.some(o => o.value === facilityType) ? facilityType : 'mixed',
    emissionFactorKgPerKwh:
      Number.isFinite(factor) && factor >= 0 ? factor : DEFAULT_EMISSION_FACTOR_KG_PER_KWH,
    netMetering: Boolean(input?.netMetering),
    floorAreaM2:
      floor === null || floor === undefined
        ? null
        : Number.isFinite(Number(floor)) && Number(floor) > 0
          ? Number(floor)
          : null,
  };
}
