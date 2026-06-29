export type PathPoint = { x: number; y: number };

export function parsePathPoints(
  raw: string | number | boolean | undefined,
  width: number,
  height: number,
): PathPoint[] {
  if (!raw || typeof raw !== 'string') {
    return [
      { x: 0, y: height / 2 },
      { x: width, y: height / 2 },
    ];
  }
  const pts = raw
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [xs, ys] = part.split(',').map((v) => Number(v.trim()));
      return { x: Number.isFinite(xs) ? xs : 0, y: Number.isFinite(ys) ? ys : 0 };
    })
    .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  if (pts.length >= 2) return pts;
  return [
    { x: 0, y: height / 2 },
    { x: width, y: height / 2 },
  ];
}

export function pathPointsToPolyline(points: PathPoint[]) {
  return points.map((p) => `${p.x},${p.y}`).join(' ');
}

/** Point at half the polyline arc-length (for wire labels). */
export function pathMidpoint(points: PathPoint[]): PathPoint {
  if (points.length === 0) return { x: 0, y: 0 };
  if (points.length === 1) return points[0];
  let total = 0;
  const segLens: number[] = [];
  for (let i = 1; i < points.length; i++) {
    const d = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    segLens.push(d);
    total += d;
  }
  if (total <= 0) return points[0];
  const half = total / 2;
  let acc = 0;
  for (let i = 0; i < segLens.length; i++) {
    if (acc + segLens[i] >= half) {
      const t = (half - acc) / segLens[i];
      return {
        x: points[i].x + (points[i + 1].x - points[i].x) * t,
        y: points[i].y + (points[i + 1].y - points[i].y) * t,
      };
    }
    acc += segLens[i];
  }
  return points[points.length - 1];
}

export function formatFeedLabel(
  prefix: string,
  flowValue?: { value?: unknown; unit?: string | null },
  magnitude?: number,
): string {
  const name = prefix.trim();
  const raw = flowValue?.value;
  const num = raw != null && Number.isFinite(Number(raw)) ? Number(raw) : magnitude;
  const unit = flowValue?.unit ? ` ${flowValue.unit}` : '';
  if (num != null && Number.isFinite(num)) {
    return name ? `${name}: ${num}${unit}` : `${num}${unit}`;
  }
  return name || 'Feed';
}

export function formatPathPoints(points: PathPoint[]): string {
  return points.map((p) => `${Math.round(p.x)},${Math.round(p.y)}`).join(';');
}

export function isFlowOverload(magnitude: number, alarmHigh: unknown): boolean {
  const high = typeof alarmHigh === 'number' ? alarmHigh : Number(alarmHigh);
  return Number.isFinite(high) && high > 0 && magnitude >= high;
}

export function tagValueOn(raw: unknown): boolean {
  return raw === true || raw === 1 || raw === '1' || raw === 'true' || raw === 'ON';
}

export function computeFlowState(opts: {
  flowRaw?: unknown;
  enableRaw?: unknown;
  threshold?: number;
  requireEnable?: boolean;
}): { flowing: boolean; reverse: boolean; magnitude: number } {
  const threshold = opts.threshold ?? 0.5;
  const num = Number(opts.flowRaw);
  const magnitude = Number.isFinite(num) ? Math.abs(num) : 0;
  const flowingByValue = magnitude >= threshold;
  const reverse = Number.isFinite(num) && num < -threshold;

  let enabled = true;
  if (opts.requireEnable && opts.enableRaw !== undefined && opts.enableRaw !== null && opts.enableRaw !== '') {
    enabled = tagValueOn(opts.enableRaw);
  }

  return { flowing: flowingByValue && enabled, reverse, magnitude };
}

export function elecSymbolState(raw: unknown, stateCount = 3): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return tagValueOn(raw) ? 1 : 0;
  return Math.max(0, Math.min(stateCount - 1, Math.round(n)));
}
