import type { WidgetDefinition } from '../types.js';

const FREE_IMAGE_STYLE = {
  imageFrameMode: 'free' as const,
  transparentBg: true,
  fill: 'transparent',
  background: 'transparent',
  strokeWidth: 0,
  stroke: 'transparent',
};

/** Phase 4 — layout, SLD/Elec, media (final legacy palette migration). */
export const textWidget: WidgetDefinition = {
  id: 'text',
  version: 1,
  objectType: 'text',
  category: 'layout',
  paletteGroup: 'display',
  display: {
    label: 'Text',
    icon: 'type',
    color: '#3b82f6',
    hint: 'On-screen text',
  },
  defaults: {
    width: 180,
    height: 44,
    text: 'Text',
    style: { background: 'transparent', fill: 'transparent', align: 'center', fontSize: 16, color: '#142033' },
  },
  capabilities: ['style:typography'],
  inspector: { groups: ['layout', 'typography'], dedicatedInspector: 'shape' },
};

export const rectangleWidget: WidgetDefinition = {
  id: 'rectangle',
  version: 1,
  objectType: 'rectangle',
  category: 'layout',
  paletteGroup: 'display',
  display: {
    label: 'Rectangle',
    icon: 'square',
    color: '#3b82f6',
    hint: 'Rectangle — adjustable color and border radius',
  },
  defaults: {
    width: 180,
    height: 110,
    style: { fill: '#e2e8f0', background: '#e2e8f0', borderRadius: 0, stroke: '#9fc4cc', strokeWidth: 1 },
  },
  capabilities: ['style:geometry', 'style:chrome'],
  inspector: { groups: ['layout', 'appearance'], dedicatedInspector: 'shape' },
};

export const circleWidget: WidgetDefinition = {
  id: 'circle',
  version: 1,
  objectType: 'circle',
  category: 'layout',
  paletteGroup: 'display',
  display: {
    label: 'Circle / Ellipse',
    icon: 'circle',
    color: '#0ea5e9',
    hint: 'Circle or Ellipse — unlock aspect ratio in Inspector',
  },
  defaults: {
    width: 120,
    height: 120,
    style: { fill: '#bae6fd', background: '#bae6fd', lockAspectRatio: true, stroke: '#9fc4cc', strokeWidth: 1 },
  },
  capabilities: ['style:geometry', 'style:chrome'],
  inspector: { groups: ['layout', 'appearance', 'transform'], dedicatedInspector: 'shape' },
  aliases: ['ellipse'],
};

export const polygonWidget: WidgetDefinition = {
  id: 'polygon',
  version: 1,
  objectType: 'polygon',
  category: 'layout',
  paletteGroup: 'display',
  display: {
    label: 'Polygon',
    icon: 'triangle',
    color: '#f97316',
    hint: 'Polygon — define zone area',
  },
  defaults: {
    width: 140,
    height: 120,
    text: '',
    style: { fill: '#fdba74', background: '#fdba74', polygonSides: 3, stroke: '#9fc4cc', strokeWidth: 1 },
  },
  capabilities: ['style:geometry', 'style:typography', 'style:chrome'],
  inspector: { groups: ['layout', 'typography', 'appearance'], dedicatedInspector: 'shape' },
};

export const lineWidget: WidgetDefinition = {
  id: 'line',
  version: 1,
  objectType: 'line',
  category: 'layout',
  paletteGroup: 'display',
  display: {
    label: 'Line',
    icon: 'minus',
    color: '#6b7280',
    hint: 'Straight line — adjustable thickness, dashes, and caps',
  },
  defaults: {
    width: 220,
    height: 12,
    style: {
      stroke: '#475569',
      strokeWidth: 2,
      lineDash: 'solid',
      lineCap: 'round',
      background: '#475569',
    },
  },
  capabilities: ['style:geometry'],
  inspector: { groups: ['layout', 'stroke'], dedicatedInspector: 'shape' },
};

export const imageWidget: WidgetDefinition = {
  id: 'image',
  version: 1,
  objectType: 'image',
  category: 'layout',
  paletteGroup: 'display',
  display: {
    label: 'Image',
    icon: 'image',
    color: '#10b981',
    hint: 'Static Image — upload PNG/SVG',
  },
  defaults: {
    width: 200,
    height: 130,
    style: { ...FREE_IMAGE_STYLE, objectFit: 'contain' },
  },
  capabilities: ['style:chrome'],
  inspector: { groups: ['layout'], dedicatedInspector: 'image' },
};

export const flowpathWidget: WidgetDefinition = {
  id: 'flowpath',
  version: 1,
  objectType: 'flowpath',
  category: 'symbols.electrical',
  paletteGroup: 'display',
  display: {
    label: 'Flow Path',
    icon: 'cable',
    color: '#22d3ee',
    hint: 'Electrical/Pipe line — draw path on canvas',
    keywords: ['wire', 'sld'],
  },
  paletteVisible: false,
  defaults: {
    width: 280,
    height: 48,
    text: 'Power Line',
    style: {
      pathPoints: '0,24;280,24',
      flowColor: '#22d3ee',
      idleColor: '#94a3b8',
      flowThreshold: 0.5,
      strokeWidth: 4,
      background: 'transparent',
      stroke: 'transparent',
    },
  },
  capabilities: ['bind:flow', 'style:geometry'],
  inspector: { groups: ['layout', 'animation'], dedicatedInspector: 'flowpath' },
  aliases: ['wire'],
};

export const bussectionWidget: WidgetDefinition = {
  id: 'bussection',
  version: 1,
  objectType: 'bussection',
  category: 'symbols.electrical',
  paletteGroup: 'display',
  display: {
    label: 'Bus Section',
    icon: 'zap',
    color: '#173047',
    hint: 'Bus bar — with tap ports for connections',
  },
  paletteVisible: false,
  defaults: {
    width: 320,
    height: 48,
    text: 'Bus-A',
    style: { fill: '#173047', background: '#173047', color: '#e2e8f0', fontSize: 14 },
  },
  capabilities: ['style:typography', 'style:chrome', 'ports'],
  inspector: { groups: ['layout', 'typography', 'appearance'], dedicatedInspector: 'shape' },
};

export const feedlabelWidget: WidgetDefinition = {
  id: 'feedlabel',
  version: 1,
  objectType: 'feedlabel',
  category: 'symbols.electrical',
  paletteGroup: 'display',
  display: {
    label: 'Feed Label',
    icon: 'tag',
    color: '#0ea5e9',
    hint: 'Name label for feeder or line',
  },
  paletteVisible: false,
  defaults: {
    width: 120,
    height: 44,
    text: 'Feeder-1',
    style: { fill: '#e0f2fe', background: '#e0f2fe', color: '#0c4a6e', fontSize: 14 },
  },
  capabilities: ['style:typography', 'bind:scalar'],
  inspector: { groups: ['layout', 'typography', 'data'], dedicatedInspector: 'shape' },
};

export const zone2dWidget: WidgetDefinition = {
  id: 'zone2d',
  version: 1,
  objectType: 'zone2d',
  category: 'symbols.electrical',
  paletteGroup: 'display',
  display: {
    label: 'Zone 2D',
    icon: 'map',
    color: '#6366f1',
    hint: 'Zone Area — click to navigate',
  },
  paletteVisible: false,
  defaults: {
    width: 160,
    height: 100,
    text: 'Zone',
    style: { fill: 'rgba(99,102,241,0.15)', background: 'rgba(99,102,241,0.15)', stroke: '#6366f1', strokeWidth: 1 },
  },
  capabilities: ['style:typography', 'style:chrome', 'interact:navigate'],
  inspector: { groups: ['layout', 'typography', 'appearance', 'navigation'], dedicatedInspector: 'hotspot' },
};

export const hotspotWidget: WidgetDefinition = {
  id: 'hotspot',
  version: 1,
  objectType: 'hotspot',
  category: 'symbols.electrical',
  paletteGroup: 'display',
  display: {
    label: 'Hotspot',
    icon: 'crosshair',
    color: '#06b6d4',
    hint: 'Transparent clickable area for navigation',
  },
  defaults: {
    width: 48,
    height: 48,
    style: { fill: 'rgba(6,182,212,0.25)', background: 'rgba(6,182,212,0.25)', stroke: '#06b6d4', strokeWidth: 1 },
  },
  capabilities: ['interact:navigate', 'style:geometry'],
  inspector: { groups: ['layout', 'appearance', 'navigation'], dedicatedInspector: 'hotspot' },
};

export const videoWidget: WidgetDefinition = {
  id: 'video',
  version: 1,
  objectType: 'video',
  category: 'media',
  paletteGroup: 'display',
  display: {
    label: 'Video',
    icon: 'play-circle',
    color: '#14b8a6',
    hint: 'MP4/WebM Video — upload in Inspector',
  },
  defaults: {
    width: 320,
    height: 200,
    style: {
      mediaFrameMode: 'boxed',
      fill: '#0f172a',
      background: '#0f172a',
      streamType: 'file',
      videoAutoplay: true,
      videoMuted: true,
      videoLoop: true,
    },
  },
  capabilities: ['style:chrome'],
  inspector: { groups: ['layout'], dedicatedInspector: 'video' },
};

export const PHASE4_WIDGETS: WidgetDefinition[] = [
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
];
