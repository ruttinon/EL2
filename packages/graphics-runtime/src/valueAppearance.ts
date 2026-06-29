import type { CurrentTagValue, NormalizedGraphicObject } from './types';
import { resolveSlotAppearance, parseStateSlots, type WidgetStateSlot } from './stateSlots';

export type ValueDisplayMode = 'classic' | 'image' | 'model3d';
export type ValueVariant = 'default' | 'compact' | 'card' | 'minimal' | 'industrial';

export type ValueStateRule = {
  tagId?: string;
  when: 'on' | 'off' | 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'between';
  value?: number;
  min?: number;
  max?: number;
  color?: string;
  fill?: string;
  background?: string;
  imageUrl?: string;
  glbUrl?: string;
  text?: string;
  glow?: boolean;
  visible?: boolean;
};

export type ResolvedValueAppearance = {
  displayMode: ValueDisplayMode;
  variant: ValueVariant;
  background?: string;
  color?: string;
  fill?: string;
  imageUrl?: string;
  glbUrl?: string;
  text?: string;
  glow?: boolean;
  visible?: boolean;
  borderRadius?: string;
};

const EMPTY = (s: string | undefined) => (s && s.trim() ? s : undefined);

const DISCRETE_STATE_TYPES = new Set(['statusbadge', 'multistate', 'semaphore']);
const BINARY_STATE_TYPES = new Set(['led']);
const FILL_IMAGE_TYPES = new Set(['value', 'gauge', 'progressbar', 'levelbar', 'kpicard', 'formulavalue']);

function isBinaryStatusType(type: string, style?: Record<string, unknown>): boolean {
  if (type === 'led') return true;
  if (type === 'status') return style?.statusVariant !== 'badge';
  return false;
}

function isDiscreteStatusType(type: string, style?: Record<string, unknown>): boolean {
  if (DISCRETE_STATE_TYPES.has(type)) return true;
  return type === 'status' && style?.statusVariant === 'badge';
}

export function isTruthyOn(val: unknown): boolean {
  if (val === true || val === 1 || val === '1' || val === 'true' || val === 'ON') return true;
  if (val === false || val === 0 || val === '0' || val === 'false' || val === 'OFF' || val == null) return false;
  const n = Number(val);
  return Number.isFinite(n) && n !== 0;
}

export function resolveValueDisplayMode(style: Record<string, unknown> | undefined): ValueDisplayMode {
  const m = String(style?.valueDisplayMode ?? 'classic');
  if (m === 'image' || m === 'model3d') return m;
  return 'classic';
}

export function resolveValueVariant(style: Record<string, unknown> | undefined): ValueVariant {
  const v = String(style?.valueVariant ?? 'default');
  if (v === 'compact' || v === 'card' || v === 'minimal' || v === 'industrial') return v;
  return 'default';
}

export function valueVariantClass(variant: ValueVariant): string {
  return variant === 'default' ? '' : ` rt-value-variant-${variant}`;
}

export function parseValueRules(style: Record<string, unknown> | undefined): ValueStateRule[] {
  const raw = style?.valueRulesJson;
  if (typeof raw !== 'string' || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((r): r is ValueStateRule => Boolean(r && typeof r === 'object' && typeof (r as ValueStateRule).when === 'string'));
  } catch {
    return [];
  }
}

export function serializeValueRules(rules: ValueStateRule[]): string {
  return JSON.stringify(rules);
}

function tagValueForRule(
  rule: ValueStateRule,
  obj: NormalizedGraphicObject,
  displayValue: CurrentTagValue | undefined,
  valuesByTag?: Map<string, CurrentTagValue>,
): unknown {
  const tid = rule.tagId?.trim();
  if (tid && valuesByTag) return valuesByTag.get(tid)?.value;
  return displayValue?.value;
}

function parseNum(val: unknown): number | null {
  if (val == null) return null;
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

export function matchesValueRule(
  rule: ValueStateRule,
  obj: NormalizedGraphicObject,
  displayValue: CurrentTagValue | undefined,
  valuesByTag?: Map<string, CurrentTagValue>,
): boolean {
  const val = tagValueForRule(rule, obj, displayValue, valuesByTag);
  const num = parseNum(val);

  switch (rule.when) {
    case 'on':
      return isTruthyOn(val);
    case 'off':
      return !isTruthyOn(val);
    case 'eq':
      return num !== null && rule.value !== undefined && num === Number(rule.value);
    case 'neq':
      return num !== null && rule.value !== undefined && num !== Number(rule.value);
    case 'gt':
      return num !== null && rule.value !== undefined && num > Number(rule.value);
    case 'gte':
      return num !== null && rule.value !== undefined && num >= Number(rule.value);
    case 'lt':
      return num !== null && rule.value !== undefined && num < Number(rule.value);
    case 'lte':
      return num !== null && rule.value !== undefined && num <= Number(rule.value);
    case 'between': {
      if (num === null || rule.min === undefined || rule.max === undefined) return false;
      return num >= Number(rule.min) && num <= Number(rule.max);
    }
    default:
      return false;
  }
}

function applyRuleToAppearance(base: ResolvedValueAppearance, rule: ValueStateRule): ResolvedValueAppearance {
  const next = { ...base };
  if (rule.background) next.background = rule.background;
  if (rule.fill) next.fill = rule.fill;
  if (rule.color) next.color = rule.color;
  if (rule.imageUrl) next.imageUrl = rule.imageUrl;
  if (rule.glbUrl) next.glbUrl = rule.glbUrl;
  if (rule.text !== undefined) next.text = rule.text;
  if (rule.glow !== undefined) next.glow = rule.glow;
  if (rule.visible !== undefined) next.visible = rule.visible;
  return next;
}

function ledBinaryDefaults(obj: NormalizedGraphicObject, displayValue: CurrentTagValue | undefined): ResolvedValueAppearance {
  const style = obj.style ?? {};
  const on = isTruthyOn(displayValue?.value);
  const onColor = String(style.stateOnColor ?? style.onColor ?? '#22c55e');
  const offColor = String(style.stateOffColor ?? style.offColor ?? '#94a3b8');
  return {
    displayMode: resolveValueDisplayMode(style),
    variant: resolveValueVariant(style),
    background: on ? onColor : offColor,
    imageUrl: EMPTY(on ? String(style.stateOnImage ?? '') : String(style.stateOffImage ?? '')),
    glbUrl: EMPTY(on ? String(style.stateOnGlb ?? '') : String(style.stateOffGlb ?? '')),
    glow: on && style.stateOnGlow !== false,
    visible: true,
    borderRadius: String(style.valueBorderRadius ?? ''),
  };
}

function baseAppearance(obj: NormalizedGraphicObject): ResolvedValueAppearance {
  const style = obj.style ?? {};
  const mode = resolveValueDisplayMode(style);
  const fillImage = FILL_IMAGE_TYPES.has(obj.type)
    ? EMPTY(String(style.fillImage ?? ''))
    : undefined;
  return {
    displayMode: mode,
    variant: resolveValueVariant(style),
    background: EMPTY(String(style.background ?? '')),
    fill: EMPTY(String(style.fill ?? '')),
    color: EMPTY(String(style.color ?? '')),
    imageUrl: mode === 'image' ? fillImage : undefined,
    visible: true,
  };
}

function defaultAppearance(
  obj: NormalizedGraphicObject,
  displayValue: CurrentTagValue | undefined,
): ResolvedValueAppearance {
  if (isBinaryStatusType(obj.type, obj.style)) {
    return ledBinaryDefaults(obj, displayValue);
  }
  const base = baseAppearance(obj);
  if (isDiscreteStatusType(obj.type, obj.style)) {
    const slot = resolveSlotAppearance(obj, displayValue);
    return {
      ...base,
      ...slot,
      displayMode: base.displayMode,
      variant: base.variant,
    };
  }
  return base;
}

/**
 * Resolves per-tag visual state for value widgets: colors, images, GLB, text overrides.
 * Value rules are evaluated first (first match wins), then type-specific defaults.
 */
export function resolveValueStateAppearance(
  obj: NormalizedGraphicObject,
  displayValue: CurrentTagValue | undefined,
  valuesByTag?: Map<string, CurrentTagValue>,
  actionImageUrl?: string,
): ResolvedValueAppearance {
  let appearance = defaultAppearance(obj, displayValue);
  const rules = parseValueRules(obj.style);
  for (const rule of rules) {
    if (matchesValueRule(rule, obj, displayValue, valuesByTag)) {
      appearance = applyRuleToAppearance(appearance, rule);
      break;
    }
  }
  if (actionImageUrl) appearance.imageUrl = actionImageUrl;

  const style = obj.style ?? {};
  if (isBinaryStatusType(obj.type, obj.style)) {
    const on = isTruthyOn(displayValue?.value);
    if (appearance.displayMode === 'image' && !appearance.imageUrl) {
      appearance.imageUrl = EMPTY(on ? String(style.stateOnImage ?? '') : String(style.stateOffImage ?? ''));
    }
    if (appearance.displayMode === 'model3d' && !appearance.glbUrl) {
      appearance.glbUrl = EMPTY(on ? String(style.stateOnGlb ?? '') : String(style.stateOffGlb ?? ''));
    }
  }

  return finalizeAppearance(obj, appearance, displayValue);
}

/** True when widget should render image/3D shell (not plain classic chip). */
export function usesVisualShell(appearance: ResolvedValueAppearance): boolean {
  if (appearance.displayMode === 'model3d' && appearance.glbUrl) return true;
  if (appearance.displayMode === 'image' && appearance.imageUrl) return true;
  return false;
}

function finalizeAppearance(
  obj: NormalizedGraphicObject,
  appearance: ResolvedValueAppearance,
  displayValue: CurrentTagValue | undefined,
): ResolvedValueAppearance {
  const style = obj.style ?? {};
  const mode = resolveValueDisplayMode(style);
  let next = { ...appearance };

  if (isDiscreteStatusType(obj.type, obj.style)) {
    const slot = resolveSlotAppearance(obj, displayValue);
    if (slot.imageUrl) next.imageUrl = slot.imageUrl;
    if (slot.glbUrl) next.glbUrl = slot.glbUrl;
    if (slot.text) next.text = slot.text;
    if (slot.background || slot.fill) next.background = slot.background ?? slot.fill;
    if (slot.color) next.color = slot.color;
    if (mode === 'model3d' && next.glbUrl) next.displayMode = 'model3d';
    else if (mode === 'image' && next.imageUrl) next.displayMode = 'image';
    else next.displayMode = 'classic';
  } else if (isBinaryStatusType(obj.type, obj.style)) {
    const on = isTruthyOn(displayValue?.value);
    if (!next.imageUrl) {
      next.imageUrl = EMPTY(on ? String(style.stateOnImage ?? '') : String(style.stateOffImage ?? ''));
    }
    if (!next.glbUrl) {
      next.glbUrl = EMPTY(on ? String(style.stateOnGlb ?? '') : String(style.stateOffGlb ?? ''));
    }
    if (next.glbUrl && mode === 'model3d') next.displayMode = 'model3d';
    else if (next.imageUrl && mode === 'image') next.displayMode = 'image';
    else next.displayMode = 'classic';
  } else if (FILL_IMAGE_TYPES.has(obj.type)) {
    const fillImage = EMPTY(String(style.fillImage ?? ''));
    if (mode === 'image' && fillImage) {
      next.imageUrl = fillImage;
      next.displayMode = 'image';
    } else {
      if (next.displayMode === 'image' || next.displayMode === 'model3d') next.displayMode = 'classic';
      if (!next.imageUrl || next.imageUrl === fillImage) next.imageUrl = undefined;
    }
  } else if (next.displayMode === 'image' || next.displayMode === 'model3d') {
    next.displayMode = 'classic';
  }

  return next;
}

export type { WidgetStateSlot };
export {
  parseStateSlots,
  serializeStateSlots,
  defaultStateSlotsForType,
  syncLegacyStateFields,
  resolveStateSlot,
} from './stateSlots';
