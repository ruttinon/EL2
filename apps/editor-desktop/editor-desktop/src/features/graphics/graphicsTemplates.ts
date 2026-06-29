import type { GraphicLayout } from '@energylink/shared-types';

type TemplateDef = {
  id: string;
  label: string;
  description: string;
  width: number;
  height: number;
  layout: () => GraphicLayout;
};

function baseLayout(objects: GraphicLayout['objects']): GraphicLayout {
  return {
    version: 1,
    backgroundColor: '#f8fbfc',
    backgroundImage: null,
    objects: objects ?? [],
  };
}

function obj(
  type: string,
  name: string,
  x: number,
  y: number,
  width: number,
  height: number,
  extra: Record<string, unknown> = {},
) {
  return {
    id: `tpl_${type}_${name.replace(/\s+/g, '_').toLowerCase()}`,
    type,
    name,
    x,
    y,
    width,
    height,
    visible: true,
    locked: false,
    layer: Date.now() + x + y,
    style: {
      fill: '#ffffff',
      stroke: '#9fc4cc',
      color: '#142033',
      background: '#ffffff',
      fontSize: 14,
      ...(extra.style as object),
    },
    ...extra,
  };
}

export const GRAPHIC_TEMPLATES: TemplateDef[] = [
  {
    id: 'blank-scene',
    label: 'Blank Scene',
    description: 'Empty isometric scene — drag equipment from Scene Catalog',
    width: 1400,
    height: 900,
    layout: () => ({
      version: 1,
      backgroundColor: '#e8eef2',
      backgroundImage: null,
      sceneScaleMmPerPx: 10,
      objects: [],
    }),
  },
  {
    id: 'blank',
    label: 'Blank Canvas',
    description: 'Empty graphic — dashboard / widget layout',
    width: 1366,
    height: 768,
    layout: () => baseLayout([]),
  },
  {
    id: 'single-meter',
    label: 'Single Meter',
    description: 'One meter: gauge, value, sparkline and trend',
    width: 900,
    height: 520,
    layout: () =>
      baseLayout([
        obj('text', 'Meter Title', 24, 20, 400, 44, { text: 'Meter Overview', style: { fontSize: 22, background: 'transparent', stroke: 'transparent' } }),
        obj('panel', 'Main Panel', 24, 72, 852, 420, { text: 'Live Data' }),
        obj('gauge', 'Power Gauge', 48, 110, 200, 150, { text: 'kW' }),
        obj('value', 'Energy Value', 280, 110, 200, 90, { text: 'kWh' }),
        obj('sparkline', 'Power Spark', 520, 110, 320, 70),
        obj('trend', '24h Trend', 48, 280, 792, 180, { style: { period: '24h' } }),
      ]),
  },
  {
    id: 'floor-overview',
    label: 'Floor Overview',
    description: 'Zone gauges, bar chart and tag table',
    width: 1280,
    height: 720,
    layout: () =>
      baseLayout([
        obj('text', 'Floor Title', 24, 16, 500, 40, { text: 'Floor Overview', style: { fontSize: 20, background: 'transparent', stroke: 'transparent' } }),
        obj('gauge', 'Zone A', 24, 72, 180, 130, { text: 'Zone A' }),
        obj('gauge', 'Zone B', 220, 72, 180, 130, { text: 'Zone B' }),
        obj('gauge', 'Zone C', 416, 72, 180, 130, { text: 'Zone C' }),
        obj('gauge', 'Zone D', 612, 72, 180, 130, { text: 'Zone D' }),
        obj('barchart', 'Zone Compare', 24, 220, 560, 200, { text: 'kW by Zone' }),
        obj('tagtable', 'Device Tags', 608, 220, 648, 280, { text: 'All Meters', style: { maxRows: 12 } }),
        obj('alarmtable', 'Active Alarms', 24, 440, 1232, 250, { text: 'Alarms', style: { maxRows: 8 } }),
        obj('tabbar', 'Navigation', 24, 660, 600, 44, { style: { tabs: 'Home:HOME_ID,Detail:DETAIL_ID' } }),
      ]),
  },
  {
    id: 'mcc-room',
    label: 'MCC Room',
    description: 'Diagram background area, values, trend and alarms',
    width: 1400,
    height: 800,
    layout: () =>
      baseLayout([
        obj('text', 'MCC Title', 24, 16, 400, 40, { text: 'MCC Room', style: { fontSize: 20, background: 'transparent', stroke: 'transparent' } }),
        obj('image', 'Diagram BG', 24, 64, 700, 500, { text: 'Single-line diagram' }),
        obj('elecsymbol', 'Main CB', 88, 180, 72, 72, { text: 'CB-IN', style: { symbolId: 'breaker', states: 'open,closed,trip', background: 'transparent', stroke: 'transparent' } }),
        obj('flowpath', 'Feeder Line 1', 160, 210, 200, 40, { style: { pathPoints: '0,20;200,20', flowColor: '#22d3ee', idleColor: '#94a3b8', flowThreshold: 0.5, strokeWidth: 4, background: 'transparent', stroke: 'transparent' } }),
        obj('elecsymbol', 'Feeder CB', 360, 180, 72, 72, { text: 'CB-1', style: { symbolId: 'breaker' } }),
        obj('flowpath', 'Feeder Line 2', 432, 210, 180, 40, { style: { pathPoints: '0,20;180,20', flowColor: '#22d3ee', idleColor: '#94a3b8', strokeWidth: 4, background: 'transparent', stroke: 'transparent' } }),
        obj('elecsymbol', 'Meter M1', 520, 180, 72, 72, { text: 'M1', style: { symbolId: 'meter' } }),
        obj('value', 'Total kW', 760, 64, 200, 80),
        obj('trend', 'Power Trend', 760, 160, 600, 200, { style: { period: '24h' } }),
        obj('tagtable', 'MCC Tags', 760, 380, 600, 180, { style: { maxRows: 8 } }),
        obj('alarmtable', 'MCC Alarms', 760, 580, 600, 180, { style: { maxRows: 6 } }),
        obj('navbutton', 'Go Overview', 24, 720, 200, 50, { text: 'Floor Overview' }),
      ]),
  },
  {
    id: 'feeder-line',
    label: 'Feeder Line',
    description: 'Single feeder with breaker, flow path and meter',
    width: 1000,
    height: 400,
    layout: () =>
      baseLayout([
        obj('text', 'Title', 24, 16, 320, 36, { text: 'Feeder Line', style: { fontSize: 18, background: 'transparent', stroke: 'transparent' } }),
        obj('elecsymbol', 'Incomer CB', 40, 120, 72, 72, { text: 'CB-IN', style: { symbolId: 'breaker' } }),
        obj('flowpath', 'Main Bus', 112, 150, 320, 48, { style: { pathPoints: '0,24;320,24', flowColor: '#22d3ee', strokeWidth: 5, background: 'transparent', stroke: 'transparent' } }),
        obj('elecsymbol', 'Feeder CB', 440, 120, 72, 72, { text: 'CB-1', style: { symbolId: 'breaker' } }),
        obj('flowpath', 'To Load', 512, 150, 240, 48, { style: { pathPoints: '0,24;240,24', flowColor: '#22d3ee', strokeWidth: 4, background: 'transparent', stroke: 'transparent' } }),
        obj('elecsymbol', 'Motor', 760, 120, 72, 72, { text: 'M1', style: { symbolId: 'motor', states: 'stop,run,fault' } }),
        obj('value', 'Feeder kW', 440, 220, 180, 70),
        obj('sparkline', 'kW Trend', 640, 220, 300, 70),
      ]),
  },
  {
    id: 'transformer-room',
    label: 'Transformer Room',
    description: 'Transformer, CT/PT, bus and alarms',
    width: 1100,
    height: 520,
    layout: () =>
      baseLayout([
        obj('text', 'Title', 24, 16, 360, 36, { text: 'Transformer Room', style: { fontSize: 18, background: 'transparent', stroke: 'transparent' } }),
        obj('elecsymbol', 'HV CB', 60, 100, 72, 72, { text: 'HV-CB', style: { symbolId: 'breaker' } }),
        obj('flowpath', 'HV Line', 132, 128, 200, 40, { style: { pathPoints: '0,20;200,20', strokeWidth: 4, background: 'transparent', stroke: 'transparent' } }),
        obj('elecsymbol', 'XFMR', 340, 88, 88, 88, { text: 'T1', style: { symbolId: 'transformer' } }),
        obj('elecsymbol', 'CT', 460, 100, 56, 72, { style: { symbolId: 'ct' } }),
        obj('elecsymbol', 'PT', 460, 180, 56, 72, { style: { symbolId: 'pt' } }),
        obj('flowpath', 'LV Bus', 560, 128, 280, 40, { style: { pathPoints: '0,20;280,20', strokeWidth: 5, background: 'transparent', stroke: 'transparent' } }),
        obj('elecsymbol', 'LV Bus', 860, 108, 120, 48, { style: { symbolId: 'bus' } }),
        obj('trend', 'Load Trend', 60, 280, 480, 180, { style: { period: '24h' } }),
        obj('alarmtable', 'Room Alarms', 560, 280, 480, 180, { style: { maxRows: 6 } }),
      ]),
  },
];

export function getGraphicTemplate(id: string) {
  return GRAPHIC_TEMPLATES.find((t) => t.id === id) ?? GRAPHIC_TEMPLATES[0];
}
