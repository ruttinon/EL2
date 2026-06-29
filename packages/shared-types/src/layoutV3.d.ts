import type { GraphicLayout, GraphicObjectDefinition } from './graphics.js';
export declare const GRAPHIC_LAYOUT_VERSION_V3: 3;
/** Nested transform (layout v3). Flat x/y/width/height remain synced for runtime. */
export type GraphicObjectTransform = {
    x: number;
    y: number;
    width: number;
    height: number;
    rotate?: number;
    scaleX?: number;
    scaleY?: number;
};
/** Flatten transform → x/y/width/height (runtime + editor canvas). */
export declare function syncObjectTransformFields(obj: GraphicObjectDefinition): GraphicObjectDefinition;
/** Add transform block from flat geometry (non-destructive upgrade). */
export declare function migrateObjectToV3(obj: GraphicObjectDefinition): GraphicObjectDefinition;
/** Upgrade layout to v3 — keeps objects readable by v1/v2 runtimes via flat fields. */
export declare function migrateLayoutToV3(layout: GraphicLayout): GraphicLayout;
/** Normalize any layout version — always sync flat fields from transform. */
export declare function normalizeLayoutTransforms(layout: GraphicLayout): GraphicLayout;
