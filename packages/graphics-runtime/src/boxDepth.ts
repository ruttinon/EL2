/** Clamp cabinet thickness (px) — never use raw mm values here */
export function clampBoxDepth(depth: number, width: number, height: number): number {
  const cap = Math.min(120, Math.round(Math.min(width, height) * 0.35));
  const floor = 12;
  if (!Number.isFinite(depth) || depth <= 0) {
    return Math.max(floor, Math.round(Math.min(width, height) * 0.22));
  }
  return Math.max(floor, Math.min(cap, Math.round(depth)));
}

export function defaultBoxDepth(width: number, height: number, style?: Record<string, unknown>): number {
  const fromStyle = Number(style?.boxDepth);
  return clampBoxDepth(fromStyle, width, height);
}
