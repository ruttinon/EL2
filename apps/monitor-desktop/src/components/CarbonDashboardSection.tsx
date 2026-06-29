import { CarbonOverviewCard } from './CarbonOverviewCard';
import { CarbonLoadBreakdown } from './CarbonLoadBreakdown';
import type { CarbonPeriod } from './CarbonPeriodPicker';
import type { CarbonBreakdownResponse, CarbonSummaryResponse } from '../api/engineApi';

type CarbonDashboardSectionProps = {
  carbonSummary?: CarbonSummaryResponse;
  carbonBreakdown?: CarbonBreakdownResponse;
  carbonPeriod: CarbonPeriod;
  onPeriodChange: (period: CarbonPeriod) => void;
  loading?: boolean;
};

export function CarbonDashboardSection({
  carbonSummary,
  carbonBreakdown,
  carbonPeriod,
  onPeriodChange,
  loading,
}: CarbonDashboardSectionProps) {
  return (
    <section className="carbon-dashboard-section">
      <div className="carbon-section-grid">
        <CarbonOverviewCard
          carbonSummary={carbonSummary}
          carbonPeriod={carbonPeriod}
          onPeriodChange={onPeriodChange}
        />
        <CarbonLoadBreakdown breakdown={carbonBreakdown} loading={loading} />
      </div>
    </section>
  );
}
