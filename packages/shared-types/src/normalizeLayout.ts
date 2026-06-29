import type { GraphicLayout } from './graphics.js';
import { legacySceneViewModeToDefaultCamera, resolveUnifiedLayer, type UnifiedCameraPreset } from './unifiedScene.js';
import { normalizeLayoutTransforms } from './layoutV3.js';

/** Legacy v1 JSON may still carry sceneViewMode — read only at import time */
type LayoutImport = GraphicLayout & { sceneViewMode?: unknown };

function resolveDefaultCamera(layout: LayoutImport): UnifiedCameraPreset {
  const cam = layout.defaultCamera;
  if (cam === 'top' || cam === 'orbit' || cam === 'flat') return cam;
  return legacySceneViewModeToDefaultCamera(layout.sceneViewMode) ?? 'flat';
}

/** Normalize layout to v2 — unified layers + defaultCamera; strips legacy sceneViewMode */
export function normalizeGraphicLayout(layout: GraphicLayout | null | undefined): GraphicLayout {
  const base = (layout ?? { objects: [] }) as LayoutImport;
  const objects = (base.objects ?? []).map((obj) => {
    const layer = resolveUnifiedLayer(obj);
    if (obj.style?.unifiedLayer === layer) return obj;
    return {
      ...obj,
      style: { ...obj.style, unifiedLayer: layer },
    };
  });

  const { sceneViewMode: _legacy, ...rest } = base;

  return normalizeLayoutTransforms({
    ...rest,
    version: base.version === 3 ? 3 : 2,
    defaultCamera: resolveDefaultCamera(base),
    objects,
  });
}
