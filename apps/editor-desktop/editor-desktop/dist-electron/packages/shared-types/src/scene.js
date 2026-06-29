/** Scene composition — render modes, layers, real-world scale (Phase 8) */
export const DEFAULT_MM_PER_PX = 10;
const SCENE_TYPES = new Set(['image', 'viewport3d', 'scene3d', 'sprite', 'lottie', 'elecsymbol', 'hotspot', 'zone3d', 'zone2d', 'bussection']);
const WIRE_TYPES = new Set(['flowpath', 'cable3d', 'pipe']);
const OVERLAY_TYPES = new Set(['value', 'sparkline', 'alarm', 'statusbadge', 'status', 'led', 'multistate', 'text', 'formulavalue', 'feedlabel', 'clock']);
export function defaultRenderModeForType(type) {
    if (WIRE_TYPES.has(type))
        return 'wire';
    if (SCENE_TYPES.has(type))
        return 'scene';
    if (OVERLAY_TYPES.has(type))
        return 'overlay';
    return 'panel';
}
export function defaultSceneLayerForType(type) {
    if (['image', 'panel', 'rectangle', 'line', 'circle', 'polygon'].includes(type))
        return 'background';
    if (type === 'viewport3d' || type === 'scene3d')
        return 'scene';
    if (WIRE_TYPES.has(type))
        return 'wiring';
    if (['elecsymbol', 'hotspot', 'sprite', 'lottie', 'zone3d', 'zone2d', 'bussection'].includes(type))
        return 'equipment';
    return 'overlay';
}
export function resolveRenderMode(obj) {
    const raw = obj.style?.renderMode;
    if (raw === 'scene' || raw === 'wire' || raw === 'panel' || raw === 'overlay')
        return raw;
    return defaultRenderModeForType(obj.type);
}
export function resolveSceneLayer(obj) {
    const raw = obj.style?.sceneLayer;
    const layers = ['background', 'scene', 'wiring', 'equipment', 'overlay'];
    if (typeof raw === 'string' && layers.includes(raw))
        return raw;
    return defaultSceneLayerForType(obj.type);
}
export function isChromelessRenderMode(mode) {
    return mode === 'scene' || mode === 'wire' || mode === 'overlay';
}
export function dimensionsFromRealWorld(realWidthMm, realHeightMm, mmPerPx = DEFAULT_MM_PER_PX) {
    const scale = mmPerPx > 0 ? mmPerPx : DEFAULT_MM_PER_PX;
    return {
        width: Math.max(12, Math.round(realWidthMm / scale)),
        height: Math.max(12, Math.round(realHeightMm / scale)),
    };
}
export function applySceneDefaultsToStyle(type, style = {}) {
    const renderMode = (style.renderMode ?? defaultRenderModeForType(type));
    const sceneLayer = (style.sceneLayer ?? defaultSceneLayerForType(type));
    const next = { ...style, renderMode, sceneLayer };
    if (isChromelessRenderMode(renderMode)) {
        if (next.background === undefined || next.background === '#ffffff')
            next.background = 'transparent';
        if (next.stroke === undefined || next.stroke === '#9fc4cc') {
            next.stroke = renderMode === 'wire' ? 'transparent' : (next.stroke ?? 'transparent');
        }
    }
    return next;
}
export const SCENE_LAYER_GROUPS = [
    { id: 'background', label: 'Background' },
    { id: 'scene', label: 'Scene 3D' },
    { id: 'wiring', label: 'Wiring' },
    { id: 'equipment', label: 'Equipment' },
    { id: 'overlay', label: 'Data Overlay' },
];
