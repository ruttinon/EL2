const LS_KEY = 'energylink.graphics.canvasZoom.v1';
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;

function readMap(): Record<string, number> {
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, number>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return 1;
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Number(zoom.toFixed(2))));
}

export function loadCanvasZoom(graphicId: string): number {
  if (!graphicId) return 1;
  const zoom = readMap()[graphicId];
  return zoom != null ? clampZoom(zoom) : 1;
}

export function saveCanvasZoom(graphicId: string, zoom: number): void {
  if (!graphicId) return;
  const map = readMap();
  map[graphicId] = clampZoom(zoom);
  window.localStorage.setItem(LS_KEY, JSON.stringify(map));
}
