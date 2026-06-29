import { Leaf } from 'lucide-react';
import { UiIcon } from './UiIcon';
import { useAnimatedNumber } from '../hooks/useAnimatedNumber';
import { CarbonPeriodPicker, type CarbonPeriod } from './CarbonPeriodPicker';
import type { CarbonSummaryResponse } from '../api/engineApi';

type CarbonOverviewCardProps = {
  carbonSummary?: CarbonSummaryResponse;
  carbonPeriod: CarbonPeriod;
  onPeriodChange: (period: CarbonPeriod) => void;
};

export function CarbonOverviewCard({
  carbonSummary,
  carbonPeriod,
  onPeriodChange,
}: CarbonOverviewCardProps) {
  const hasData = carbonSummary != null;
  const kwh = carbonSummary?.kWhQualified ?? 0;
  const carbonKg = carbonSummary?.carbonKg ?? 0;
  const factor = carbonSummary?.emissionFactorKgPerKwh;
  const animatedKwh = useAnimatedNumber(kwh, 400, 0.1);
  const animatedCarbon = useAnimatedNumber(carbonKg, 400, 0.1);
  const dataSource = carbonSummary?.dataSource;

  return (
    <section className={`carbon-overview-card card${hasData ? '' : ' carbon-overview-card--empty'}`}>
      <div className="carbon-overview-head">
        <div className="carbon-overview-title-wrap">
          <UiIcon icon={Leaf} size="md" className="carbon-overview-icon" />
          <h2 className="carbon-overview-title">Carbon</h2>
          {dataSource && (
            <span className="carbon-overview-source">
              {dataSource === 'history' ? 'from history' : 'live meters'}
            </span>
          )}
        </div>
        <CarbonPeriodPicker
          value={carbonPeriod}
          onChange={onPeriodChange}
          dataSource={dataSource}
          compact
        />
      </div>
      {!hasData ? (
        <p className="carbon-overview-empty">
          No meter data yet — connect devices and start live polling.
        </p>
      ) : (
        <div className="carbon-overview-metrics">
          <div className="carbon-overview-metric">
            <span>Energy</span>
            <b>{animatedKwh.toFixed(1)}</b>
            <small>kWh</small>
          </div>
          <div className="carbon-overview-metric carbon-overview-metric--primary">
            <span>CO₂e</span>
            <b>{animatedCarbon.toFixed(1)}</b>
            <small>kg</small>
          </div>
          <div className="carbon-overview-metric">
            <span>Factor</span>
            <b>{factor != null ? factor.toFixed(2) : '—'}</b>
            <small>kg/kWh</small>
          </div>
        </div>
      )}
    </section>
  );
}
