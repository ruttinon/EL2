import React from 'react';
import type { DeviceSummary, ReportObjectDefinition, TagSummary } from '@energylink/shared-types';
import type { ReportToolSettingField } from './reportSettingTypes';
import { getPresetsForTool } from './reportSettingPresets';
import { mapObjectToSettings, mapSettingsToObject } from './reportSettingMapper';
import { getReportToolSettingsSchema } from './reportToolSettingsRegistry';
import { Icon } from '@iconify/react';
import { getExportSupport } from '../reportExportSupportMatrix';
import {
  validateReportObjectSettings,
  type ReportObjectValidationIssue,
  type ReportSettingCompletenessState,
} from './reportSettingValidator';

const SECTION_LABELS: Record<string, string> = {
  general: 'ข้อมูลเบื้องต้น (Basic)',
  binding: 'แหล่งข้อมูล (Data Source)',
  calculation: 'การคำนวณสูตร (Calculation)',
  data: 'ตัวเลือกข้อมูล (Data Options)',
  style: 'การตกแต่ง (Appearance)',
  table: 'การตั้งค่าตาราง (Table)',
  chart: 'การตั้งค่ากราฟ (Chart)',
  billing: 'การคิดค่าไฟ (Billing)',
  behavior: 'พฤติกรรม (Behavior)',
  export: 'การส่งออก (Export)',
  advanced: 'ขั้นสูง (Advanced)',
};

const SECTION_ORDER = [
  'general',
  'binding',
  'data',
  'style',
  'table',
  'chart',
  'billing',
  'behavior',
  'export',
  'advanced',
] as const;

function fieldIssuesFor(
  issues: ReportObjectValidationIssue[],
  fieldKey: string,
) {
  return issues.filter((issue) => issue.field === fieldKey);
}

function fieldValue(field: ReportToolSettingField, settings: Record<string, unknown>) {
  const value = settings[field.key];

  if (field.type === 'boolean') {
    return Boolean(value ?? field.defaultValue ?? false);
  }

  if (field.type === 'multiTagPicker') {
    return normalizeStringArray(value ?? field.defaultValue ?? []);
  }

  if (field.type === 'columnBuilder') {
    return normalizeStringArray(value ?? field.defaultValue ?? []);
  }

  if (value !== undefined && value !== null) return value;
  return field.defaultValue ?? '';
}

const STATUS_META: Record<
  ReportSettingCompletenessState,
  { label: string; background: string; color: string; border: string }
> = {
  ready: {
    label: 'Ready',
    background: '#ecfdf5',
    color: '#166534',
    border: '#86efac',
  },
  missingBinding: {
    label: 'Missing Binding',
    background: '#eff6ff',
    color: '#1d4ed8',
    border: '#93c5fd',
  },
  missingRequiredSetting: {
    label: 'Missing Required Setting',
    background: '#fff7ed',
    color: '#c2410c',
    border: '#fdba74',
  },
  warning: {
    label: 'Warning',
    background: '#fffbeb',
    color: '#a16207',
    border: '#fcd34d',
  },
  error: {
    label: 'Error',
    background: '#fef2f2',
    color: '#b91c1c',
    border: '#fca5a5',
  },
};

const BINDING_KEYS = new Set([
  'tag',
  'tagIds',
  'selectedTags',
  'device',
  'deviceScope',
  'meterScope',
  'meter',
  'energyTag',
  'variableA',
  'variableB',
  'variableC',
  'variableD',
]);

function fieldIsVisible(field: ReportToolSettingField, settings: Record<string, unknown>) {
  if (!field.visibleWhen) return true;
  return Object.entries(field.visibleWhen).every(([key, expected]) => settings[key] === expected);
}

function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item)).filter(Boolean);
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
  }
  return [];
}

function isColorValue(value: string): boolean {
  return /^#[\da-f]{6}$/i.test(value) || /^#[\da-f]{3}$/i.test(value);
}

function buildSettingsWithDefaults(
  schema: ReturnType<typeof getReportToolSettingsSchema>,
  object: ReportObjectDefinition,
) {
  const settings = mapObjectToSettings(object);
  if (!schema) return settings;

  for (const sectionKey of SECTION_ORDER) {
    const fields = schema[sectionKey];
    if (!fields) continue;
    for (const field of fields) {
      if (settings[field.key] === undefined && field.defaultValue !== undefined) {
        settings[field.key] = field.defaultValue;
      }
    }
  }

  return settings;
}

function buildDefaultSettings(
  schema: NonNullable<ReturnType<typeof getReportToolSettingsSchema>>,
) {
  const defaults: Record<string, unknown> = {};
  for (const sectionKey of SECTION_ORDER) {
    const fields = schema[sectionKey];
    if (!fields) continue;
    for (const field of fields) {
      if (field.defaultValue !== undefined) {
        defaults[field.key] = field.defaultValue;
      }
    }
  }
  return defaults;
}

function ColumnBuilderEditor({ value, onChange }: { value: string[]; onChange: (val: string[]) => void }) {
  const allColumns = [
    'No.', 'Meter Name', 'Device Name', 'Tag Name', 'Register Address',
    'First Reading', 'Last Reading', 'Usage', 'CT Ratio', 'Multiplier',
    'Rate', 'Amount', 'Service Charge', 'VAT', 'Total', 'Remark'
  ];

  const selected = value.filter(c => allColumns.includes(c));

  const handleToggle = (col: string) => {
    if (value.includes(col)) {
      onChange(value.filter(c => c !== col));
    } else {
      onChange([...value, col]);
    }
  };

  const handleMove = (index: number, direction: 'up' | 'down') => {
    const next = [...value];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex >= 0 && targetIndex < next.length) {
      const temp = next[index];
      next[index] = next[targetIndex];
      next[targetIndex] = temp;
      onChange(next);
    }
  };

  return (
    <div style={{ border: '1px solid #cbd5e1', borderRadius: 4, padding: 8, background: '#f8fafc', gridColumn: '1 / -1', marginTop: 4 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px 12px', maxHeight: 150, overflowY: 'auto', padding: 4 }}>
        {allColumns.map(col => {
          const isChecked = value.includes(col);
          return (
            <label key={col} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer', userSelect: 'none' }}>
              <input type="checkbox" checked={isChecked} onChange={() => handleToggle(col)} />
              <span>{col}</span>
            </label>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        <button type="button" className="btn secondary extra-small-btn" style={{ padding: '2px 6px', fontSize: 10 }} onClick={() => onChange(allColumns)}>Select All</button>
        <button type="button" className="btn secondary extra-small-btn" style={{ padding: '2px 6px', fontSize: 10 }} onClick={() => onChange([])}>Clear</button>
        <button type="button" className="btn secondary extra-small-btn" style={{ padding: '2px 6px', fontSize: 10 }} onClick={() => onChange(['No.', 'Meter Name', 'First Reading', 'Last Reading', 'Usage', 'Total'])}>Reset</button>
      </div>
      {selected.length > 0 && (
        <div style={{ marginTop: 8, borderTop: '1px solid #e2e8f0', paddingTop: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 4 }}>จัดเรียงลำดับคอลัมน์ (Order Columns):</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {selected.map((col, index) => (
              <div key={col} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 4, padding: '2px 6px', fontSize: 12 }}>
                <span>{col}</span>
                <div style={{ display: 'flex', gap: 2 }}>
                  <button type="button" disabled={index === 0} onClick={() => handleMove(index, 'up')} style={{ padding: '0 6px', fontSize: 10, cursor: 'pointer' }}>▲</button>
                  <button type="button" disabled={index === selected.length - 1} onClick={() => handleMove(index, 'down')} style={{ padding: '0 6px', fontSize: 10, cursor: 'pointer' }}>▼</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CalculationPreviewPane({
  object,
  settings,
  tags,
  devices,
  periodContext
}: {
  object: ReportObjectDefinition;
  settings: Record<string, unknown>;
  tags: TagSummary[];
  devices: DeviceSummary[];
  periodContext?: any;
}) {
  const isNumeric = ['value', 'kpicard', 'formulavalue', 'energy_summary', 'cost_summary'].includes(object.type);
  if (!isNumeric) return null;

  const cb = object.props?.calculationBinding ?? {};
  const tagId = String(settings.tag || settings.tagId || cb.tagId || '');
  const meterId = String(settings.meter || settings.meterId || cb.meterId || '');
  const period = String(settings.period || cb.period || 'today');

  const selectedTag = tags.find(t => t.id === tagId);
  const selectedMeter = devices.find(d => d.id === meterId);

  const tagSum = periodContext?.tagSummaries?.get(tagId);

  const ctRatio = Number(settings.ctRatio ?? cb.ctRatio ?? 1);
  const ptRatio = Number(settings.ptRatio ?? cb.ptRatio ?? 1);
  const multiplier = Number(settings.multiplier ?? cb.multiplier ?? 1);
  const scale = Number(settings.scale ?? cb.scale ?? 1);
  const offset = Number(settings.offset ?? cb.offset ?? 0);

  const first = tagSum?.firstValue ?? null;
  const last = tagSum?.lastValue ?? null;

  let rawValue: number | null = null;
  let finalValue: number | null = null;
  let calcExplain = '';

  const calcType = settings.calculationType ?? cb.calculationType ?? 'cumulative_delta';
  
  if (calcType === 'cumulative_delta') {
    if (first != null && last != null) {
      const diff = last - first;
      rawValue = diff;
      finalValue = diff * ctRatio * ptRatio * multiplier * scale + offset;
      calcExplain = `(${last.toFixed(2)} - ${first.toFixed(2)}) * CT:${ctRatio} * PT:${ptRatio} * Multiplier:${multiplier} * Scale:${scale} + Offset:${offset}`;
    } else {
      calcExplain = 'History values not found in this range.';
    }
  } else {
    const metricVal = tagSum ? tagSum[`${calcType}Value`] ?? tagSum.lastValue : null;
    if (metricVal != null) {
      rawValue = metricVal;
      finalValue = metricVal * ctRatio * ptRatio * multiplier * scale + offset;
      calcExplain = `${calcType} (${metricVal.toFixed(2)}) * CT:${ctRatio} * PT:${ptRatio} * Multiplier:${multiplier} * Scale:${scale} + Offset:${offset}`;
    } else {
      calcExplain = 'Values not resolved.';
    }
  }

  if (object.type === 'formulavalue' && settings.formula) {
    calcExplain = `Formula: ${settings.formula}`;
  }

  return (
    <section className="ins-sec" style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 6, padding: 12, marginBottom: 12 }}>
      <div className="ins-sec-head" style={{ marginBottom: 8 }}>
        <h4 style={{ color: '#0369a1', display: 'flex', alignItems: 'center', gap: 6, margin: 0, fontSize: 13 }}>
          <Icon icon="solar:calculator-bold-duotone" width="16" height="16" />
          การคำนวณจำลอง (Calculation Preview)
        </h4>
      </div>
      <div style={{ display: 'grid', gap: 6, fontSize: 12, color: '#0c4a6e' }}>
        <div><strong>มิเตอร์ (Meter):</strong> {selectedMeter?.name || meterId || 'ยังไม่ได้เลือก'}</div>
        <div><strong>รีจิสเตอร์ (Register):</strong> {selectedTag?.name || tagId || 'ยังไม่ได้เลือก'} {selectedTag?.unit ? `(${selectedTag.unit})` : ''}</div>
        <div><strong>Role:</strong> {String(settings.energyRole || cb.energyRole || 'ไม่มี')}</div>
        <div><strong>ช่วงเวลา (Period):</strong> {period}</div>
        <div style={{ borderTop: '1px dashed #bae6fd', marginTop: 4, paddingTop: 4 }}>
          <div>ค่าแรก (First Value): {first != null ? first.toFixed(2) : '—'}</div>
          <div>ค่าหลัง (Last Value): {last != null ? last.toFixed(2) : '—'}</div>
          <div>ส่วนต่างดิบ (Raw Usage): {rawValue != null ? rawValue.toFixed(2) : '—'}</div>
        </div>
        <div style={{ background: '#e0f2fe', borderRadius: 4, padding: 6, marginTop: 4 }}>
          <div><strong>วิธีคำนวณ:</strong> <code style={{ fontSize: 10, wordBreak: 'break-all' }}>{calcExplain}</code></div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#0369a1', marginTop: 4 }}>
            ผลลัพธ์: {finalValue != null ? finalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'} {String(settings.unit || selectedTag?.unit || '')}
          </div>
        </div>
      </div>
    </section>
  );
}

type ReportToolSettingsInspectorProps = {
  object: ReportObjectDefinition;
  tags: TagSummary[];
  devices: DeviceSummary[];
  onPatch: (patch: Partial<ReportObjectDefinition>) => void;
  periodContext?: any;
};

export function ReportToolSettingsInspector({
  object,
  tags,
  devices,
  onPatch,
  periodContext,
}: ReportToolSettingsInspectorProps) {
  const schema = getReportToolSettingsSchema(object.type);
  const validation = React.useMemo(() => validateReportObjectSettings(object), [object]);
  const settings = React.useMemo(
    () => buildSettingsWithDefaults(schema, object),
    [schema, object],
  );
  const presets = React.useMemo(() => getPresetsForTool(object.type), [object.type]);
  const [selectedPreset, setSelectedPreset] = React.useState('');
  const [showAdvanced, setShowAdvanced] = React.useState(false);

  React.useEffect(() => {
    setSelectedPreset('');
  }, [object.id]);

  if (!schema) return null;

  const statusMeta = STATUS_META[validation.completeness];
  const issues = [...validation.errors, ...validation.warnings];
  const selectedPresetMeta = presets.find((preset) => preset.label === selectedPreset);
  const support = getExportSupport(object.type);

  const handleFieldChange = (field: ReportToolSettingField, nextValue: unknown) => {
    onPatch(mapSettingsToObject(object, { [field.key]: nextValue }));
  };

  const handleApplyPreset = () => {
    const preset = presets.find((item) => item.label === selectedPreset);
    if (!preset) return;

    const nextValues: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(preset.values)) {
      if (BINDING_KEYS.has(key)) {
        if ((Array.isArray(value) && value.length === 0) || String(value ?? '').trim() === '') {
          continue;
        }
      }
      nextValues[key] = value;
    }

    onPatch(mapSettingsToObject(object, nextValues));
  };

  const handleResetDefaults = () => {
    onPatch(mapSettingsToObject(object, buildDefaultSettings(schema)));
  };

  const renderField = (field: ReportToolSettingField) => {
    const value = fieldValue(field, settings);
    const fieldIssues = fieldIssuesFor(issues, field.key);
    const hasError = fieldIssues.some((issue) => issue.severity === 'error');
    const inputStyle = hasError
      ? { borderColor: '#dc2626', boxShadow: '0 0 0 1px rgba(220, 38, 38, 0.2)' }
      : undefined;

    let control: React.ReactNode;

    if (field.type === 'textarea' || field.type === 'formulaEditor') {
      control = (
        <textarea
          rows={field.type === 'formulaEditor' ? 5 : 3}
          value={String(value)}
          placeholder={String(field.defaultValue ?? '')}
          style={inputStyle}
          onChange={(e) => handleFieldChange(field, e.target.value)}
        />
      );
    } else if (field.type === 'boolean') {
      control = (
        <label className="ins-check" style={{ marginTop: 2 }}>
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => handleFieldChange(field, e.target.checked)}
          />
          <span>{field.label}</span>
        </label>
      );
    } else if (field.type === 'color') {
      const rawValue = String(value || '');
      control = (
        <div style={{ display: 'grid', gridTemplateColumns: '44px minmax(0, 1fr)', gap: 8 }}>
          <input
            type="color"
            value={isColorValue(rawValue) ? rawValue : '#111827'}
            style={{ padding: 0, ...inputStyle }}
            onChange={(e) => handleFieldChange(field, e.target.value)}
          />
          <input
            type="text"
            value={rawValue}
            placeholder={String(field.defaultValue ?? '#111827')}
            style={inputStyle}
            onChange={(e) => handleFieldChange(field, e.target.value)}
          />
        </div>
      );
    } else if (field.type === 'select' && field.options) {
      control = (
        <select
          value={String(value ?? '')}
          style={inputStyle}
          onChange={(e) => handleFieldChange(field, e.target.value)}
        >
          {field.options.map((option) => (
            <option key={String(option.value)} value={String(option.value)}>
              {option.label}
            </option>
          ))}
        </select>
      );
    } else if (field.type === 'tagPicker') {
      control = (
        <select
          value={String(value ?? '')}
          style={inputStyle}
          onChange={(e) => handleFieldChange(field, e.target.value || undefined)}
        >
          <option value="">Select</option>
          {tags.map((tag) => (
            <option key={tag.id} value={tag.id}>
              {tag.name ?? tag.id}
              {tag.unit ? ` (${tag.unit})` : ''}
            </option>
          ))}
        </select>
      );
    } else if (field.type === 'multiTagPicker') {
      control = (
        <select
          multiple
          size={Math.min(8, Math.max(4, tags.length))}
          value={normalizeStringArray(value)}
          style={inputStyle}
          onChange={(e) => {
            const next = Array.from(e.target.selectedOptions, (option) => option.value);
            handleFieldChange(field, next);
          }}
        >
          {tags.map((tag) => (
            <option key={tag.id} value={tag.id}>
              {tag.name ?? tag.id}
              {tag.unit ? ` (${tag.unit})` : ''}
            </option>
          ))}
        </select>
      );
    } else if (field.type === 'devicePicker' || field.type === 'meterPicker') {
      const options = field.type === 'meterPicker'
        ? devices.filter((device) => device.type !== 'converter')
        : devices;
      control = (
        <select
          value={String(value ?? '')}
          style={inputStyle}
          onChange={(e) => handleFieldChange(field, e.target.value || undefined)}
        >
          <option value="">Select</option>
          {options.map((device) => (
            <option key={device.id} value={device.id}>
              {device.name ?? device.id}
            </option>
          ))}
        </select>
      );
    } else if (field.type === 'date') {
      control = (
        <input
          type="date"
          value={String(value ?? '')}
          style={inputStyle}
          onChange={(e) => handleFieldChange(field, e.target.value)}
        />
      );
    } else if (field.type === 'number') {
      control = (
        <input
          type="number"
          value={value === '' || value === undefined || value === null ? '' : Number(value)}
          min={field.min}
          max={field.max}
          step={field.step}
          style={inputStyle}
          onChange={(e) => handleFieldChange(field, e.target.value === '' ? undefined : Number(e.target.value))}
        />
      );
    } else if (field.type === 'columnBuilder') {
      control = (
        <ColumnBuilderEditor
          value={normalizeStringArray(value)}
          onChange={(next) => handleFieldChange(field, next)}
        />
      );
    } else {
      control = (
        <input
          type="text"
          value={String(value ?? '')}
          placeholder={String(field.defaultValue ?? '')}
          style={inputStyle}
          onChange={(e) => handleFieldChange(field, e.target.value)}
        />
      );
    }

    if (field.type === 'boolean') {
      return (
        <div key={field.key}>
          {control}
          {field.description ? (
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{field.description}</div>
          ) : null}
          {fieldIssues.map((issue, index) => (
            <div
              key={`${field.key}-issue-${index}`}
              style={{
                color: issue.severity === 'error' ? '#dc2626' : '#b45309',
                fontSize: 12,
                marginTop: 4,
              }}
            >
              {issue.message}
            </div>
          ))}
        </div>
      );
    }

    return (
      <label key={field.key} className="ins-row">
        <span>{field.label}</span>
        {control}
        {field.description ? (
          <div style={{ gridColumn: '1 / -1', fontSize: 12, color: '#64748b' }}>{field.description}</div>
        ) : null}
        {field.key === 'verticalAlign' && (
          <div style={{ gridColumn: '1 / -1', fontSize: 11, color: '#64748b', fontStyle: 'italic' }}>* ค่านี้มีผลเฉพาะในหน้า Editor ยังไม่มีผลกับ PDF Export</div>
        )}
        {fieldIssues.map((issue, index) => (
          <div
            key={`${field.key}-issue-${index}`}
            style={{
              gridColumn: '1 / -1',
              color: issue.severity === 'error' ? '#dc2626' : '#b45309',
              fontSize: 12,
            }}
          >
            {issue.message}
          </div>
        ))}
      </label>
    );
  };

  return (
    <>
      <CalculationPreviewPane
        object={object}
        settings={settings}
        tags={tags}
        devices={devices}
        periodContext={periodContext}
      />

      <section className="ins-sec">
        <div className="ins-sec-head">
          <h4>สถานะของเครื่องมือ (Tool Status)</h4>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '4px 10px',
              borderRadius: 999,
              border: `1px solid ${statusMeta.border}`,
              background: statusMeta.background,
              color: statusMeta.color,
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            {statusMeta.label}
          </span>
          <span style={{ fontSize: 12, color: '#64748b' }}>{schema.toolType}</span>
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
          <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, fontWeight: 700, textTransform: 'uppercase', background: support.pdf === 'supported' ? '#ecfdf5' : support.pdf === 'web_only' ? '#fff7ed' : '#fef2f2', color: support.pdf === 'supported' ? '#047857' : support.pdf === 'web_only' ? '#c2410c' : '#991b1b', border: `1px solid ${support.pdf === 'supported' ? '#a7f3d0' : support.pdf === 'web_only' ? '#fdbb74' : '#fca5a5'}` }}>
            PDF: {support.pdf === 'supported' ? 'Supported' : support.pdf === 'web_only' ? 'Web Only' : 'Unsupported'}
          </span>
          <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, fontWeight: 700, textTransform: 'uppercase', background: support.excel === 'supported' ? '#ecfdf5' : '#fef2f2', color: support.excel === 'supported' ? '#047857' : '#991b1b', border: `1px solid ${support.excel === 'supported' ? '#a7f3d0' : '#fca5a5'}` }}>
            Excel: {support.excel === 'supported' ? 'Supported' : 'Unsupported'}
          </span>
        </div>
        {support.pdf === 'web_only' && (
          <div style={{ fontSize: 11, color: '#c2410c', marginTop: 4, fontWeight: 600 }}>⚠️ Web only / ไม่รองรับ PDF Export</div>
        )}

        <div style={{ marginTop: 12, borderTop: '1px solid #e2e8f0', paddingTop: 8 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
            <input type="checkbox" checked={showAdvanced} onChange={(e) => setShowAdvanced(e.target.checked)} />
            แสดงตั้งค่าขั้นสูง (Show Advanced)
          </label>
        </div>

        {presets.length > 0 ? (
          <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
            <label className="ins-row" style={{ marginBottom: 0 }}>
              <span>Preset</span>
              <select value={selectedPreset} onChange={(e) => setSelectedPreset(e.target.value)}>
                <option value="">Select preset</option>
                {presets.map((preset) => (
                  <option key={preset.label} value={preset.label}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </label>
            {selectedPresetMeta ? (
              <div style={{ fontSize: 12, color: '#64748b' }}>{selectedPresetMeta.description}</div>
            ) : null}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="btn secondary small-btn"
                disabled={!selectedPreset}
                onClick={handleApplyPreset}
              >
                Apply preset
              </button>
              <button
                type="button"
                className="btn secondary small-btn"
                onClick={handleResetDefaults}
              >
                Reset defaults
              </button>
            </div>
          </div>
        ) : (
          <div style={{ marginTop: 12 }}>
            <button
              type="button"
              className="btn secondary small-btn"
              onClick={handleResetDefaults}
            >
              Reset defaults
            </button>
          </div>
        )}
      </section>

      {issues.length > 0 ? (
        <section className="ins-sec">
          <div className="ins-sec-head">
            <h4>Validation</h4>
          </div>
          <div style={{ display: 'grid', gap: 6 }}>
            {validation.errors.map((issue, index) => (
              <div key={`err-${index}`} style={{ color: '#dc2626', fontSize: 12 }}>
                {issue.message}
              </div>
            ))}
            {validation.warnings.map((issue, index) => (
              <div key={`warn-${index}`} style={{ color: '#b45309', fontSize: 12 }}>
                {issue.message}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {SECTION_ORDER.map((sectionKey) => {
        const isBasic = ['general', 'binding', 'calculation', 'export'].includes(sectionKey);
        if (!isBasic && !showAdvanced) return null;

        const fields = schema[sectionKey];
        if (!fields?.length) return null;

        const visibleFields = fields.filter((field) => fieldIsVisible(field, settings));
        if (!visibleFields.length) return null;

        return (
          <section key={sectionKey} className="ins-sec">
            <div className="ins-sec-head">
              <h4>{SECTION_LABELS[sectionKey] || sectionKey}</h4>
            </div>
            {visibleFields.map((field) => renderField(field))}
            {sectionKey === 'advanced' ? (
              <label className="ins-row" style={{ marginTop: 8 }}>
                <span>Object JSON</span>
                <textarea
                  rows={8}
                  value={JSON.stringify(
                    {
                      id: object.id,
                      type: object.type,
                      name: object.name,
                      props: object.props ?? {},
                      style: object.style ?? {},
                      binding: object.binding ?? {},
                    },
                    null,
                    2,
                  )}
                  readOnly
                />
              </label>
            ) : null}
          </section>
        );
      })}
    </>
  );
}
