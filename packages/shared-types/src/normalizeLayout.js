import { legacySceneViewModeToDefaultCamera, resolveUnifiedLayer } from './unifiedScene.js';
import { normalizeLayoutTransforms } from './layoutV3.js';
function resolveDefaultCamera(layout) {
    const cam = layout.defaultCamera;
    if (cam === 'top' || cam === 'orbit' || cam === 'flat')
        return cam;
    return legacySceneViewModeToDefaultCamera(layout.sceneViewMode) ?? 'flat';
}
/** Normalize layout to v2 — unified layers + defaultCamera; strips legacy sceneViewMode */
export function normalizeGraphicLayout(layout) {
    const base = (layout ?? { objects: [] });
    const objects = (base.objects ?? []).map((obj) => {
        const layer = resolveUnifiedLayer(obj);
        if (obj.style?.unifiedLayer === layer)
            return obj;
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
