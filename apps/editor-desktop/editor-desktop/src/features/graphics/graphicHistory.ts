import type { GraphicLayoutSnapshot, GraphicSummary } from '@energylink/shared-types';

/** Local-only layout history fallback (offline / no Engine). Engine uses `window.energylink.graphics.*History`. */

const LS_PREFIX = 'energylink.graphics.history.v1';
const MAX_SNAPSHOTS = 20;

function storageKey(graphicId: string) {
  return `${LS_PREFIX}.${graphicId}`;
}

function makeId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `snap_${Date.now()}`;
}

export function listGraphicSnapshots(graphicId: string): GraphicLayoutSnapshot[] {
  try {
    const raw = window.localStorage.getItem(storageKey(graphicId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as GraphicLayoutSnapshot[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function pushGraphicSnapshot(graphic: GraphicSummary, label?: string): GraphicLayoutSnapshot {
  const snapshot: GraphicLayoutSnapshot = {
    id: makeId(),
    savedAt: new Date().toISOString(),
    label: label ?? `Save ${new Date().toLocaleString()}`,
    objectCount: graphic.layout?.objects?.length ?? 0,
    layout: structuredClone(graphic.layout),
    width: graphic.width,
    height: graphic.height,
    refreshIntervalMs: graphic.refreshIntervalMs,
  };
  const items = [snapshot, ...listGraphicSnapshots(graphic.id)].slice(0, MAX_SNAPSHOTS);
  window.localStorage.setItem(storageKey(graphic.id), JSON.stringify(items));
  return snapshot;
}

export function restoreGraphicSnapshot(graphic: GraphicSummary, snapshot: GraphicLayoutSnapshot): GraphicSummary {
  return {
    ...graphic,
    width: snapshot.width,
    height: snapshot.height,
    refreshIntervalMs: snapshot.refreshIntervalMs,
    layout: structuredClone(snapshot.layout),
  };
}

export function deleteGraphicSnapshot(graphicId: string, snapshotId: string): GraphicLayoutSnapshot[] {
  const next = listGraphicSnapshots(graphicId).filter((s) => s.id !== snapshotId);
  window.localStorage.setItem(storageKey(graphicId), JSON.stringify(next));
  return next;
}
