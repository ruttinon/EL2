export type CarbonPeriod = 'live' | 'today' | '7d' | '30d';

const OPTIONS: Array<{ value: CarbonPeriod; label: string }> = [
  { value: 'live', label: 'Live' },
  { value: 'today', label: 'Today' },
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
];

type CarbonPeriodPickerProps = {
  value: CarbonPeriod;
  onChange: (period: CarbonPeriod) => void;
  dataSource?: 'live' | 'history';
  compact?: boolean;
};

export function CarbonPeriodPicker({ value, onChange, dataSource, compact }: CarbonPeriodPickerProps) {
  return (
    <div className={`carbon-period-picker${compact ? ' carbon-period-picker--compact' : ''}`}>
      {!compact && <span className="carbon-period-label">Carbon period</span>}
      <div className="carbon-period-options">
        {OPTIONS.map(opt => (
          <button
            key={opt.value}
            type="button"
            className={`carbon-period-btn${value === opt.value ? ' active' : ''}`}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {!compact && dataSource && value !== 'live' && (
        <span className="carbon-period-source">{dataSource === 'history' ? 'from history' : 'live fallback'}</span>
      )}
    </div>
  );
}
