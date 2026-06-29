export const GRAPHIC_LAYOUT_VERSION_V3 = 3;
/** Flatten transform → x/y/width/height (runtime + editor canvas). */
export function syncObjectTransformFields(obj) {
    const t = obj.transform;
    if (!t)
        return obj;
    const rotate = t.rotate ?? (typeof obj.style?.rotate === 'number' ? obj.style.rotate : Number(obj.style?.rotate) || 0);
    return {
        ...obj,
        x: t.x,
        y: t.y,
        width: t.width,
        height: t.height,
        style: {
            ...obj.style,
            rotate,
            scaleX: t.scaleX ?? obj.style?.scaleX,
            scaleY: t.scaleY ?? obj.style?.scaleY,
        },
    };
}
/** Add transform block from flat geometry (non-destructive upgrade). */
export function migrateObjectToV3(obj) {
    const synced = syncObjectTransformFields(obj);
    return {
        ...synced,
        transform: {
            x: synced.x,
            y: synced.y,
            width: synced.width,
            height: synced.height,
            rotate: typeof synced.style?.rotate === 'number'
                ? synced.style.rotate
                : Number(synced.style?.rotate) || 0,
            scaleX: typeof synced.style?.scaleX === 'number' ? synced.style.scaleX : undefined,
            scaleY: typeof synced.style?.scaleY === 'number' ? synced.style.scaleY : undefined,
        },
    };
}
/** Upgrade layout to v3 — keeps objects readable by v1/v2 runtimes via flat fields. */
export function migrateLayoutToV3(layout) {
    const base = layout ?? { objects: [] };
    return {
        ...base,
        version: GRAPHIC_LAYOUT_VERSION_V3,
        objects: (base.objects ?? []).map((o) => migrateObjectToV3(syncObjectTransformFields(o))),
    };
}
/** Normalize any layout version — always sync flat fields from transform. */
export function normalizeLayoutTransforms(layout) {
    return {
        ...layout,
        objects: (layout.objects ?? []).map(syncObjectTransformFields),
    };
}
