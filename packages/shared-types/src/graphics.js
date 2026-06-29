/** Graphics layout types — shared across Editor, Engine, Monitor, Web Viewer */
export const GRAPHIC_LAYOUT_VERSION = 1;
export const GRAPHIC_LAYOUT_VERSION_V2 = 2;
export const GRAPHIC_LAYOUT_VERSION_V3 = 3;
export const GRAPHIC_PACKAGE_VERSION = 1;
export function isHtmlGraphicPage(layout) {
    return layout?.pageKind === 'html';
}
export function isCanvasGraphicPage(layout) {
    return !layout?.pageKind || layout.pageKind === 'canvas';
}
/** Canvas page dominated by a full-size scene3d GLB (building digital twin). */
export function isGlbBuildingGraphic(layout, pageWidth = 1366, pageHeight = 768) {
    if (!layout || isHtmlGraphicPage(layout))
        return false;
    const scene = (layout.objects ?? []).find((o) => o.type === 'scene3d' && o.visible !== false && String(o.style?.glbUrl ?? '').trim());
    if (!scene)
        return false;
    return (scene.x <= 8 &&
        scene.y <= 8 &&
        scene.width >= pageWidth * 0.85 &&
        scene.height >= pageHeight * 0.85);
}
