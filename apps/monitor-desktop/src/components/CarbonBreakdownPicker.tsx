export type CarbonBreakdownBy = 'loadCategory' | 'device' | 'source';

const OPTIONS: Array<{ value: CarbonBreakdownBy; label: string }> = [
  { value: 'loadCategory', label: 'Load category' },
  { value: 'device', label: 'Device' },
  { value: 'source', label: 'Source' },
];

type CarbonBreakdownPickerProps = {
  value: CarbonBreakdownBy;
  onChange: (by: CarbonBreakdownBy) => void;
};

export function CarbonBreakdownPicker({ value, onChange }: CarbonBreakdownPickerProps) {
  return (
    <div className="carbon-breakdown-picker">
      <span className="carbon-breakdown-picker-label">Breakdown by</span>
      <div className="carbon-breakdown-picker-options">
        {OPTIONS.map(opt => (
          <button
            key={opt.value}
            type="button"
            className={`carbon-breakdown-btn${value === opt.value ? ' active' : ''}`}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
