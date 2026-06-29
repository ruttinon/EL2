import { evaluateReportFormulaExpression, type ReportObjectDefinition } from '@energylink/shared-types';
import { getReportToolSettingsSchema } from './reportToolSettingsRegistry';
import { mapObjectToSettings } from './reportSettingMapper';

export type ReportSettingCompletenessState =
  | 'ready'
  | 'missingBinding'
  | 'missingRequiredSetting'
  | 'warning'
  | 'error';

export type ReportObjectValidationIssue = {
  message: string;
  severity: 'error' | 'warning';
  field?: string;
  code?: 'missingBinding' | 'missingRequiredSetting' | 'validation';
};

export type ReportObjectValidationResult = {
  errors: ReportObjectValidationIssue[];
  warnings: ReportObjectValidationIssue[];
  completeness: ReportSettingCompletenessState;
};

const SECTION_KEYS = [
  'general',
  'style',
  'binding',
  'data',
  'table',
  'chart',
  'billing',
  'behavior',
  'export',
  'advanced',
] as const;

function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
  }
  return [];
}

function normalizeColumnsValue(value: unknown): string[] {
  return normalizeStringArray(value);
}

function isBlank(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

function normalizeNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function fieldIsVisible(
  field: { visibleWhen?: Record<string, unknown> },
  settings: Record<string, unknown>,
): boolean {
  if (!field.visibleWhen) return true;
  return Object.entries(field.visibleWhen).every(([key, expected]) => settings[key] === expected);
}

function buildSettingsSnapshot(object: ReportObjectDefinition): Record<string, unknown> {
  const schema = getReportToolSettingsSchema(object.type);
  const settings = mapObjectToSettings(object);
  if (!schema) return settings;

  for (const sectionKey of SECTION_KEYS) {
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

function pushIssue(
  target: ReportObjectValidationIssue[],
  severity: 'error' | 'warning',
  message: string,
  field?: string,
  code: ReportObjectValidationIssue['code'] = 'validation',
) {
  target.push({ severity, message, field, code });
}

function inferCompleteness(
  errors: ReportObjectValidationIssue[],
  warnings: ReportObjectValidationIssue[],
): ReportSettingCompletenessState {
  const hasNonBlockingError = errors.some((issue) => issue.code === 'validation');
  if (hasNonBlockingError) return 'error';
  if (errors.some((issue) => issue.code === 'missingBinding')) return 'missingBinding';
  if (errors.some((issue) => issue.code === 'missingRequiredSetting')) return 'missingRequiredSetting';
  if (warnings.length > 0) return 'warning';
  return 'ready';
}

export function validateReportObjectSettings(object: ReportObjectDefinition): ReportObjectValidationResult {
  const schema = getReportToolSettingsSchema(object.type);
  const errors: ReportObjectValidationIssue[] = [];
  const warnings: ReportObjectValidationIssue[] = [];
  const settings = buildSettingsSnapshot(object);

  if (!schema) {
    return { errors, warnings, completeness: 'ready' };
  }

  const tagIds = normalizeStringArray(settings.tagIds);
  const selectedTags = normalizeStringArray(settings.selectedTags);
  const hasTag = tagIds.length > 0 || !isBlank(settings.tag);
  const hasBinding = hasTag || !isBlank(settings.device) || !isBlank(settings.energyTag);
  const formula = String(settings.formula ?? '').trim();
  const width = normalizeNumber(settings.width) ?? object.width;
  const height = normalizeNumber(settings.height) ?? object.height;
  const period = String(settings.period ?? '').trim();
  const metric = String(settings.metric ?? '').trim();
  const chartType = String(settings.chartType ?? '').trim();
  const dataSource = String(settings.dataSource ?? '').trim();

  if (width <= 0 || height <= 0) {
    pushIssue(errors, 'error', 'Width and height must be greater than 0.', 'width');
  }

  if (isBlank(settings.name)) {
    pushIssue(warnings, 'warning', 'Name is empty.', 'name');
  }

  for (const sectionKey of SECTION_KEYS) {
    const fields = schema[sectionKey];
    if (!fields) continue;
    for (const field of fields) {
      if (!field.required || !fieldIsVisible(field, settings)) continue;
      if (isBlank(settings[field.key])) {
        pushIssue(
          errors,
          'error',
          `${field.label} is required.`,
          field.key,
          field.key === 'tag' || field.key === 'tagIds' ? 'missingBinding' : 'missingRequiredSetting',
        );
      }
    }
  }

  switch (object.type) {
    case 'text':
      if (isBlank(settings.text)) {
        pushIssue(warnings, 'warning', 'Text is empty.', 'text');
      }
      if (width < 24 || height < 16) {
        pushIssue(warnings, 'warning', 'Text area is very small.', 'width');
      }
      break;

    case 'image':
      if (isBlank(settings.imageUrl)) {
        pushIssue(errors, 'error', 'Image source is required.', 'imageUrl', 'missingRequiredSetting');
      }
      break;

    case 'line':
      if (width === 0 && height === 0) {
        pushIssue(errors, 'error', 'Line length cannot be zero.', 'width');
      }
      break;

    case 'date':
      if (isBlank(settings.format)) {
        pushIssue(warnings, 'warning', 'Date format is empty.', 'format');
      }
      if (settings.dateSource === 'customDate' && isBlank(settings.customDate)) {
        pushIssue(errors, 'error', 'Custom date is required.', 'customDate', 'missingRequiredSetting');
      }
      break;

    case 'page_number':
      if (!String(settings.pattern ?? '').includes('{{page}}')) {
        pushIssue(warnings, 'warning', 'Pattern should include {{page}}.', 'pattern');
      }
      break;

    case 'signature':
      if (isBlank(settings.label)) {
        pushIssue(warnings, 'warning', 'Signature label is empty.', 'label');
      }
      break;

    case 'qrcode':
      if (isBlank(settings.value) && isBlank(settings.qrData)) {
        pushIssue(errors, 'error', 'QR value is required.', 'value', 'missingRequiredSetting');
      }
      break;

    case 'value':
    case 'kpi_value':
      if (!hasBinding && !formula) {
        pushIssue(errors, 'error', 'Select a tag or configure a formula.', 'tag', 'missingBinding');
      }
      if (metric === 'usage' && !period) {
        pushIssue(warnings, 'warning', 'Usage metric should define a period.', 'period');
      }
      if (normalizeNumber(settings.decimal) === undefined) {
        pushIssue(errors, 'error', 'Decimal must be numeric.', 'decimal');
      }
      break;

    case 'kpicard':
      if (isBlank(settings.title)) {
        pushIssue(warnings, 'warning', 'Title is empty.', 'title');
      }
      if (!hasBinding && !formula) {
        pushIssue(errors, 'error', 'KPI card needs a binding or formula.', 'tag', 'missingBinding');
      }
      break;

    case 'formula':
    case 'formulavalue': {
      if (!formula) {
        pushIssue(errors, 'error', 'Formula is required.', 'formula', 'missingRequiredSetting');
        break;
      }

      try {
        evaluateReportFormulaExpression(formula, tagIds, [], null);
      } catch {
        pushIssue(errors, 'error', 'Formula syntax is invalid.', 'formula');
      }

      for (const token of ['A', 'B', 'C', 'D']) {
        if (new RegExp(`\\b${token}\\b`).test(formula)) {
          const index = token.charCodeAt(0) - 65;
          if (!tagIds[index]) {
            pushIssue(errors, 'error', `Variable ${token} has no tag mapping.`, `variable${token}`, 'missingBinding');
          }
        }
      }

      if (/\s\/\s0(?:\D|$)/.test(formula)) {
        pushIssue(warnings, 'warning', 'Formula may divide by zero.', 'formula');
      }
      break;
    }

    case 'trend':
    case 'graph':
      if (tagIds.length === 0) {
        pushIssue(errors, 'error', 'Select at least one tag.', 'tagIds', 'missingBinding');
      }
      if (!period) {
        pushIssue(warnings, 'warning', 'Trend period is empty.', 'period');
      }
      if (String(settings.aggregation ?? '') === 'raw' && ['30d', 'lastMonth', 'thisMonth'].includes(period)) {
        pushIssue(warnings, 'warning', 'Raw aggregation with a long period may be heavy.', 'aggregation');
      }
      break;

    case 'echart':
      if (!dataSource) {
        pushIssue(errors, 'error', 'Data source is required.', 'dataSource', 'missingRequiredSetting');
      }
      if (dataSource === 'tags' && tagIds.length === 0) {
        pushIssue(errors, 'error', 'Chart needs at least one tag.', 'tagIds', 'missingBinding');
      }
      if (chartType === 'pie' && tagIds.length > 8) {
        pushIssue(warnings, 'warning', 'Pie chart has many series.', 'tagIds');
      }
      break;

    case 'tagtable':
    case 'table':
      if (selectedTags.length === 0 && tagIds.length === 0) {
        pushIssue(errors, 'error', 'Select tags for the table.', 'selectedTags', 'missingBinding');
      }
      if (normalizeColumnsValue(settings.columns).length === 0) {
        pushIssue(errors, 'error', 'Table needs at least one column.', 'columns', 'missingRequiredSetting');
      }
      break;

    case 'alarmtable':
    case 'alarm_table':
      if (String(settings.mode ?? '') === 'history' && !period) {
        pushIssue(warnings, 'warning', 'History mode should define a period.', 'period');
      }
      if (isBlank(settings.project) && isBlank(settings.deviceScope) && isBlank(settings.device)) {
        pushIssue(warnings, 'warning', 'Alarm table should define a project or scope.', 'deviceScope');
      }
      break;

    case 'meter_billing_table':
      if (isBlank(settings.energyTag) && tagIds.length === 0) {
        pushIssue(errors, 'error', 'Billing table needs an energy tag or scoped meter tags.', 'energyTag', 'missingBinding');
      }
      if (!period) {
        pushIssue(errors, 'error', 'Billing period is required.', 'period', 'missingRequiredSetting');
      }
      if (isBlank(settings.tariff) && (normalizeNumber(settings.flatRate) ?? 0) <= 0) {
        pushIssue(warnings, 'warning', 'Billing table has no tariff or rate.', 'tariff');
      }
      if (normalizeNumber(settings.vatPercent) === undefined) {
        pushIssue(errors, 'error', 'VAT percent must be numeric.', 'vatPercent');
      }
      if (normalizeColumnsValue(settings.columns).length === 0) {
        pushIssue(errors, 'error', 'Billing table needs at least one column.', 'columns', 'missingRequiredSetting');
      }
      break;

    case 'energy_summary':
      if (isBlank(settings.energyTag) && isBlank(settings.deviceScope) && isBlank(settings.device)) {
        pushIssue(errors, 'error', 'Energy summary needs an energy source or scope.', 'energyTag', 'missingBinding');
      }
      break;

    case 'cost_summary':
      if (isBlank(settings.billingSource) && isBlank(settings.rate) && isBlank(settings.tariff)) {
        pushIssue(errors, 'error', 'Cost summary needs a billing source.', 'billingSource', 'missingBinding');
      }
      if (isBlank(settings.tariff) && (normalizeNumber(settings.rate) ?? 0) <= 0) {
        pushIssue(warnings, 'warning', 'Cost summary has no tariff or rate.', 'tariff');
      }
      break;

    default:
      break;
  }

  return {
    errors,
    warnings,
    completeness: inferCompleteness(errors, warnings),
  };
}
