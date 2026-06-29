import type React from 'react';
import type { WidgetAnimation, WidgetCondition } from '@energylink/shared-types';
import type { CurrentTagValue, NormalizedGraphicObject } from './types';
import type { ResolvedActionEffect } from './objectLogic';

type TagCmp = Extract<WidgetCondition, { op: 'tag' }>['cmp'];

function parseNum(value: CurrentTagValue['value']): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function compare(cmp: TagCmp, left: number, right: number, min?: number, max?: number): boolean {
  switch (cmp) {
    case 'eq': return left === right;
    case 'ne': return left !== right;
    case 'gt': return left > right;
    case 'gte': return left >= right;
    case 'lt': return left < right;
    case 'lte': return left <= right;
    case 'between':
      return min !== undefined && max !== undefined && left >= min && left <= max;
    default:
      return false;
  }
}

export function evaluateWidgetCondition(
  when: WidgetCondition,
  valuesByTag: Map<string, CurrentTagValue>,
): boolean {
  if (when.op === 'tag') {
    const num = parseNum(valuesByTag.get(when.tagId)?.value);
    if (num === null) return false;
    const threshold = Number(when.value ?? 0);
    return compare(when.cmp, num, threshold, when.min, when.max);
  }
  if (when.op === 'and') {
    return (when.args ?? []).every((c) => evaluateWidgetCondition(c, valuesByTag));
  }
  if (when.op === 'or') {
    return (when.args ?? []).some((c) => evaluateWidgetCondition(c, valuesByTag));
  }
  if (when.op === 'not' && when.arg) {
    return !evaluateWidgetCondition(when.arg, valuesByTag);
  }
  return false;
}

function applyAnimationEffect(
  anim: WidgetAnimation,
  style: React.CSSProperties & Record<string, string | number>,
  transforms: string[],
  state: { className: string; imageUrl?: string; hasMotion: boolean },
): void {
  const opt = anim.options ?? {};
  switch (anim.kind) {
    case 'hide':
      style.visibility = 'hidden';
      break;
    case 'show':
      style.visibility = 'visible';
      break;
    case 'color':
      if (opt.color) style.background = opt.color;
      if (opt.stroke) style.borderColor = opt.stroke;
      break;
    case 'blink':
      state.className += ' rt-action-blink';
      state.hasMotion = true;
      if (opt.fillA) style.background = opt.fillA;
      break;
    case 'rotate': {
      const minA = Number(opt.minAngle ?? 0);
      const maxA = Number(opt.maxAngle ?? 360);
      const deg = (minA + maxA) / 2;
      transforms.push(`rotate(${deg}deg)`);
      state.hasMotion = true;
      break;
    }
    case 'move':
      if (opt.toX != null) style.left = opt.toX;
      if (opt.toY != null) style.top = opt.toY;
      state.hasMotion = true;
      break;
    case 'swapImage':
      if (opt.imageUrl) state.imageUrl = opt.imageUrl;
      break;
    default:
      break;
  }
}

/** Resolve declarative animations[] (Phase 1 schema) into runtime effects. */
export function resolveWidgetAnimations(
  obj: NormalizedGraphicObject,
  valuesByTag: Map<string, CurrentTagValue>,
): ResolvedActionEffect | null {
  const animations = obj.animations;
  if (!Array.isArray(animations) || animations.length === 0) return null;

  const style: React.CSSProperties & Record<string, string | number> = {};
  const transforms: string[] = [];
  const state = { className: '', imageUrl: undefined as string | undefined, hasMotion: false };

  const sorted = [...animations].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  for (const anim of sorted) {
    if (!anim?.when) continue;
    if (!evaluateWidgetCondition(anim.when, valuesByTag)) continue;
    applyAnimationEffect(anim, style, transforms, state);
  }

  if (transforms.length) style.transform = transforms.join(' ');
  if (!state.className && Object.keys(style).length === 0 && !state.imageUrl) return null;

  return {
    style,
    className: state.className,
    imageUrl: state.imageUrl,
  };
}
