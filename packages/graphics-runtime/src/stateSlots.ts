import type { CurrentTagValue, NormalizedGraphicObject } from './types';

export type WidgetStateSlot = {
  value: number;
  label: string;
  color?: string;
  imageUrl?: string;
  glbUrl?: string;
};

export function parseStateSlots(style: Record<string, unknown> | undefined): WidgetStateSlot[] {
  const raw = style?.stateSlotsJson;
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        return parsed
          .filter((s): s is WidgetStateSlot => Boolean(s && typeof s === 'object' && typeof (s as WidgetStateSlot).label === 'string'))
          .map((s) => ({ ...s, value: Number(s.value) }));
      }
    } catch {
      /* fall through */
    }
  }
  const badgeMap = style?.badgeMap;
  if (typeof badgeMap === 'string' && badgeMap.trim()) {
    return stateSlotsFromBadgeMap(badgeMap);
  }
  const states = style?.states;
  if (typeof states === 'string' && states.trim()) {
    return states
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((label, i) => ({ value: i, label, color: defaultStateColor(i) }));
  }
  return [];
}

export function serializeStateSlots(slots: WidgetStateSlot[]): string {
  const clean = slots.map((s) => {
    const o: WidgetStateSlot = { value: s.value, label: s.label };
    if (s.color) o.color = s.color;
    if (s.imageUrl) o.imageUrl = s.imageUrl;
    if (s.glbUrl) o.glbUrl = s.glbUrl;
    return o;
  });
  return JSON.stringify(clean);
}

function defaultStateColor(index: number): string {
  const palette = ['#94a3b8', '#22c55e', '#ef4444', '#f59e0b', '#6366f1'];
  return palette[index % palette.length];
}

export function stateSlotsFromBadgeMap(badgeMap: string): WidgetStateSlot[] {
  const out: WidgetStateSlot[] = [];
  for (const part of badgeMap.split(',')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const [valStr, label, color] = trimmed.split(':').map((s) => s.trim());
    const value = Number(valStr);
    if (!Number.isFinite(value) || !label) continue;
    out.push({ value, label, color: color || defaultStateColor(value) });
  }
  return out;
}

export function badgeMapFromStateSlots(slots: WidgetStateSlot[]): string {
  return slots.map((s) => `${s.value}:${s.label}:${s.color ?? '#64748b'}`).join(',');
}

export function resolveStateSlot(
  numVal: number | null,
  slots: WidgetStateSlot[],
): WidgetStateSlot | null {
  if (slots.length === 0) return null;
  const key = numVal != null && Number.isFinite(numVal) ? Math.round(numVal) : 0;
  return slots.find((s) => s.value === key) ?? slots.find((s) => s.value === 0) ?? slots[0];
}

export function defaultStateSlotsForType(type: string): WidgetStateSlot[] {
  if (type === 'statusbadge') {
    return [
      { value: 0, label: 'Offline', color: '#94a3b8' },
      { value: 1, label: 'Online', color: '#22c55e' },
      { value: 2, label: 'Fault', color: '#ef4444' },
    ];
  }
  if (type === 'multistate') {
    return [
      { value: 0, label: 'Stopped', color: '#94a3b8' },
      { value: 1, label: 'Running', color: '#22c55e' },
      { value: 2, label: 'Fault', color: '#ef4444' },
    ];
  }
  if (type === 'semaphore') {
    return [
      { value: 0, label: 'ปกติ', color: '#22c55e' },
      { value: 1, label: 'เตือน', color: '#f59e0b' },
      { value: 2, label: 'อันตราย', color: '#ef4444' },
    ];
  }
  return [];
}

export function syncLegacyStateFields(
  type: string,
  slots: WidgetStateSlot[],
): Record<string, string> {
  const patch: Record<string, string> = { stateSlotsJson: serializeStateSlots(slots) };
  if (type === 'statusbadge') patch.badgeMap = badgeMapFromStateSlots(slots);
  if (type === 'multistate') patch.states = slots.map((s) => s.label).join(',');
  return patch;
}

export function resolveSlotAppearance(
  obj: NormalizedGraphicObject,
  displayValue: CurrentTagValue | undefined,
): { text?: string; background?: string; fill?: string; color?: string; imageUrl?: string; glbUrl?: string } {
  const num = displayValue?.value != null ? Number(displayValue.value) : null;
  const slot = resolveStateSlot(num, parseStateSlots(obj.style));
  if (!slot) return {};
  return {
    text: slot.label,
    background: slot.color,
    fill: slot.color,
    imageUrl: slot.imageUrl,
    glbUrl: slot.glbUrl,
  };
}
