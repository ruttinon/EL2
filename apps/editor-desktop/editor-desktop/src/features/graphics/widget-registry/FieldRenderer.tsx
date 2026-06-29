import type { InspectorFieldDef } from '@energylink/widget-registry';
import type { TagSummary } from '@energylink/shared-types';
import { hexForColorInput } from '../colorInput';

import { CustomCombobox } from './CustomCombobox';

export type FieldRendererProps = {
  field: InspectorFieldDef;
  value: unknown;
  tagOptions: TagSummary[];
  onChange: (value: unknown) => void;
};

export function FieldRenderer({ field, value, tagOptions, onChange }: FieldRendererProps) {
  const label = field.label;

  if (field.type === 'toggle') {
    return (
      <label className="ins-row ins-check">
        <input type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />
        <span>{label}</span>
      </label>
    );
  }

  if (field.type === 'tag') {
    return (
      <label className="ins-row">
        <span>{label}</span>
        <select value={String(value ?? '')} onChange={(e) => onChange(e.target.value || undefined)}>
          <option value="">— Select Tag —</option>
          {tagOptions.map((t) => (
            <option key={t.id} value={t.id}>{t.name ?? t.id}</option>
          ))}
        </select>
      </label>
    );
  }

  if (field.type === 'color') {
    const hex = hexForColorInput(typeof value === 'string' ? value : '#000000', '#000000');
    return (
      <label className="ins-row">
        <span>{label}</span>
        <input type="color" value={hex} onChange={(e) => onChange(e.target.value)} />
      </label>
    );
  }

  if (field.type === 'number') {
    return (
      <label className="ins-row">
        <span>{label}</span>
        <input
          type="number"
          value={typeof value === 'number' ? value : Number(value ?? 0)}
          min={field.min}
          max={field.max}
          step={field.step}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      </label>
    );
  }

  if (field.type === 'segmented' && field.options) {
    return (
      <div className="ins-row">
        <span>{label}</span>
        <div className="ins-seg">
          {field.options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={value === opt.value ? 'active' : ''}
              onClick={() => onChange(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (field.type === 'select' && field.options) {
    return (
      <label className="ins-row">
        <span>{label}</span>
        <select value={String(value ?? '')} onChange={(e) => onChange(e.target.value)}>
          {field.options.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </label>
    );
  }

  if (field.type === 'combobox' && field.options) {
    return (
      <label className="ins-row">
        <span>{label}</span>
        <CustomCombobox 
          value={String(value ?? '')} 
          onChange={onChange} 
          options={field.options} 
          placeholder={field.placeholder} 
        />
      </label>
    );
  }

  return (
    <label className="ins-row">
      <span>{label}</span>
      <input
        type="text"
        value={String(value ?? '')}
        placeholder={field.placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      {field.help ? <small className="ins-hint">{field.help}</small> : null}
    </label>
  );
}
