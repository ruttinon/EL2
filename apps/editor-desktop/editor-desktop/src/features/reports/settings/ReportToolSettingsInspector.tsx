import React from 'react';
import type { DeviceSummary, ReportObjectDefinition, TagSummary } from '@energylink/shared-types';
import type { ReportToolSettingField } from './reportSettingTypes';
import { getPresetsForTool } from './reportSettingPresets';
import { mapObjectToSettings, mapSettingsToObject } from './reportSettingMapper';
import { getReportToolSettingsSchema } from './reportToolSettingsRegistry';
import {
  validateReportObjectSettings,
  type ReportObjectValidationIssue,
  type ReportSettingCompletenessState,
} from './reportSettingValidator';

const SECTION_LABELS: Record<string, string> = {
  general: 'General',
  binding: 'Binding',
  data: 'Data',
  style: 'Appearance',
  table: 'Table',
  chart: 'Chart',
  billing: 'Billing',
  behavior: 'Behavior',
  export: 'Export',
  advanced: 'Advanced',
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
    return normalizeStringArray(value ?? field.defaultValue ?? []).join(', ');
  }

  if (value !== undefined && value !== null) return value;
  return field.defaultValue ?? '';
}

type ReportToolSettingsInspectorProps = {
  object: ReportObjectDefinition;
  tags: TagSummary[];
  devices: DeviceSummary[];
  onPatch: (patch: Partial<ReportObjectDefinition>) => void;
};

export function ReportToolSettingsInspector({
  object,
  tags,
  devices,
  onPatch,
}: ReportToolSettingsInspectorProps) {
  const schema = getReportToolSettingsSchema(object.type);
  const validation = React.useMemo(() => validateReportObjectSettings(object), [object]);
  const settings = React.useMemo(
    () => buildSettingsWithDefaults(schema, object),
    [schema, object],
  );
  const presets = React.useMemo(() => getPresetsForTool(object.type), [object.type]);
  const [selectedPreset, setSelectedPreset] = React.useState('');

  React.useEffect(() => {
    setSelectedPreset('');
  }, [object.id]);

  if (!schema) return null;

  const statusMeta = STATUS_META[validation.completeness];
  const issues = [...validation.errors, ...validation.warnings];
  const selectedPresetMeta = presets.find((preset) => preset.label === selectedPreset);

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
        <textarea
          rows={3}
          value={String(value)}
          placeholder="col1, col2, col3"
          style={inputStyle}
          onChange={(e) => handleFieldChange(field, normalizeStringArray(e.target.value))}
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
      <section className="ins-sec">
        <div className="ins-sec-head">
          <h4>Tool status</h4>
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
