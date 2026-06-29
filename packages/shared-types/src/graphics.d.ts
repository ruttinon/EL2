/** Graphics layout types — shared across Editor, Engine, Monitor, Web Viewer */
import type { WidgetInteraction } from './widget-schema/action.js';
import type { WidgetAnimation } from './widget-schema/animation.js';
export declare const GRAPHIC_LAYOUT_VERSION: 1;
export declare const GRAPHIC_LAYOUT_VERSION_V2: 2;
export declare const GRAPHIC_LAYOUT_VERSION_V3: 3;
export declare const GRAPHIC_PACKAGE_VERSION: 1;
export type GraphicLayoutVersion = typeof GRAPHIC_LAYOUT_VERSION | typeof GRAPHIC_LAYOUT_VERSION_V2 | typeof GRAPHIC_LAYOUT_VERSION_V3;
export type { GraphicObjectTransform } from './layoutV3.js';
export type GraphicObjectType = 'text' | 'image' | 'value' | 'gauge' | 'trend' | 'alarm' | 'line' | 'rectangle' | 'button' | 'circle' | 'polygon' | 'switch' | 'slider' | 'led' | 'status' | 'levelbar' | 'multistate' | 'navbutton' | 'tagtable' | 'alarmtable' | 'sparkline' | 'barchart' | 'panel' | 'hotspot' | 'tabbar' | 'flowpath' | 'elecsymbol' | 'sprite' | 'lottie' | 'viewport3d' | 'scene3d' | 'group' | 'kpicard' | 'piechart' | 'formulavalue' | 'statusbadge' | 'zone3d' | 'cable3d' | 'bussection' | 'feedlabel' | 'zone2d' | 'wall' | 'echart' | 'ellipse' | 'inputfield' | 'dropdown' | 'iframe' | 'video' | 'progressbar' | 'semaphore' | 'pipe' | 'clock';
export type GraphicObjectBinding = {
    tagId?: string | null;
    tagName?: string;
    tagIds?: string[];
    deviceId?: string;
    flowTagId?: string | null;
    enableTagId?: string | null;
    unit?: string | null;
    decimalPlaces?: number | null;
    /** 3D Data Binding */
    rotate3dTagId?: string | null;
    rotate3dAxis?: 'x' | 'y' | 'z';
    rotate3dMultiplier?: number;
    scale3dTagId?: string | null;
    scale3dMultiplier?: number;
    /** Spline Variable to Tag ID Mappings */
    splineMappings?: Record<string, string>;
};
export type GraphicObjectStyle = Record<string, string | number | boolean | undefined>;
/** Value-driven animation/behavior (SCADA style). Triggers when a tag value enters [min, max]. */
export type GraphicActionType = 'show' | 'hide' | 'blink' | 'rotate' | 'move' | 'color' | 'floodFill' | 'swapImage';
export type GraphicObjectActionOptions = {
    /** blink: สีตอนกระพริบ + ช่วงเวลา (ms) */
    fillA?: string;
    fillB?: string;
    interval?: number;
    /** rotate: map ค่า [min,max] → องศา [minAngle,maxAngle] */
    minAngle?: number;
    maxAngle?: number;
    /** move: เลื่อนไป (px) เมื่อค่าเข้าช่วง */
    toX?: number;
    toY?: number;
    duration?: number;
    /** color: สีพื้น/เส้นขอบเมื่อค่าเข้าช่วง */
    color?: string;
    stroke?: string;
    /** floodFill: สีพื้นที่จะเทเมื่อค่าเข้าช่วง (PowerStudio flood fill) */
    fillColor?: string;
    /** swapImage: รูปที่จะสลับมาแสดงเมื่อค่าเข้าช่วง (PowerStudio dynamic image) */
    imageUrl?: string;
};
export type GraphicObjectAction = {
    tagId: string;
    min: number;
    max: number;
    type: GraphicActionType;
    options?: GraphicObjectActionOptions;
};
export type GraphicObjectDefinition = {
    id: string;
    type: GraphicObjectType | string;
    name?: string;
    text?: string;
    x: number;
    y: number;
    width: number;
    height: number;
    /** Layout v3 nested geometry (flat x/y/width/height stay in sync) */
    transform?: import('./layoutV3.js').GraphicObjectTransform;
    visible?: boolean;
    locked?: boolean;
    layer?: number;
    tagId?: string;
    tagIds?: string[];
    deviceId?: string;
    navigateTo?: string;
    flowTagId?: string;
    enableTagId?: string;
    imageDataUrl?: string;
    displayMode?: string;
    binding?: GraphicObjectBinding;
    style?: GraphicObjectStyle;
    /** Value-driven animations (blink/rotate/move/color/show/hide) — legacy */
    actions?: GraphicObjectAction[];
    /** Phase 1 declarative interactions (click → write/navigate/confirm) */
    interactions?: WidgetInteraction[];
    /** Phase 1 declarative animations (condition → effect) */
    animations?: WidgetAnimation[];
};
/** Page renderer: canvas = SCADA editor; html = full-page imported HTML HMI */
export type GraphicPageKind = 'canvas' | 'html';
export type GraphicExternalPageSource = 'inline' | 'bundle' | 'url';
export type GraphicPickedAnchor = {
    id: string;
    x: number;
    y: number;
    label?: string;
    worldX?: number;
    worldY?: number;
    worldZ?: number;
};
export type GraphicExternalPage = {
    source: GraphicExternalPageSource;
    /** Inline HTML body (stored in layoutJson snapshot for Monitor) */
    htmlContent?: string;
    /** asset://id reference (editor local asset library) */
    htmlRef?: string;
    /** External http(s) URL — iframe src (runtime) */
    url?: string;
    /** Optional alias map: SDK key → tagId */
    tagMap?: Record<string, string>;
    sandbox?: 'strict' | 'trusted';
    /** Anchors created in editor 3D pick mode (persisted in graphic JSON) */
    pickedAnchors?: GraphicPickedAnchor[];
};
export type GraphicLayout = {
    version?: GraphicLayoutVersion;
    /** Default canvas SCADA page; html = imported full-page HMI */
    pageKind?: GraphicPageKind;
    externalPage?: GraphicExternalPage;
    backgroundColor?: string;
    backgroundImage?: string | null;
    /** mm per canvas pixel for real-world equipment scale (default 10) */
    sceneScaleMmPerPx?: number;
    /** Default camera in unified frame (layout v2) */
    defaultCamera?: import('./unifiedScene.js').UnifiedCameraPreset;
    objects: GraphicObjectDefinition[];
    parseError?: string;
};
export declare function isHtmlGraphicPage(layout: GraphicLayout | null | undefined): boolean;
export declare function isCanvasGraphicPage(layout: GraphicLayout | null | undefined): boolean;
/** Canvas page dominated by a full-size scene3d GLB (building digital twin). */
export declare function isGlbBuildingGraphic(layout: GraphicLayout | null | undefined, pageWidth?: number, pageHeight?: number): boolean;
export type GraphicSummary = {
    id: string;
    projectId: string;
    name: string;
    description?: string | null;
    width: number;
    height: number;
    refreshIntervalMs: number;
    isDefault: boolean;
    layout: GraphicLayout;
    createdAt?: string;
    updatedAt?: string;
};
export type CreateGraphicInput = {
    projectId?: string;
    name: string;
    description?: string | null;
    width?: number;
    height?: number;
    refreshIntervalMs?: number;
    isDefault?: boolean;
    layout?: GraphicLayout;
};
export type UpdateGraphicInput = {
    id: string;
    name?: string;
    description?: string | null;
    width?: number;
    height?: number;
    refreshIntervalMs?: number;
    isDefault?: boolean;
    layout?: GraphicLayout;
};
export type GraphicDatabaseStatus = {
    activeProjectId: string;
    graphicCount: number;
    objectCount: number;
    defaultGraphicId: string | null;
};
/** Portable `.graphic.json` package for import/export between projects */
export type GraphicExportPackage = {
    packageVersion: typeof GRAPHIC_PACKAGE_VERSION;
    exportedAt: string;
    source?: {
        projectId?: string;
        graphicId?: string;
        graphicName?: string;
    };
    /** Embedded assets referenced by layout (Phase 9) */
    assets?: import('./assets.js').GraphicAssetBundle;
    graphic: {
        name: string;
        description?: string | null;
        width: number;
        height: number;
        refreshIntervalMs: number;
        layout: GraphicLayout;
    };
};
export type GraphicLayoutSnapshot = {
    id: string;
    savedAt: string;
    label: string;
    objectCount: number;
    layout: GraphicLayout;
    width: number;
    height: number;
    refreshIntervalMs: number;
};
