import type { RuntimeDevice } from '../types/monitor';

export type DeviceImageFields = {
  imageUrl?: string | null;
  imageDataUrl?: string | null;
  thumbnailUrl?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type DeviceVisualKind = 'converter' | 'meter' | 'other';

export function deviceVisualKind(type?: string): DeviceVisualKind {
  const t = String(type ?? '').toLowerCase();
  if (t.includes('converter') || t === 'converter') return 'converter';
  if (t.includes('meter') || t === 'meter') return 'meter';
  return 'other';
}

/** Resolve device image from API fields (future Editor uploads). */
export function getDeviceImageSrc(device: RuntimeDevice & DeviceImageFields): string | null {
  const meta = device.metadata;
  const fromMeta =
    (typeof meta?.imageUrl === 'string' && meta.imageUrl) ||
    (typeof meta?.imageDataUrl === 'string' && meta.imageDataUrl) ||
    (typeof meta?.thumbnailUrl === 'string' && meta.thumbnailUrl) ||
    null;
  return device.imageUrl || device.imageDataUrl || device.thumbnailUrl || fromMeta || null;
}

export function liveBadgeClass(badge: string): string {
  if (badge === 'good') return 'good';
  if (badge === 'warn') return 'warn';
  if (badge === 'bad') return 'bad';
  return 'unknown';
}
