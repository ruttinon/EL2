export type CreateDeviceInput = any;
export type UpdateDeviceInput = any;
export type DeviceDatabaseStatus = any;
export type DeviceSummary = any;
export type DeviceTreeNode = any;
export type DeviceType = any;

export type CreateProjectInput = any;
export type UpdateProjectInput = any;
export type ProjectDatabaseStatus = any;
export type ProjectSummary = any;

export type CreateTagInput = any;
export type UpdateTagInput = any;
export type TagDatabaseStatus = any;
export type TagSummary = any;
export type TagDataType = any;
export type TagRegisterType = any;

export type CreateGraphicInput = import('./graphics.js').CreateGraphicInput;
export type UpdateGraphicInput = import('./graphics.js').UpdateGraphicInput;
export type GraphicDatabaseStatus = import('./graphics.js').GraphicDatabaseStatus;
export type GraphicSummary = import('./graphics.js').GraphicSummary;
export type GraphicLayout = import('./graphics.js').GraphicLayout;
export type GraphicObjectDefinition = import('./graphics.js').GraphicObjectDefinition;
export type GraphicObjectType = import('./graphics.js').GraphicObjectType;
export type GraphicObjectAction = import('./graphics.js').GraphicObjectAction;
export type GraphicActionType = import('./graphics.js').GraphicActionType;
export type GraphicObjectActionOptions = import('./graphics.js').GraphicObjectActionOptions;
export type GraphicExportPackage = import('./graphics.js').GraphicExportPackage;
export type GraphicLayoutSnapshot = import('./graphics.js').GraphicLayoutSnapshot;
export { GRAPHIC_LAYOUT_VERSION, GRAPHIC_LAYOUT_VERSION_V2, GRAPHIC_LAYOUT_VERSION_V3, GRAPHIC_PACKAGE_VERSION, isHtmlGraphicPage, isCanvasGraphicPage, isGlbBuildingGraphic } from './graphics.js';
export type { GraphicObjectTransform } from './layoutV3.js';
export { migrateLayoutToV3, migrateObjectToV3, syncObjectTransformFields, normalizeLayoutTransforms } from './layoutV3.js';
export type { GraphicLayoutVersion, GraphicPageKind, GraphicExternalPage, GraphicExternalPageSource, GraphicPickedAnchor } from './graphics.js';
export type {
  GraphicUnifiedLayer,
  UnifiedCameraPreset,
  GraphicTransform3d,
} from './unifiedScene.js';
export {
  defaultUnifiedLayerForType,
  resolveUnifiedLayer,
  unifiedCameraToR3fPreset,
  shouldMountWorldLayer,
  legacySceneViewModeToDefaultCamera,
} from './unifiedScene.js';
export { normalizeGraphicLayout } from './normalizeLayout.js';
export type {
  GraphicRenderMode,
  GraphicSceneLayer,
  GraphicCameraPreset,
} from './scene.js';
export {
  DEFAULT_MM_PER_PX,
  defaultRenderModeForType,
  defaultSceneLayerForType,
  resolveRenderMode,
  resolveSceneLayer,
  isChromelessRenderMode,
  dimensionsFromRealWorld,
  applySceneDefaultsToStyle,
  SCENE_LAYER_GROUPS,
} from './scene.js';
export type { GraphicAsset, GraphicAssetKind, GraphicAssetBundle } from './assets.js';
export { GRAPHIC_ASSET_BUNDLE_VERSION } from './assets.js';
export type { GraphicSymbol } from './symbols.js';
export { GRAPHIC_SYMBOLS_STORAGE_KEY } from './symbols.js';
export type { GraphicPort, PortKind, WireEndpoint } from './ports.js';
export { parsePorts, formatPorts, DEFAULT_ELEC_PORTS, DEFAULT_EQUIPMENT_PORTS, DEFAULT_BUS_PORTS } from './ports.js';

export type {
  WidgetStyleSchema,
  WidgetBindingSchema,
  WidgetActionSchema,
  WidgetAnimationSchema,
  WidgetInteraction,
  WidgetInteractionAction,
  WidgetAnimation,
  WidgetCondition,
  ThresholdBand,
  ValueMapping,
  StateSlot,
} from './widget-schema/index.js';


export type CreateReportInput = any;
export type UpdateReportInput = any;
export type ReportDatabaseStatus = any;
export type ReportSummary = any;
export type ReportObjectDefinition = any;
export type ReportObjectType = any;
export type ReportTemplate = any;
export type ReportPageDefinition = any; // Added this since it's used in reportStore.ts

export * from './deviceEnergyMapping.js';
export * from './projectCarbon.js';
export * from './tagEnergyMapping.js';
export * from './carbonCalculation.js';
export * from './carbonValidation.js';
export * from './carbonBreakdown.js';
export * from './energyBilling.js';
export * from './reportFormula.js';
export * from './reportMeterTable.js';
export type ReportSchedule = any;
export type ReportScheduleRun = any;

// Generic exports to catch anything else
export type AnyRecord = any;
export const __BRAND__ = undefined as any;
