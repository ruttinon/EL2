import type { GraphicObjectType } from '@energylink/shared-types';

/** Map ribbon / command-bus item names to editor tool keys (objectCatalog). */
const COMMAND_TO_TOOL: Record<string, string> = {
  text: 'text',
  image: 'image',
  value: 'value',
  gauge: 'gauge',
  trend: 'trend',
  line: 'line',
  rectangle: 'rectangle',
  button: 'button',
  circle: 'circle',
  polygon: 'polygon',
  switch: 'switch',
  slider: 'slider',
  led: 'led',
  levelbar: 'levelbar',
  multistate: 'multistate',
  navbutton: 'navbutton',
  tagtable: 'tagtable',
  alarmtable: 'alarmtable',
  kpicard: 'kpicard',
  formulavalue: 'formulavalue',
  statusbadge: 'statusbadge',
  panel: 'panel',
  hotspot: 'hotspot',
  tabbar: 'tabbar',
  group: 'group',
  flowpath: 'flowpath',
  'flow path': 'flowpath',
  elecsymbol: 'elecsymbol',
  'elec symbol': 'elecsymbol',
  echart: 'echart',
  clock: 'clock',
  semaphore: 'semaphore',
  progressbar: 'progressbar',
  video: 'video',
};

export function resolveGraphicsToolCommand(item: string): string | null {
  const key = COMMAND_TO_TOOL[item];
  if (key) return key;
  const types: GraphicObjectType[] = [
    'text', 'image', 'value', 'gauge', 'trend', 'line', 'rectangle', 'button',
    'circle', 'polygon', 'switch', 'slider', 'led', 'levelbar', 'multistate', 'navbutton',
    'tagtable', 'alarmtable', 'kpicard', 'formulavalue',
    'statusbadge', 'panel', 'hotspot', 'flowpath', 'elecsymbol', 'echart', 'clock', 'video',
  ];
  if (types.includes(item as GraphicObjectType)) return item;
  return null;
}
