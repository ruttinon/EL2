import type React from 'react';
import type { NormalizedGraphicObject, RawGraphicObject } from './types';

export function resolveFlowTagId(obj: RawGraphicObject): string | undefined {
  const id = obj.binding?.flowTagId ?? obj.style?.flowTagId ?? obj.tagId ?? obj.binding?.tagId;
  return id == null || id === '' ? undefined : String(id);
}

export function resolveEnableTagId(obj: RawGraphicObject): string | undefined {
  const id = obj.binding?.enableTagId ?? obj.style?.enableTagId;
  return id == null || id === '' ? undefined : String(id);
}

export function resolveObjectTagId(obj: RawGraphicObject): string | undefined {
  const id = obj.tagId ?? obj.binding?.tagId;
  return id == null || id === '' ? undefined : String(id);
}

export function resolveObjectTagIds(obj: RawGraphicObject): string[] {
  if (Array.isArray(obj.tagIds) && obj.tagIds.length > 0) return obj.tagIds;
  if (Array.isArray(obj.binding?.tagIds) && obj.binding.tagIds.length > 0) return obj.binding.tagIds;
  const single = resolveObjectTagId(obj);
  return single ? [single] : [];
}

export function resolveObjectDeviceId(obj: RawGraphicObject): string | undefined {
  const id = obj.deviceId ?? obj.binding?.deviceId ?? obj.style?.deviceId;
  return id == null || id === '' ? undefined : String(id);
}

export function resolveNavigateTo(obj: RawGraphicObject): string | undefined {
  const id = obj.navigateTo ?? obj.style?.navigateTo;
  return id == null || id === '' ? undefined : String(id);
}

export function normalizeGraphicObject(obj: RawGraphicObject): NormalizedGraphicObject {
  const style = { ...(obj.style ?? {}) };
  if (!style.borderColor && style.stroke) style.borderColor = style.stroke;
  if (!style.background && style.fill) style.background = style.fill;
  const imageDataUrl = obj.imageDataUrl ?? (style.imageDataUrl as string | undefined);
  if (imageDataUrl) style.imageDataUrl = imageDataUrl;

  return {
    ...obj,
    tagId: resolveObjectTagId(obj),
    tagIds: resolveObjectTagIds(obj),
    deviceId: resolveObjectDeviceId(obj),
    navigateTo: resolveNavigateTo(obj),
    flowTagId: resolveFlowTagId(obj),
    enableTagId: resolveEnableTagId(obj),
    style,
  };
}

export function sortGraphicObjects(objects: RawGraphicObject[]): NormalizedGraphicObject[] {
  return [...objects]
    .map(normalizeGraphicObject)
    .sort((a, b) => (a.layer ?? 0) - (b.layer ?? 0));
}

export function normalizeObjectForSave(obj: RawGraphicObject): RawGraphicObject {
  const normalized = normalizeGraphicObject(obj);
  const binding = {
    ...(obj.binding ?? {}),
    tagId: normalized.tagId ?? null,
    tagIds: normalized.tagIds,
    deviceId: normalized.deviceId,
    flowTagId: normalized.flowTagId ?? null,
    enableTagId: normalized.enableTagId ?? null,
  };
  const style = { ...normalized.style };
  if (obj.style?.stroke) style.stroke = obj.style.stroke;
  if (normalized.navigateTo) style.navigateTo = normalized.navigateTo;
  return {
    ...obj,
    tagId: normalized.tagId,
    tagIds: normalized.tagIds,
    deviceId: normalized.deviceId,
    navigateTo: normalized.navigateTo,
    flowTagId: normalized.flowTagId,
    enableTagId: normalized.enableTagId,
    binding,
    style,
  };
}

export function normalizeLayoutForSave(objects: RawGraphicObject[]): RawGraphicObject[] {
  return objects.map(normalizeObjectForSave);
}

export function trendPeriodToRange(period: string | undefined): { from: string; to: string; limit: number } {
  const now = Date.now();
  const to = new Date(now).toISOString();
  switch (period) {
    case '1h':
      return { from: new Date(now - 60 * 60 * 1000).toISOString(), to, limit: 120 };
    case '7d':
      return { from: new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString(), to, limit: 500 };
    case '24h':
    default:
      return { from: new Date(now - 24 * 60 * 60 * 1000).toISOString(), to, limit: 300 };
  }
}

export function applyConditionalStyle(
  base: React.CSSProperties,
  value: number | null | undefined,
  style: Record<string, string | number | boolean | undefined> | undefined,
): React.CSSProperties {
  if (value == null || !Number.isFinite(value)) return base;
  const high = typeof style?.thresholdHigh === 'number' ? style.thresholdHigh : Number(style?.thresholdHigh);
  const low = typeof style?.thresholdLow === 'number' ? style.thresholdLow : Number(style?.thresholdLow);
  const alarmColor = String(style?.alarmColor ?? '#fee2e2');
  const warningColor = String(style?.warningColor ?? '#fef3c7');
  if (Number.isFinite(high) && value >= high) {
    return { ...base, background: alarmColor, borderColor: '#ef4444' };
  }
  if (Number.isFinite(low) && value <= low) {
    return { ...base, background: warningColor, borderColor: '#f59e0b' };
  }
  return base;
}
