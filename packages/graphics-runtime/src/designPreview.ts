import type { CurrentTagValue, NormalizedGraphicObject } from './types';
import { parseStateSlots } from './stateSlots';

const PREVIEW_NUM: Record<string, { value: number; unit?: string }> = {
  value: { value: 123.45, unit: 'kW' },
  gauge: { value: 65, unit: '%' },
  progressbar: { value: 72, unit: '%' },
  levelbar: { value: 48, unit: '%' },
  slider: { value: 50 },
  kpicard: { value: 1280, unit: 'kWh' },
  formulavalue: { value: 99.9 },
  statusbadge: { value: 1 },
  status: { value: 1 },
  multistate: { value: 1 },
  semaphore: { value: 0 },
};

const PREVIEW_BOOL = new Set(['led', 'switch']);
const DISCRETE_PREVIEW_TYPES = new Set(['statusbadge', 'multistate', 'semaphore']);

function isStatusLampPreview(obj: NormalizedGraphicObject): boolean {
  return obj.type === 'led' || (obj.type === 'status' && obj.style?.statusVariant !== 'badge');
}

function isStatusBadgePreview(obj: NormalizedGraphicObject): boolean {
  return obj.type === 'statusbadge' || (obj.type === 'status' && obj.style?.statusVariant === 'badge');
}

function resolveDiscretePreviewValue(obj: NormalizedGraphicObject, fallback: number): number {
  const override = obj.style?.designPreviewValue;
  if (override !== undefined && override !== '') {
    const n = Number(override);
    if (Number.isFinite(n)) return n;
  }
  const slots = parseStateSlots(obj.style);
  const withMedia = slots.find((s) => s.imageUrl || s.glbUrl);
  if (withMedia) return withMedia.value;
  return fallback;
}

/** Synthetic tag value for editor design mode (no live Engine connection). */
export function designPreviewTag(obj: NormalizedGraphicObject): CurrentTagValue | undefined {
  const previewOverride = obj.style?.designPreviewValue;
  if (PREVIEW_BOOL.has(obj.type) || isStatusLampPreview(obj)) {
    const boolOn =
      previewOverride === 1 || previewOverride === '1' || previewOverride === true || previewOverride === 'true'
        ? true
        : previewOverride === 0 || previewOverride === '0' || previewOverride === false || previewOverride === 'false'
          ? false
          : isStatusLampPreview(obj) || obj.type === 'led';
    return {
      id: '__preview__',
      name: obj.name || 'Preview',
      value: boolOn,
      unit: null,
      decimalPlaces: 0,
      dataType: 'bool',
      quality: 'good',
    };
  }
  const spec = PREVIEW_NUM[obj.type];
  if (!spec) return undefined;
  const dp = Number(obj.style?.decimalPlaces ?? 2);
  const unit = String(obj.style?.unit ?? spec.unit ?? '');
  const value = (DISCRETE_PREVIEW_TYPES.has(obj.type) || isStatusBadgePreview(obj))
    ? resolveDiscretePreviewValue(obj, spec.value)
    : (() => {
      // Numeric widgets ignore designPreviewValue — avoids bleed from discrete widgets.
      return spec.value;
    })();
  return {
    id: '__preview__',
    name: obj.name || 'Preview',
    value,
    unit: unit || null,
    decimalPlaces: dp,
    dataType: 'float',
    quality: 'good',
  };
}
