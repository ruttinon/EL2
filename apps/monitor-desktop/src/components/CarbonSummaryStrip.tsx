import type { CarbonSummaryResponse } from '../api/engineApi';

function strategyLabel(strategy?: CarbonSummaryResponse['strategy']) {
  if (strategy === 'site_main') return 'Main meter';
  if (strategy === 'include_in_carbon') return 'Included meters';
  return 'Fallback (all kWh)';
}

type CarbonSummaryStripProps = {
  carbonSummary?: CarbonSummaryResponse;
};

export function CarbonSummaryStrip({ carbonSummary }: CarbonSummaryStripProps) {
  if (!carbonSummary) return null;

  const currency = carbonSummary.currency ?? 'THB';
  const costRate = carbonSummary.energyCostRate ?? 0;
  const estimatedCost =
    carbonSummary.estimatedEnergyCost ??
    (costRate > 0 ? carbonSummary.kWhQualified * costRate : null);

  const chips: Array<{ label: string; value: string }> = [
    { label: 'Import', value: `${carbonSummary.importKwh.toFixed(1)} kWh` },
    { label: 'Export', value: `${carbonSummary.exportKwh.toFixed(1)} kWh` },
    { label: 'Net', value: `${carbonSummary.netKwh.toFixed(1)} kWh` },
    { label: 'Qualified', value: `${carbonSummary.kWhQualified.toFixed(1)} kWh` },
    { label: 'CO₂e', value: `${carbonSummary.carbonKg.toFixed(1)} kg` },
    { label: 'Strategy', value: strategyLabel(carbonSummary.strategy) },
  ];

  if (carbonSummary.carbonIntensityKgPerM2 != null) {
    chips.push({
      label: 'Intensity',
      value: `${carbonSummary.carbonIntensityKgPerM2.toFixed(2)} kg/m²`,
    });
  }

  if (estimatedCost != null && estimatedCost > 0) {
    chips.push({
      label: 'Est. cost',
      value: `${estimatedCost.toFixed(2)} ${currency}`,
    });
  }

  return (
    <div className="carbon-summary-strip" role="group" aria-label="Carbon summary details">
      {chips.map(chip => (
        <div key={chip.label} className="carbon-summary-chip">
          <span>{chip.label}</span>
          <b>{chip.value}</b>
        </div>
      ))}
    </div>
  );
}
