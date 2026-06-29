import type React from 'react';
import type { CurrentTagValue, NormalizedGraphicObject, RuntimeAlarm } from './types';

export type WriteTagOptions = {
  presetValue?: number | boolean | string;
  requireConfirm?: boolean;
};

type CompareOp = '>' | '<' | '>=' | '<=' | '==' | '!=';

function parseNum(value: CurrentTagValue['value']): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function compareValues(left: number, op: CompareOp, right: number): boolean {
  switch (op) {
    case '>': return left > right;
    case '<': return left < right;
    case '>=': return left >= right;
    case '<=': return left <= right;
    case '==': return left === right;
    case '!=': return left !== right;
    default: return true;
  }
}

export function resolveCompareOp(raw: unknown): CompareOp {
  const ops: CompareOp[] = ['>', '<', '>=', '<=', '==', '!='];
  return ops.includes(raw as CompareOp) ? (raw as CompareOp) : '>';
}

export function evaluateTagRule(
  tagId: string | undefined,
  op: CompareOp,
  threshold: number,
  valuesByTag: Map<string, CurrentTagValue>,
): boolean {
  if (!tagId) return true;
  const val = valuesByTag.get(tagId);
  const num = parseNum(val?.value);
  if (num === null) return false;
  return compareValues(num, op, threshold);
}

/** Runtime visibility — false hides object (editor uses object.visible separately). */
export function resolveRuntimeVisible(
  obj: NormalizedGraphicObject,
  valuesByTag: Map<string, CurrentTagValue>,
): boolean {
  if (obj.visible === false) return false;
  const whenTag = String(obj.style?.visibleWhenTag ?? '') || obj.tagId;
  if (!obj.style?.visibleWhenTag && obj.style?.visibleWhenValue == null && obj.style?.visibleWhenOp == null) {
    return true;
  }
  if (obj.style?.visibleWhenValue == null && !obj.style?.visibleWhenTag) return true;
  const op = resolveCompareOp(obj.style?.visibleWhenOp ?? '>');
  const threshold = Number(obj.style?.visibleWhenValue ?? 0);
  return evaluateTagRule(whenTag, op, threshold, valuesByTag);
}

export function resolveControlEnabled(
  obj: NormalizedGraphicObject,
  valuesByTag: Map<string, CurrentTagValue>,
): boolean {
  const tagId = String(obj.style?.enabledWhenTag ?? '') || obj.enableTagId;
  if (!tagId || (obj.style?.enabledWhenValue == null && !obj.style?.enabledWhenTag)) return true;
  const op = resolveCompareOp(obj.style?.enabledWhenOp ?? '==');
  const threshold = Number(obj.style?.enabledWhenValue ?? 1);
  return evaluateTagRule(tagId, op, threshold, valuesByTag);
}

/** Phase 19 — block writes when interlock tag is active */
export function resolveInterlockBlocked(
  obj: NormalizedGraphicObject,
  valuesByTag: Map<string, CurrentTagValue>,
): boolean {
  const tagId = String(obj.style?.interlockTagId ?? '');
  if (!tagId) return false;
  const val = valuesByTag.get(tagId)?.value;
  const blockWhen = obj.style?.interlockBlockWhen;
  if (blockWhen === undefined || blockWhen === '') {
    return val === true || val === 1 || val === '1';
  }
  if (blockWhen === true || blockWhen === 'true') return val === true || val === 1 || val === '1';
  if (blockWhen === false || blockWhen === 'false') return val === false || val === 0 || val === '0';
  const n = Number(blockWhen);
  if (Number.isFinite(n)) return Number(val) === n;
  return String(val) === String(blockWhen);
}

export function hasActiveAlarmForTag(tagId: string | undefined, alarms: RuntimeAlarm[]): boolean {
  if (!tagId) return false;
  return alarms.some((a) => a.status === 'active' && a.tagId === tagId);
}

/** Collect distinct floor levels from layout objects (Phase 11) */
export function collectFloorLevels(objects: Array<{ style?: Record<string, unknown> }>): number[] {
  const levels = new Set<number>();
  for (const obj of objects) {
    const raw = obj.style?.floorLevel;
    if (raw == null || raw === '') continue;
    const n = Number(raw);
    if (Number.isFinite(n)) levels.add(n);
  }
  return [...levels].sort((a, b) => a - b);
}

/** Hide objects on other floors when a floor filter is active */
export function resolveFloorVisible(
  obj: { style?: Record<string, unknown> },
  activeFloor: number | null | undefined,
): boolean {
  const raw = obj.style?.floorLevel;
  if (raw == null || raw === '') return true;
  if (activeFloor == null) return true;
  return Number(raw) === activeFloor;
}

export function parseMemberIds(raw: unknown): string[] {
  if (typeof raw !== 'string' || !raw.trim()) return [];
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

export function formatMemberIds(ids: string[]): string {
  return ids.join(',');
}

export function applyTransformStyle(
  style: React.CSSProperties,
  obj: NormalizedGraphicObject,
): React.CSSProperties {
  const opacity = obj.style?.opacity;
  const rotation = obj.style?.rotation;
  const transforms: string[] = [];
  if (rotation != null && Number.isFinite(Number(rotation))) {
    transforms.push(`rotate(${Number(rotation)}deg)`);
  }
  const out: React.CSSProperties = { ...style };
  if (opacity != null && Number.isFinite(Number(opacity))) {
    out.opacity = Math.max(0, Math.min(1, Number(opacity)));
  }
  if (transforms.length) {
    out.transform = transforms.join(' ');
    out.transformOrigin = 'center center';
  }
  return out;
}

export function applyBaseWidgetStyle(
  style: React.CSSProperties,
  obj: NormalizedGraphicObject,
): React.CSSProperties {
  const out = applyTransformStyle(style, obj);

  // Typography
  const fontFamily = obj.style?.fontFamily;
  if (typeof fontFamily === 'string' && fontFamily.trim()) {
    out.fontFamily = fontFamily.trim();
  }
  
  if (obj.style?.color) {
    out.color = String(obj.style.color);
  }

  const fontSize = obj.style?.fontSize;
  if (fontSize != null && Number.isFinite(Number(fontSize))) {
    out.fontSize = `${Number(fontSize)}px`;
  }

  const fontWeight = obj.style?.fontWeight;
  if (fontWeight) {
    out.fontWeight = fontWeight as any;
  }

  const isItalic = obj.style?.isItalic;
  if (isItalic === true || isItalic === 'true') {
    out.fontStyle = 'italic';
  }

  // Alignment
  const align = String(obj.style?.align ?? '');
  if (align === 'left' || align === 'flex-start') {
    out.alignItems = 'flex-start';
    out.textAlign = 'left';
  } else if (align === 'center') {
    out.alignItems = 'center';
    out.textAlign = 'center';
  } else if (align === 'right' || align === 'flex-end') {
    out.alignItems = 'flex-end';
    out.textAlign = 'right';
  }

  // Gradients
  const fillColor2 = obj.style?.fillColor2;
  const fill = obj.style?.fill ?? obj.style?.background ?? 'transparent';
  if (fillColor2) {
    const dir = String(obj.style?.gradientDirection ?? 'to bottom');
    if (dir === 'radial') {
      out.background = `radial-gradient(circle, ${fill}, ${fillColor2})`;
    } else {
      out.background = `linear-gradient(${dir}, ${fill}, ${fillColor2})`;
    }
  }

  // Shadows
  const shadowColor = obj.style?.shadowColor;
  if (shadowColor) {
    const blur = Number(obj.style?.shadowBlur ?? 4);
    const offsetX = Number(obj.style?.shadowOffsetX ?? 0);
    const offsetY = Number(obj.style?.shadowOffsetY ?? 4);
    // Use drop-shadow filter so it wraps SVG and boxes perfectly
    out.filter = `drop-shadow(${offsetX}px ${offsetY}px ${blur}px ${shadowColor})`;
  }

  // Text Shadow
  const textShadowBlur = obj.style?.textShadowBlur;
  if (textShadowBlur != null && Number(textShadowBlur) > 0) {
    out.textShadow = `0px 2px ${Number(textShadowBlur)}px rgba(0,0,0,0.5)`;
  }

  return out;
}

export function formatDynamicText(
  template: string,
  value?: CurrentTagValue,
  fallbackName?: string,
): string {
  if (!template.includes('{')) return template;
  const num = value?.value != null ? Number(value.value) : null;
  const dp = Number.isFinite(value?.decimalPlaces as number) ? Number(value?.decimalPlaces) : 2;
  const formatted = num != null && Number.isFinite(num) ? num.toFixed(dp) : '--';
  return template
    .replace(/\{name\}/gi, value?.name ?? fallbackName ?? '')
    .replace(/\{value\}/gi, formatted)
    .replace(/\{unit\}/gi, value?.unit ?? '')
    .replace(/\{quality\}/gi, value?.quality ?? '');
}

export function resolveSwitchWriteValue(
  obj: NormalizedGraphicObject,
  value: CurrentTagValue | undefined,
): boolean {
  const on = value?.value === true || value?.value === 1 || value?.value === '1';
  const onVal = obj.style?.writeOnValue;
  const offVal = obj.style?.writeOffValue;
  const onNum = onVal != null ? Number(onVal) === 1 || onVal === true : true;
  const offNum = offVal != null ? Number(offVal) === 1 || offVal === true : false;
  return on ? offNum : onNum;
}

export function resolveButtonWriteValue(obj: NormalizedGraphicObject): number | boolean | undefined {
  const raw = obj.style?.writeValue;
  if (raw === undefined || raw === '') return undefined;
  if (raw === true || raw === 'true') return true;
  if (raw === false || raw === 'false') return false;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

export type BadgeEntry = { label: string; color: string };

/** Parse "0:Stop:#94a3b8,1:Run:#22c55e" */
export function parseBadgeMap(raw: unknown): Map<number, BadgeEntry> {
  const map = new Map<number, BadgeEntry>();
  if (typeof raw !== 'string' || !raw.trim()) return map;
  for (const part of raw.split(',')) {
    const [valStr, label, color] = part.split(':').map((s) => s.trim());
    const num = Number(valStr);
    if (!Number.isFinite(num) || !label) continue;
    map.set(num, { label, color: color || '#64748b' });
  }
  return map;
}

export function resolveStatusBadge(
  numVal: number | null,
  alarm: RuntimeAlarm | undefined,
  style: Record<string, string | number | boolean | undefined> | undefined,
): BadgeEntry {
  if (alarm?.status === 'active') {
    return { label: String(alarm.severity ?? 'ALARM').toUpperCase(), color: String(style?.alarmBadgeColor ?? '#ef4444') };
  }
  const map = parseBadgeMap(style?.badgeMap);
  const key = numVal != null && Number.isFinite(numVal) ? Math.round(numVal) : 0;
  return map.get(key) ?? { label: String(key), color: '#64748b' };
}

const FORMULA_SAFE = /^[\d\s.+\-*/()eE]+$/;

export type FormulaValidation = { ok: true } | { ok: false; error: string };

/** Dry-run formula syntax with placeholder values (1) for bound tags. */
export function validateFormulaSyntax(formula: string, tagIds: string[]): FormulaValidation {
  const trimmed = formula.trim();
  if (!trimmed) return { ok: false, error: 'Formula is empty' };

  const letters = trimmed.match(/\b[A-Z]\b/g) ?? [];
  for (const letter of letters) {
    const idx = letter.charCodeAt(0) - 65;
    if (idx < 0 || idx >= tagIds.length) {
      return { ok: false, error: `Variable ${letter} has no bound tag (assign tags A–Z in order)` };
    }
  }

  let expr = trimmed;
  for (const id of tagIds) {
    expr = expr.replaceAll(`{${id}}`, '1');
  }
  tagIds.forEach((_, i) => {
    const letter = String.fromCharCode(65 + i);
    expr = expr.replace(new RegExp(`\\b${letter}\\b`, 'g'), '1');
  });

  if (!FORMULA_SAFE.test(expr)) {
    return { ok: false, error: 'Formula contains invalid characters (use numbers, + - * / ( ) and A/B/C or {tagId})' };
  }
  try {
    const result = Function(`"use strict"; return (${expr})`)() as number;
    if (!Number.isFinite(result)) return { ok: false, error: 'Formula does not evaluate to a finite number' };
    return { ok: true };
  } catch {
    return { ok: false, error: 'Syntax error in formula' };
  }
}

/** Evaluate formula with {tagId} placeholders and A/B/C from tagIds order. */
export function evaluateFormula(
  formula: string,
  tagIds: string[],
  valuesByTag: Map<string, CurrentTagValue>,
): number | null {
  if (!formula.trim()) return null;
  let expr = formula.trim();
  for (const [id, val] of valuesByTag) {
    const num = val.value != null ? Number(val.value) : NaN;
    if (!Number.isFinite(num)) continue;
    expr = expr.replaceAll(`{${id}}`, String(num));
  }
  tagIds.forEach((id, i) => {
    const letter = String.fromCharCode(65 + i);
    const num = valuesByTag.get(id)?.value;
    const n = num != null ? Number(num) : NaN;
    if (Number.isFinite(n)) {
      expr = expr.replace(new RegExp(`\\b${letter}\\b`, 'g'), String(n));
    }
  });
  if (!FORMULA_SAFE.test(expr)) return null;
  try {
    const result = Function(`"use strict"; return (${expr})`)() as number;
    return Number.isFinite(result) ? result : null;
  } catch {
    return null;
  }
}

export type TagTableColumn = 'name' | 'value' | 'unit' | 'quality' | 'device';

export function parseTagTableColumns(raw: unknown): TagTableColumn[] {
  const all: TagTableColumn[] = ['name', 'value', 'unit', 'quality', 'device'];
  if (typeof raw !== 'string' || !raw.trim()) return ['name', 'value', 'unit'];
  const cols = raw.split(',').map((s) => s.trim().toLowerCase()) as TagTableColumn[];
  return cols.filter((c) => all.includes(c));
}

export function tagTableToCsv(rows: CurrentTagValue[], columns: TagTableColumn[]): string {
  const header = columns.join(',');
  const lines = rows.map((row) =>
    columns.map((col) => {
      if (col === 'name') return `"${(row.name ?? '').replace(/"/g, '""')}"`;
      if (col === 'value') return row.value != null ? String(row.value) : '';
      if (col === 'unit') return `"${(row.unit ?? '').replace(/"/g, '""')}"`;
      if (col === 'quality') return row.quality ?? '';
      if (col === 'device') return `"${(row.deviceName ?? row.deviceId ?? '').replace(/"/g, '""')}"`;
      return '';
    }).join(','),
  );
  return [header, ...lines].join('\n');
}

/**
 * Value-driven actions (SCADA): when a bound tag value enters [min, max] the object
 * can blink / change color / show / hide / move / rotate. Inspired by FUXA's gauge
 * actions, implemented for React/DOM via inline style + a single injected keyframe.
 */
let blinkStylesInjected = false;
function ensureActionStyles(): void {
  if (blinkStylesInjected || typeof document === 'undefined') return;
  blinkStylesInjected = true;
  if (document.getElementById('rt-actions-keyframes')) return;
  const el = document.createElement('style');
  el.id = 'rt-actions-keyframes';
  el.textContent =
    '@keyframes rtActionBlink{0%,49%{background:var(--rt-blink-a,#ef4444)!important;border-color:var(--rt-blink-a,#ef4444)!important}50%,100%{background:var(--rt-blink-b,transparent)!important}}' +
    '.rt-action-blink{animation-name:rtActionBlink;animation-iteration-count:infinite;animation-timing-function:steps(1,end)}';
  document.head.appendChild(el);
}

export type ResolvedActionEffect = { style: React.CSSProperties; className: string; imageUrl?: string };

export function resolveObjectActions(
  obj: NormalizedGraphicObject,
  valuesByTag: Map<string, CurrentTagValue>,
): ResolvedActionEffect | null {
  const actions = obj.actions;
  if (!Array.isArray(actions) || actions.length === 0) return null;

  const style: React.CSSProperties & Record<string, string | number> = {};
  const transforms: string[] = [];
  let className = '';
  let hasMotion = false;
  let imageUrl: string | undefined;

  for (const act of actions) {
    if (!act || !act.tagId) continue;
    const num = parseNum(valuesByTag.get(act.tagId)?.value);
    if (num === null) continue;
    const min = Number(act.min);
    const max = Number(act.max);
    const inRange = num >= min && num <= max;
    const opt = act.options ?? {};

    switch (act.type) {
      case 'hide':
        if (inRange) style.visibility = 'hidden';
        break;
      case 'show':
        if (inRange) style.visibility = 'visible';
        break;
      case 'color':
        if (inRange) {
          if (opt.color) style.background = opt.color;
          const stroke = opt.stroke ?? opt.color;
          if (stroke) style.borderColor = stroke;
        }
        break;
      case 'floodFill':
        // PowerStudio-style flood fill: paint the background when in range.
        if (inRange) {
          const fill = opt.fillColor ?? opt.color;
          if (fill) style.background = fill;
        }
        break;
      case 'swapImage':
        // PowerStudio-style dynamic image: replace the displayed image when in range.
        if (inRange && opt.imageUrl) imageUrl = opt.imageUrl;
        break;
      case 'blink':
        if (inRange) {
          ensureActionStyles();
          className += ' rt-action-blink';
          if (opt.fillA) (style as Record<string, string>)['--rt-blink-a'] = opt.fillA;
          if (opt.fillB) (style as Record<string, string>)['--rt-blink-b'] = opt.fillB;
          style.animationDuration = `${Math.max(100, Number(opt.interval ?? 700))}ms`;
        }
        break;
      case 'rotate': {
        const minA = Number(opt.minAngle ?? 0);
        const maxA = Number(opt.maxAngle ?? 360);
        const span = max - min;
        const ratio = span === 0 ? (num >= min ? 1 : 0) : Math.min(1, Math.max(0, (num - min) / span));
        transforms.push(`rotate(${(minA + ratio * (maxA - minA)).toFixed(2)}deg)`);
        hasMotion = true;
        break;
      }
      case 'move':
        if (inRange) {
          transforms.push(`translate(${Number(opt.toX ?? 0)}px, ${Number(opt.toY ?? 0)}px)`);
        }
        hasMotion = true;
        break;
      default:
        break;
    }
  }

  if (transforms.length) {
    style.transform = transforms.join(' ');
    style.transformOrigin = 'center center';
  }
  if (hasMotion && !style.transition) {
    style.transition = 'transform 250ms ease';
  }
  if (Object.keys(style).length === 0 && !className && !imageUrl) return null;
  return { style, className, imageUrl };
}
