import type React from 'react';

export type LayoutPoint = { x: number; y: number };

export function parsePolygonPointString(raw: unknown): LayoutPoint[] {
  if (typeof raw !== 'string' || !raw.trim()) return [];
  return raw
    .split(';')
    .map((seg) => {
      const [x, y] = seg.split(',').map((n) => Number(n.trim()));
      return { x, y };
    })
    .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
}

export function formatPolygonPointString(points: LayoutPoint[]): string {
  return points.map((p) => `${Math.round(p.x)},${Math.round(p.y)}`).join(';');
}

export function defaultPolygonPoints(
  x: number,
  y: number,
  w: number,
  h: number,
  sides = 3,
): string {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const rx = Math.max(4, w / 2);
  const ry = Math.max(4, h / 2);
  const pts: LayoutPoint[] = [];
  for (let i = 0; i < sides; i++) {
    const angle = -Math.PI / 2 + (2 * Math.PI * i) / sides;
    pts.push({ x: cx + rx * Math.cos(angle), y: cy + ry * Math.sin(angle) });
  }
  return formatPolygonPointString(pts);
}

export function polygonClipPath(
  points: LayoutPoint[],
  bbox: { x: number; y: number; w: number; h: number },
): string | undefined {
  if (points.length < 3 || bbox.w <= 0 || bbox.h <= 0) return undefined;
  const pct = points.map((p) => {
    const px = ((p.x - bbox.x) / bbox.w) * 100;
    const py = ((p.y - bbox.y) / bbox.h) * 100;
    return `${px}% ${py}%`;
  });
  return `polygon(${pct.join(', ')})`;
}

/** SVG `points` attribute in object-local coordinates (0..w, 0..h). */
export function polygonSvgPoints(
  points: LayoutPoint[],
  bbox: { x: number; y: number; w: number; h: number },
): string {
  const { x, y, w, h } = bbox;
  if (points.length >= 3 && w > 0 && h > 0) {
    return points.map((p) => `${p.x - x},${p.y - y}`).join(' ');
  }
  return `0,${h} ${w},${h} ${w / 2},0`;
}

export function scalePolygonPoints(
  points: LayoutPoint[],
  from: { x: number; y: number; w: number; h: number },
  to: { x: number; y: number; w: number; h: number },
): LayoutPoint[] {
  if (from.w <= 0 || from.h <= 0) return points;
  return points.map((p) => ({
    x: to.x + ((p.x - from.x) / from.w) * to.w,
    y: to.y + ((p.y - from.y) / from.h) * to.h,
  }));
}

export function translatePolygonPoints(
  points: LayoutPoint[],
  dx: number,
  dy: number,
): LayoutPoint[] {
  return points.map((p) => ({
    x: p.x + dx,
    y: p.y + dy,
  }));
}

export type LineDashStyle = 'solid' | 'dashed' | 'dotted';
export type LineCapStyle = 'round' | 'butt' | 'square';

export function resolveLineDash(style?: Record<string, string | number | boolean | undefined>): string | undefined {
  const mode = String(style?.lineDash ?? 'solid') as LineDashStyle;
  if (mode === 'dashed') return '14 8';
  if (mode === 'dotted') return '3 8';
  return undefined;
}

export function resolveLineCap(style?: Record<string, string | number | boolean | undefined>): LineCapStyle {
  const cap = String(style?.lineCap ?? 'round');
  if (cap === 'butt' || cap === 'square') return cap;
  return 'round';
}

/** Avoid mixing `border` shorthand with `borderColor` from base object styles. */
export function applyBoxBorder(
  base: React.CSSProperties,
  strokeWidth: number,
  stroke: string,
  options?: { dashed?: boolean },
): React.CSSProperties {
  const { border, borderColor, borderWidth, borderStyle, ...rest } = base;
  if (strokeWidth <= 0) {
    return { ...rest, borderWidth: 0, borderStyle: 'none' };
  }
  return {
    ...rest,
    borderStyle: options?.dashed ? 'dashed' : 'solid',
    borderWidth: strokeWidth,
    borderColor: stroke,
  };
}
