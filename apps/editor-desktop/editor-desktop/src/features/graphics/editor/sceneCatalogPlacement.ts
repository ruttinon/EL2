import type { GraphicObjectDefinition } from '@energylink/shared-types';
import { DEFAULT_MM_PER_PX, dimensionsFromRealWorld } from '@energylink/shared-types';
import { applySceneDefaultsToStyle } from '@energylink/graphics-runtime';
import type { SceneCatalogDropPayload } from '../GraphicsSceneCatalog';
import { makeObject } from './objectCatalog';
import { FREE_IMAGE_STYLE } from '../imageHelpers';

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export type PlaceSceneOptions = {
  graphicWidth: number;
  graphicHeight: number;
  mmPerPx?: number;
  zTop: number;
};

/** Place a scene-catalog payload on the canvas; returns object(s) to add. */
export function objectsFromSceneCatalogPayload(
  payload: SceneCatalogDropPayload,
  canvasX: number,
  canvasY: number,
  opts: PlaceSceneOptions,
): GraphicObjectDefinition[] {
  const mmPerPx = opts.mmPerPx ?? DEFAULT_MM_PER_PX;
  const x = Math.round(canvasX);
  const y = Math.round(canvasY);

  if (payload.kind === 'image') {
    const dims = payload.realWidthMm && payload.realHeightMm
      ? dimensionsFromRealWorld(payload.realWidthMm, payload.realHeightMm, mmPerPx)
      : { width: 200, height: 150 };
    const obj = makeObject('image', x, y, opts.zTop);
    obj.name = payload.name;
    obj.width = dims.width;
    obj.height = dims.height;
    obj.imageDataUrl = payload.dataUrl;
    obj.style = {
      ...obj.style,
      imageDataUrl: payload.dataUrl,
      ...FREE_IMAGE_STYLE,
      realWidthMm: payload.realWidthMm,
      realHeightMm: payload.realHeightMm,
    };
    return [clampObject(obj, opts.graphicWidth, opts.graphicHeight)];
  }

  if (payload.kind !== 'type') {
    return [];
  }

  const type = payload.type;
  const dims = payload.realWidthMm && payload.realHeightMm
    ? dimensionsFromRealWorld(payload.realWidthMm, payload.realHeightMm, mmPerPx)
    : null;
  const obj = makeObject(type, x, y, opts.zTop);
  obj.name = payload.name || obj.name;
  if (dims) {
    obj.width = dims.width;
    obj.height = dims.height;
  }
  if (payload.style) {
    obj.style = { ...obj.style, ...(payload.style as Record<string, string | number | boolean | undefined>) };
  }
  if (type === 'flowpath' || type === 'pipe') {
    const h = obj.height;
    const w = obj.width;
    const mid = Math.round(h / 2);
    obj.style = applySceneDefaultsToStyle(type, {
      ...obj.style,
      pathPoints: `0,${mid};${w},${mid}`,
      realWidthMm: payload.realWidthMm,
      realHeightMm: payload.realHeightMm,
    });
  }
  if (type === 'elecsymbol' && payload.symbolId) {
    obj.style = { ...obj.style, symbolId: payload.symbolId };
  }
  return [clampObject(obj, opts.graphicWidth, opts.graphicHeight)];
}

function clampObject(obj: GraphicObjectDefinition, gw: number, gh: number): GraphicObjectDefinition {
  return {
    ...obj,
    x: clamp(obj.x, 0, Math.max(0, gw - obj.width)),
    y: clamp(obj.y, 0, Math.max(0, gh - obj.height)),
  };
}
