/** Default grid emission factor (kg CO₂ per kWh) — Thailand average approx. */
export const DEFAULT_EMISSION_KG_PER_KWH = 0.45;

export type SustainabilityInput = {
  energyKwh: number;
  peakDemandKw: number;
  currentPowerKw: number;
  emissionFactorKgPerKwh?: number;
  /** When provided (e.g. from Engine carbon API), overrides energyKwh * factor. */
  carbonEmittedKg?: number;
};

export type SustainabilityMetrics = {
  emissionFactorKgPerKwh: number;
  peakSavingsPct: number;
  baselineKwh: number;
  savedKwh: number;
  carbonEmittedKg: number;
  carbonEmittedTons: number;
  carbonSavedKg: number;
  carbonSavedTons: number;
  treesEquivalent: number;
  energyCostSaved: number;
};

/** ~21 kg CO₂ absorbed per tree per year (rough visual equivalent). */
const KG_CO2_PER_TREE_YEAR = 21;
const DEFAULT_COST_PER_KWH = 0.12;

export function computeSustainabilityMetrics(input: SustainabilityInput): SustainabilityMetrics {
  const factor = input.emissionFactorKgPerKwh ?? DEFAULT_EMISSION_KG_PER_KWH;
  const energyKwh = Math.max(0, input.energyKwh);
  const peakDemandKw = Math.max(0, input.peakDemandKw);
  const currentPowerKw = Math.max(0, input.currentPowerKw);

  const peakSavingsPct =
    peakDemandKw > 0 ? Math.max(0, ((peakDemandKw - currentPowerKw) / peakDemandKw) * 100) : 0;

  let baselineKwh = energyKwh;
  if (peakSavingsPct > 0 && peakSavingsPct < 99.5) {
    baselineKwh = energyKwh / (1 - peakSavingsPct / 100);
  } else if (energyKwh === 0 && peakDemandKw > 0) {
    baselineKwh = peakDemandKw * 0.25;
  }

  const savedKwh = Math.max(0, baselineKwh - energyKwh);
  const carbonEmittedKg =
    input.carbonEmittedKg != null && Number.isFinite(input.carbonEmittedKg)
      ? Math.max(0, input.carbonEmittedKg)
      : energyKwh * factor;
  const carbonSavedKg = savedKwh * factor;

  return {
    emissionFactorKgPerKwh: factor,
    peakSavingsPct,
    baselineKwh,
    savedKwh,
    carbonEmittedKg,
    carbonEmittedTons: carbonEmittedKg / 1000,
    carbonSavedKg,
    carbonSavedTons: carbonSavedKg / 1000,
    treesEquivalent: carbonSavedKg / KG_CO2_PER_TREE_YEAR,
    energyCostSaved: savedKwh * DEFAULT_COST_PER_KWH,
  };
}
