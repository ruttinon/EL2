/** Scene composition — render modes, layers, real-world scale (Phase 8) */
/** @deprecated Pre-unified 2D/3D/Dual toggle — use defaultCamera + unified layers */
export type GraphicSceneViewMode = '2d' | '3d' | 'dual';
export type GraphicRenderMode = 'scene' | 'wire' | 'panel' | 'overlay';
export type GraphicSceneLayer = 'background' | 'scene' | 'wiring' | 'equipment' | 'overlay';
export type GraphicCameraPreset = 'free' | 'isometric' | 'top' | 'juddesk';
export declare const DEFAULT_MM_PER_PX = 10;
export declare function defaultRenderModeForType(type: string): GraphicRenderMode;
export declare function defaultSceneLayerForType(type: string): GraphicSceneLayer;
export declare function resolveRenderMode(obj: {
    type: string;
    style?: Record<string, unknown>;
}): GraphicRenderMode;
export declare function resolveSceneLayer(obj: {
    type: string;
    style?: Record<string, unknown>;
}): GraphicSceneLayer;
export declare function isChromelessRenderMode(mode: GraphicRenderMode): boolean;
export declare function dimensionsFromRealWorld(realWidthMm: number, realHeightMm: number, mmPerPx?: number): {
    width: number;
    height: number;
};
export declare function applySceneDefaultsToStyle(type: string, style?: Record<string, string | number | boolean | undefined>): Record<string, string | number | boolean | undefined>;
export declare const SCENE_LAYER_GROUPS: Array<{
    id: GraphicSceneLayer;
    label: string;
}>;
