import type { CurrentTagValue } from '../types/monitor';

export function normalizeQuality(q?: string | null): string {
  const s = String(q ?? '').toLowerCase();
  if (s === 'good' || s === 'ok') return 'good';
  if (s === 'bad' || s === 'error') return 'bad';
  if (s === 'warn' || s === 'warning') return 'warn';
  return s || 'unknown';
}

export function latestDeviceReadAt(values: CurrentTagValue[]): string | null {
  let best: string | null = null;
  let bestMs = 0;
  for (const v of values) {
    if (!v.lastValueAt) continue;
    const ms = new Date(v.lastValueAt).getTime();
    if (ms > bestMs) {
      bestMs = ms;
      best = v.lastValueAt;
    }
  }
  return best;
}

export function isFreshRead(readAt?: string | null, maxAgeMs = 30_000): boolean {
  if (!readAt) return false;
  return Date.now() - new Date(readAt).getTime() <= maxAgeMs;
}
