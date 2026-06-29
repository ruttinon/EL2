import type { ReportObjectDefinition } from '@energylink/shared-types';

const STYLE_KEY_ALIASES: Record<string, string> = {
  strokeColor: 'stroke',
  strokeStyle: 'strokeStyle',
  strokeWidth: 'strokeWidth',
  lineColor: 'color',
  lineWidth: 'lineWidth',
  lineStyle: 'lineStyle',
  foreground: 'color',
  chartStyle: 'reportViewMode',
  chartType: 'echartType',
  decimal: 'decimalPlaces',
  unit: 'unit',
};

const STYLE_NUMBER_KEYS = new Set([
  'fontSize',
  'lineHeight',
  'letterSpacing',
  'padding',
  'margin',
  'borderWidth',
  'borderRadius',
  'opacity',
  'strokeWidth',
  'lineWidth',
  'shadowBlur',
  'lineHeight',
  'captionFontSize',
  'size',
  'decimalPlaces',
  'yAxisMin',
  'yAxisMax',
  'thresholdValue',
]);

const STYLE_BOOLEAN_KEYS = new Set([
  'italic',
  'underline',
  'autoFit',
  'wrapText',
  'lockAspectRatio',
  'showLegend',
  'showGrid',
  'showTooltip',
  'showPoints',
  'smoothLine',
  'yAxisAuto',
  'thresholdLine',
  'startArrow',
  'endArrow',
]);

const PROP_NUMBER_KEYS = new Set([
  'startNumber',
  'maxLines',
  'captionFontSize',
  'flatRate',
  'multiplier',
  'ctRatio',
  'serviceCharge',
  'vatPercent',
  'targetValue',
  'rate',
  'rowHeight',
  'maxRows',
  'decimal',
]);

const PROP_BOOLEAN_KEYS = new Set([
  'showTotalPages',
  'showDateLine',
  'showTimestamp',
  'showQuality',
  'showCaption',
  'summaryRow',
  'pageBreak',
  'repeatHeader',
  'alternateRowColor',
  'rowColorByLevel',
  'showSubtotal',
  'showServiceCharge',
  'showVat',
  'showGrandTotal',
  'showComparison',
  'comparePreviousPeriod',
  'trendIndicator',
  'showHeader',
  'hideWhenZero',
  'showOnlyWhenDataExists',
]);

const ROOT_NUMBER_KEYS = new Set(['x', 'y', 'width', 'height', 'rotation', 'layer', 'zIndex']);
const ROOT_BOOLEAN_KEYS = new Set(['visible', 'locked']);

function normalizeBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'false' || normalized === '0' || normalized === 'off' || normalized === 'no') return false;
    if (normalized === 'true' || normalized === '1' || normalized === 'on' || normalized === 'yes') return true;
  }
  return Boolean(value);
}

function normalizeNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function normalizeString(value: unknown): string {
  if (value === undefined || value === null) return '';
  return String(value);
}

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
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
  }
  return [];
}

function ensureProps(patch: Partial<ReportObjectDefinition>) {
  patch.props = { ...(patch.props ?? {}) };
  return patch.props as Record<string, unknown>;
}

function ensureStyle(patch: Partial<ReportObjectDefinition>) {
  patch.style = { ...(patch.style ?? {}) };
  return patch.style as Record<string, unknown>;
}

function ensureBinding(patch: Partial<ReportObjectDefinition>) {
  patch.binding = { ...(patch.binding ?? {}) };
  return patch.binding as Record<string, unknown>;
}

function applyVariableTagIds(
  object: ReportObjectDefinition,
  patch: Partial<ReportObjectDefinition>,
  index: number,
  value: unknown,
) {
  const current = object.tagIds?.length
    ? [...object.tagIds]
    : [object.tagId ?? object.sourceTagId].filter(Boolean) as string[];
  const nextTagId = normalizeString(value).trim();
  while (current.length <= index) current.push('');
  current[index] = nextTagId;
  const next = current.filter(Boolean);
  patch.tagIds = next;
  patch.tagId = next[0] || undefined;
  patch.sourceTagId = next[0] || undefined;
  const binding = ensureBinding(patch);
  binding.tagIds = next;
  binding.tagId = next[0] || undefined;
}

function applyMetricAliases(patch: Partial<ReportObjectDefinition>, value: unknown) {
  const metric = normalizeString(value).trim();
  const props = ensureProps(patch);
  props.metric = metric || undefined;
  props.fieldMetric = metric || undefined;
  props.valueMode = metric || undefined;
}

function applyPeriodAliases(patch: Partial<ReportObjectDefinition>, value: unknown) {
  const period = normalizeString(value).trim();
  const props = ensureProps(patch);
  const style = ensureStyle(patch);
  props.period = period || undefined;
  props.reportPeriod = period || undefined;
  style.period = period || undefined;
  style.chartPeriod = period || undefined;
}

function applyUnitAliases(patch: Partial<ReportObjectDefinition>, value: unknown) {
  const unit = normalizeString(value).trim();
  const props = ensureProps(patch);
  const style = ensureStyle(patch);
  props.unit = unit || undefined;
  style.unit = unit || undefined;
}

function applyDecimalAliases(patch: Partial<ReportObjectDefinition>, value: unknown) {
  const numeric = normalizeNumber(value);
  const props = ensureProps(patch);
  const style = ensureStyle(patch);
  props.decimal = numeric;
  style.decimalPlaces = numeric;
}

function applyChartStyleAliases(patch: Partial<ReportObjectDefinition>, value: unknown) {
  const chartStyle = normalizeString(value).trim();
  const props = ensureProps(patch);
  const style = ensureStyle(patch);
  props.chartStyle = chartStyle || undefined;
  style.reportViewMode = chartStyle || undefined;
}

function applyChartTypeAliases(patch: Partial<ReportObjectDefinition>, value: unknown) {
  const chartType = normalizeString(value).trim();
  const props = ensureProps(patch);
  const style = ensureStyle(patch);
  props.chartType = chartType || undefined;
  style.echartType = chartType || undefined;
}

function applyChartToggleAlias(
  patch: Partial<ReportObjectDefinition>,
  key: string,
  value: unknown,
) {
  const props = ensureProps(patch);
  const style = ensureStyle(patch);
  const normalized = normalizeBoolean(value);
  props[key] = normalized;
  style[key] = normalized;
}

function applyChartValueAlias(
  patch: Partial<ReportObjectDefinition>,
  key: string,
  value: unknown,
) {
  const props = ensureProps(patch);
  const style = ensureStyle(patch);
  const numeric = normalizeNumber(value);
  props[key] = numeric;
  style[key] = numeric;
}

function applyColumnsValue(
  object: ReportObjectDefinition,
  patch: Partial<ReportObjectDefinition>,
  value: unknown,
) {
  const columns = normalizeColumnsValue(value);
  const props = ensureProps(patch);
  props.columns = object.type === 'meter_billing_table'
    ? columns.join(',')
    : columns;
}

function applyScopedDeviceValue(
  patch: Partial<ReportObjectDefinition>,
  value: unknown,
  mode: 'converter' | 'device',
) {
  const nextDeviceId = normalizeString(value).trim();
  const props = ensureProps(patch);
  props.scopeMode = nextDeviceId ? mode : undefined;
  props.scopeDeviceId = nextDeviceId || undefined;
  props.deviceId = nextDeviceId || undefined;
  props.deviceScope = nextDeviceId || undefined;
  props.meterScope = nextDeviceId || undefined;
  patch.deviceId = nextDeviceId || undefined;
}

function applyTagValue(patch: Partial<ReportObjectDefinition>, value: unknown) {
  const tagId = normalizeString(value).trim();
  patch.tagId = tagId || undefined;
  patch.sourceTagId = tagId || undefined;
  const binding = ensureBinding(patch);
  binding.tagId = tagId || undefined;
  binding.tagIds = tagId ? [tagId] : [];
}

function applyTagIdsValue(
  object: ReportObjectDefinition,
  patch: Partial<ReportObjectDefinition>,
  value: unknown,
) {
  const ids = normalizeStringArray(value);
  if (object.type === 'meter_billing_table') {
    const props = ensureProps(patch);
    props.tagIds = ids;
    props.autoInclude = ids.length === 0;
    return;
  }
  patch.tagIds = ids;
  patch.tagId = ids[0] || undefined;
  patch.sourceTagId = ids[0] || undefined;
  const binding = ensureBinding(patch);
  binding.tagIds = ids;
  binding.tagId = ids[0] || undefined;
}

function applySelectedTagsValue(
  patch: Partial<ReportObjectDefinition>,
  value: unknown,
) {
  const ids = normalizeStringArray(value);
  const props = ensureProps(patch);
  props.selectedTags = ids;
  if (ids.length > 0) {
    patch.tagIds = ids;
    patch.tagId = ids[0];
    patch.sourceTagId = ids[0];
    const binding = ensureBinding(patch);
    binding.tagIds = ids;
    binding.tagId = ids[0];
  }
}

function applyEnergyTagValue(
  patch: Partial<ReportObjectDefinition>,
  value: unknown,
) {
  const tagId = normalizeString(value).trim();
  const props = ensureProps(patch);
  props.energyTag = tagId || undefined;
  if (tagId) {
    patch.tagId = tagId;
    patch.sourceTagId = tagId;
    const binding = ensureBinding(patch);
    binding.tagId = tagId;
  }
}

function applyDeviceValue(patch: Partial<ReportObjectDefinition>, value: unknown) {
  const deviceId = normalizeString(value).trim();
  patch.deviceId = deviceId || undefined;
  const binding = ensureBinding(patch);
  binding.deviceId = deviceId || undefined;
  const props = ensureProps(patch);
  props.deviceId = deviceId || undefined;
}

function applyValueSetting(
  object: ReportObjectDefinition,
  patch: Partial<ReportObjectDefinition>,
  key: string,
  value: unknown,
) {
  if (ROOT_NUMBER_KEYS.has(key)) {
    const numeric = normalizeNumber(value);
    if (numeric !== undefined) {
      (patch as Record<string, unknown>)[key === 'zIndex' ? 'layer' : key] = numeric;
    }
    return;
  }

  if (ROOT_BOOLEAN_KEYS.has(key)) {
    (patch as Record<string, unknown>)[key] = normalizeBoolean(value);
    return;
  }

  switch (key) {
    case 'name':
      patch.name = normalizeString(value);
      return;
    case 'text':
      patch.text = normalizeString(value);
      return;
    case 'pattern':
      patch.text = normalizeString(value);
      return;
    case 'formula': {
      const formula = normalizeString(value);
      patch.formula = formula;
      const style = ensureStyle(patch);
      style.formula = formula;
      return;
    }
    case 'tag':
      applyTagValue(patch, value);
      return;
    case 'tagIds':
      applyTagIdsValue(object, patch, value);
      return;
    case 'selectedTags':
      applySelectedTagsValue(patch, value);
      return;
    case 'device':
      applyDeviceValue(patch, value);
      return;
    case 'deviceScope':
      applyScopedDeviceValue(patch, value, 'converter');
      return;
    case 'meterScope':
      applyScopedDeviceValue(patch, value, 'device');
      return;
    case 'meter': {
      applyScopedDeviceValue(patch, value, 'device');
      const props = ensureProps(patch);
      props.meterId = normalizeString(value).trim() || undefined;
      return;
    }
    case 'metric':
      applyMetricAliases(patch, value);
      return;
    case 'period':
      applyPeriodAliases(patch, value);
      return;
    case 'showLegend':
    case 'showGrid':
    case 'showTooltip':
    case 'showPoints':
    case 'smoothLine':
    case 'yAxisAuto':
    case 'thresholdLine':
      applyChartToggleAlias(patch, key, value);
      return;
    case 'yAxisMin':
    case 'yAxisMax':
    case 'thresholdValue':
      applyChartValueAlias(patch, key, value);
      return;
    case 'yAxisUnit': {
      const props = ensureProps(patch);
      const style = ensureStyle(patch);
      const unit = normalizeString(value).trim();
      props.yAxisUnit = unit || undefined;
      style.yAxisUnit = unit || undefined;
      return;
    }
    case 'unit':
      applyUnitAliases(patch, value);
      return;
    case 'decimal':
      applyDecimalAliases(patch, value);
      return;
    case 'chartStyle':
      applyChartStyleAliases(patch, value);
      return;
    case 'chartType':
      applyChartTypeAliases(patch, value);
      return;
    case 'columns':
      applyColumnsValue(object, patch, value);
      return;
    case 'imageUrl': {
      const props = ensureProps(patch);
      props.imageUrl = normalizeString(value);
      return;
    }
    case 'imageSource': {
      const props = ensureProps(patch);
      props.imageSource = normalizeString(value) || undefined;
      return;
    }
    case 'qrData': {
      const qrData = normalizeString(value);
      const props = ensureProps(patch);
      props.qrData = qrData || undefined;
      props.value = qrData || undefined;
      return;
    }
    case 'value': {
      const normalizedValue = normalizeString(value);
      const props = ensureProps(patch);
      props.value = normalizedValue || undefined;
      if (object.type === 'qrcode') props.qrData = normalizedValue || undefined;
      return;
    }
    case 'energyTag':
      applyEnergyTagValue(patch, value);
      return;
    case 'variableA':
      applyVariableTagIds(object, patch, 0, value);
      return;
    case 'variableB':
      applyVariableTagIds(object, patch, 1, value);
      return;
    case 'variableC':
      applyVariableTagIds(object, patch, 2, value);
      return;
    case 'variableD':
      applyVariableTagIds(object, patch, 3, value);
      return;
    default:
      break;
  }

  const styleKey = STYLE_KEY_ALIASES[key] ?? key;
  if (STYLE_BOOLEAN_KEYS.has(styleKey)) {
    const style = ensureStyle(patch);
    style[styleKey] = normalizeBoolean(value);
    return;
  }
  if (STYLE_NUMBER_KEYS.has(styleKey)) {
    const style = ensureStyle(patch);
    style[styleKey] = normalizeNumber(value);
    return;
  }
  if (
    styleKey in (object.style ?? {}) ||
    [
      'color',
      'background',
      'fill',
      'borderColor',
      'borderStyle',
      'fontFamily',
      'fontWeight',
      'align',
      'verticalAlign',
      'shadow',
      'shadowColor',
      'fitMode',
      'cropPosition',
      'lineCap',
      'lineJoin',
      'textOverflow',
      'reportViewMode',
      'echartType',
      'unit',
      'decimalPlaces',
      'valueColor',
      'unitColor',
      'foreground',
    ].includes(styleKey)
  ) {
    const style = ensureStyle(patch);
    style[styleKey] = normalizeString(value) || undefined;
    if (styleKey === 'stroke') {
      style.borderColor = normalizeString(value) || undefined;
      if (object.type === 'line') {
        style.background = normalizeString(value) || undefined;
        style.fill = normalizeString(value) || undefined;
      }
    }
    return;
  }

  const props = ensureProps(patch);
  if (PROP_BOOLEAN_KEYS.has(key)) {
    props[key] = normalizeBoolean(value);
    return;
  }
  if (PROP_NUMBER_KEYS.has(key)) {
    props[key] = normalizeNumber(value);
    return;
  }
  props[key] = Array.isArray(value)
    ? value.map((item) => String(item))
    : (typeof value === 'string' ? value : value ?? undefined);
}

export function mapSettingsToObject(
  object: ReportObjectDefinition,
  settings: Record<string, unknown>,
): Partial<ReportObjectDefinition> {
  const patch: Partial<ReportObjectDefinition> = {};

  for (const [key, value] of Object.entries(settings)) {
    applyValueSetting(object, patch, key, value);
  }

  return patch;
}

function readTagIds(object: ReportObjectDefinition): string[] {
  if (object.type === 'meter_billing_table') {
    return normalizeStringArray(object.props?.tagIds);
  }
  if (object.tagIds?.length) return normalizeStringArray(object.tagIds);
  const single = object.tagId ?? object.sourceTagId ?? object.binding?.tagId;
  return single ? [String(single)] : [];
}

export function mapObjectToSettings(object: ReportObjectDefinition): Record<string, unknown> {
  const tagIds = readTagIds(object);
  const merged = {
    ...(object.props ?? {}),
    ...(object.style ?? {}),
    ...(object.binding ?? {}),
  } as Record<string, unknown>;

  return {
    ...merged,
    name: object.name,
    text: object.text,
    x: object.x,
    y: object.y,
    width: object.width,
    height: object.height,
    rotation: object.rotation,
    visible: object.visible !== false,
    locked: Boolean(object.locked),
    layer: object.layer,
    zIndex: object.layer,
    formula: object.formula ?? object.style?.formula ?? '',
    imageUrl: object.props?.imageUrl ?? '',
    imageSource: object.props?.imageSource ?? (object.props?.imageUrl ? 'url' : ''),
    pattern: object.text ?? '',
    tag: object.tagId ?? object.sourceTagId ?? object.binding?.tagId ?? '',
    tagIds,
    selectedTags: normalizeStringArray(object.props?.selectedTags ?? tagIds),
    device: object.deviceId ?? object.binding?.deviceId ?? object.props?.deviceId ?? '',
    deviceScope: object.props?.deviceScope ?? object.props?.scopeDeviceId ?? object.props?.deviceId ?? object.deviceId ?? '',
    meterScope: object.props?.meterScope ?? object.props?.scopeDeviceId ?? '',
    meter: object.props?.meterId ?? object.props?.scopeDeviceId ?? '',
    metric: object.props?.fieldMetric ?? object.props?.metric ?? object.props?.valueMode ?? '',
    period: object.props?.period ?? object.props?.reportPeriod ?? object.style?.period ?? object.style?.chartPeriod ?? '',
    decimal: object.style?.decimalPlaces ?? object.props?.decimal,
    unit: object.style?.unit ?? object.props?.unit ?? '',
    chartStyle: object.style?.reportViewMode ?? object.props?.chartStyle ?? '',
    chartType: object.style?.echartType ?? object.props?.chartType ?? '',
    qrData: object.props?.qrData ?? object.props?.value ?? '',
    value: object.type === 'qrcode'
      ? (object.props?.qrData ?? object.props?.value ?? '')
      : (object.props?.value ?? ''),
    energyTag: object.props?.energyTag ?? object.tagId ?? object.sourceTagId ?? '',
    columns: normalizeColumnsValue(object.props?.columns),
    showHeader: object.props?.showHeader !== false,
    variableA: tagIds[0] ?? '',
    variableB: tagIds[1] ?? '',
    variableC: tagIds[2] ?? '',
    variableD: tagIds[3] ?? '',
  };
}
