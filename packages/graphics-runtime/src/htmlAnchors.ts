import type { GraphicObjectDefinition } from '@energylink/shared-types';

export type HtmlAnchorPosition = {
  id: string;
  x: number;
  y: number;
  label?: string;
};

export type HtmlAnchorMap = Map<string, HtmlAnchorPosition>;

export function htmlAnchorsFromMessage(
  anchors: Array<{ id?: string; x?: number; y?: number; label?: string }> | undefined,
  scale?: { sx: number; sy: number },
): HtmlAnchorMap {
  const map: HtmlAnchorMap = new Map();
  if (!anchors) return map;
  const sx = scale?.sx ?? 1;
  const sy = scale?.sy ?? 1;
  for (const a of anchors) {
    if (!a?.id || typeof a.x !== 'number' || typeof a.y !== 'number') continue;
    map.set(a.id, {
      id: a.id,
      x: a.x * sx,
      y: a.y * sy,
      label: a.label ?? a.id,
    });
  }
  return map;
}

/** Map iframe document coords → graphic page coords when sizes differ. */
export function htmlAnchorsFromIframeMessage(
  anchors: Array<{ id?: string; x?: number; y?: number; label?: string }> | undefined,
  iframeInnerWidth: number,
  iframeInnerHeight: number,
  pageWidth: number,
  pageHeight: number,
): HtmlAnchorMap {
  const iw = iframeInnerWidth > 0 ? iframeInnerWidth : pageWidth;
  const ih = iframeInnerHeight > 0 ? iframeInnerHeight : pageHeight;
  return htmlAnchorsFromMessage(anchors, {
    sx: pageWidth / iw,
    sy: pageHeight / ih,
  });
}

/** Apply live HTML anchor positions to overlay widgets (style.anchorId). */
export function resolveAnchoredObjects(
  objects: GraphicObjectDefinition[],
  anchors: HtmlAnchorMap,
): GraphicObjectDefinition[] {
  if (anchors.size === 0) return objects;
  return objects.map((obj) => {
    const anchorId = String(obj.style?.anchorId ?? '').trim();
    if (!anchorId) return obj;
    const anchor = anchors.get(anchorId);
    if (!anchor) return obj;
    const ox = Number(obj.style?.anchorOffsetX ?? 0);
    const oy = Number(obj.style?.anchorOffsetY ?? 0);
    const x = Math.round(anchor.x + ox - obj.width / 2);
    const y = Math.round(anchor.y + oy - obj.height / 2);
    if (obj.x === x && obj.y === y) return obj;
    return { ...obj, x, y };
  });
}

export function nearestHtmlAnchor(
  anchors: HtmlAnchorMap,
  x: number,
  y: number,
  maxDist = 48,
): HtmlAnchorPosition | null {
  let best: HtmlAnchorPosition | null = null;
  let bestD = maxDist * maxDist;
  for (const a of anchors.values()) {
    const dx = a.x - x;
    const dy = a.y - y;
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = a;
    }
  }
  return best;
}
