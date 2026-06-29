/** Unified frame — one viewport, world / diagram / hud layers (layout v2) */
export type GraphicUnifiedLayer = 'world' | 'diagram' | 'hud';
export type UnifiedCameraPreset = 'flat' | 'top' | 'orbit';
export type GraphicTransform3d = {
    position: [number, number, number];
    rotation: [number, number, number];
    scale: [number, number, number];
};
export declare function defaultUnifiedLayerForType(type: string): GraphicUnifiedLayer;
export declare function resolveUnifiedLayer(obj: {
    type: string;
    style?: Record<string, unknown>;
}): GraphicUnifiedLayer;
export declare function unifiedCameraToR3fPreset(camera: UnifiedCameraPreset): string;
export declare function shouldMountWorldLayer(camera: UnifiedCameraPreset, hasWorldObjects: boolean): boolean;
/** Map legacy layout.sceneViewMode to unified defaultCamera (v1 → v2). */
export declare function legacySceneViewModeToDefaultCamera(mode: unknown): UnifiedCameraPreset | null;
