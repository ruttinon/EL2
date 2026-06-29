export type {
  WidgetDefinition,
  WidgetCategoryId,
  WidgetCategoryMeta,
  WidgetCapability,
  WidgetPaletteGroup,
  InspectorFieldDef,
  InspectorGroupRef,
  InspectorGroupId,
} from './types.js';

export {
  SHARED_INSPECTOR_GROUPS,
  resolveInspectorGroups,
} from './shared-groups.js';
export type { SharedInspectorGroup } from './shared-groups.js';

export {
  getWidgetDefinition,
  getWidgetByObjectType,
  listRegistryWidgets,
  listPaletteWidgets,
  listWidgetsByCategory,
  isRegistryWidget,
  registryToolKey,
  registryPaletteCategories,
  WIDGET_CATEGORIES,
} from './registry.js';

export { inferDeviceStatusTag, inferDeviceNumericTag, inferDeviceCommandTag, inferDeviceFlowTag, tagsForDevice } from './deviceBinding.js';

export {
  valueWidget,
  gaugeWidget,
  buttonWidget,
  statusWidget,
  elecSymbolWidget,
  PILOT_WIDGETS,
} from './widgets/pilot.js';

export {
  progressbarWidget,
  levelbarWidget,
  kpicardWidget,
  multistateWidget,
  semaphoreWidget,
  clockWidget,
  switchWidget,
  PHASE2_WIDGETS,
} from './widgets/phase2.js';

export {
  trendWidget,
  echartWidget,
  tagtableWidget,
  alarmtableWidget,
  formulavalueWidget,
  PHASE2B_WIDGETS,
} from './widgets/phase2b.js';

export {
  sliderWidget,
  inputfieldWidget,
  dropdownWidget,
  navbuttonWidget,
  tabbarWidget,
  PHASE3_WIDGETS,
} from './widgets/phase3.js';

export {
  textWidget,
  rectangleWidget,
  circleWidget,
  polygonWidget,
  lineWidget,
  imageWidget,
  flowpathWidget,
  bussectionWidget,
  feedlabelWidget,
  zone2dWidget,
  hotspotWidget,
  videoWidget,
  PHASE4_WIDGETS,
} from './widgets/phase4.js';

export {
  panelWidget,
  groupWidget,
  pipeWidget,
  cable3dWidget,
  wallWidget,
  zone3dWidget,
  viewport3dWidget,
  scene3dWidget,
  spriteWidget,
  lottieWidget,
  iframeWidget,
  PHASE5_WIDGETS,
} from './widgets/phase5.js';
