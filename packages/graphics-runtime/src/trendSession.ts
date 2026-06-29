import type { CurrentTagValue, TrendPoint, TrendResponse } from './types.js';

const SESSION_TREND_MAX = 600;

/** Accumulate live tag reads into a session buffer (for preview when DB history is empty). */
export function appendSessionTrend(buf: Map<string, TrendPoint[]>, values: CurrentTagValue[]): void {
  const now = Date.now();
  for (const v of values) {
    if (v.value == null || !Number.isFinite(Number(v.value))) continue;
    const pts = buf.get(v.id) ?? [];
    const last = pts[pts.length - 1];
    const readAt = new Date(now).toISOString();
    if (last && now - new Date(last.readAt).getTime() < 800) {
      pts[pts.length - 1] = {
        ...last,
        value: Number(v.value),
        readAt,
        unit: v.unit ?? last.unit,
        tagName: v.name ?? last.tagName,
      };
    } else {
      pts.push({
        tagId: v.id,
        tagName: v.name,
        value: Number(v.value),
        readAt,
        unit: v.unit ?? undefined,
        quality: v.quality,
      });
    }
    while (pts.length > SESSION_TREND_MAX) pts.shift();
    buf.set(v.id, pts);
  }
}

export function filterSessionByPeriod(pts: TrendPoint[], fromIso: string): TrendPoint[] {
  const fromMs = new Date(fromIso).getTime();
  return pts.filter((p) => new Date(p.readAt).getTime() >= fromMs);
}

/** Prefer API history; fall back to live session buffer when history is empty. */
export function resolveTrendPoints(
  api: TrendResponse | null | undefined,
  sessionBuf: Map<string, TrendPoint[]>,
  tagId: string,
  fromIso: string,
): TrendPoint[] {
  const apiPts = (api?.values ?? []).filter((p) => p.value != null && Number.isFinite(Number(p.value)));
  if (apiPts.length > 0) return apiPts;
  return filterSessionByPeriod(sessionBuf.get(tagId) ?? [], fromIso);
}
