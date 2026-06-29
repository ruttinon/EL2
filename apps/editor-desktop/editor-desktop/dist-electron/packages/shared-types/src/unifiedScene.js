/** Unified frame — one viewport, world / diagram / hud layers (layout v2) */
const WORLD_TYPES = new Set([
    'wall',
    'viewport3d',
    'scene3d',
    'zone3d',
    'cable3d',
]);
const HUD_TYPES = new Set([
    'value',
    'gauge',
    'trend',
    'alarm',
    'sparkline',
    'barchart',
    'piechart',
    'kpicard',
    'formulavalue',
    'statusbadge',
    'tagtable',
    'alarmtable',
    'button',
    'switch',
    'slider',
    'levelbar',
    'navbutton',
    'tabbar',
    'led',
    'multistate',
    'clock',
    'progressbar',
    'semaphore',
    'inputfield',
    'dropdown',
    'echart',
]);
export function defaultUnifiedLayerForType(type) {
    if (WORLD_TYPES.has(type))
        return 'world';
    if (HUD_TYPES.has(type))
        return 'hud';
    return 'diagram';
}
export function resolveUnifiedLayer(obj) {
    const raw = obj.style?.unifiedLayer;
    if (raw === 'world' || raw === 'diagram' || raw === 'hud')
        return raw;
    return defaultUnifiedLayerForType(obj.type);
}
export function unifiedCameraToR3fPreset(camera) {
    if (camera === 'top')
        return 'top';
    if (camera === 'orbit')
        return 'juddesk';
    return 'top';
}
export function shouldMountWorldLayer(camera, hasWorldObjects) {
    if (!hasWorldObjects)
        return false;
    return camera === 'top' || camera === 'orbit';
}
/** Map legacy layout.sceneViewMode to unified defaultCamera (v1 → v2). */
export function legacySceneViewModeToDefaultCamera(mode) {
    if (mode === '3d')
        return 'orbit';
    if (mode === '2d' || mode === 'dual')
        return 'flat';
    return null;
}
