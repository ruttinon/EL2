import type { WidgetDefinition } from '../types.js';

/** Phase 5 — scene / 3D / effects / remaining layout containers. */
export const panelWidget: WidgetDefinition = {
  id: 'panel',
  version: 1,
  objectType: 'panel',
  category: 'layout',
  paletteGroup: 'display',
  display: {
    label: 'Panel',
    icon: 'layout-dashboard',
    color: '#64748b',
    hint: 'Container panel with background and border',
  },
  defaults: {
    width: 280,
    height: 200,
    text: 'Panel',
    style: { fill: '#f8fafc', background: '#f8fafc', borderRadius: 8, stroke: '#cbd5e1', strokeWidth: 1 },
  },
  capabilities: ['style:typography', 'style:chrome', 'groupable'],
  inspector: { groups: ['layout', 'typography', 'appearance'], dedicatedInspector: 'shape' },
};

export const groupWidget: WidgetDefinition = {
  id: 'group',
  version: 1,
  objectType: 'group',
  category: 'layout',
  paletteGroup: 'display',
  display: {
    label: 'Group',
    icon: 'layers',
    color: '#64748b',
    hint: 'Group multiple objects — Use Ctrl+G or drag members',
  },
  defaults: {
    width: 200,
    height: 160,
    text: 'Group',
    style: { fill: 'transparent', background: 'transparent', strokeWidth: 0, memberIds: '' },
  },
  capabilities: ['groupable', 'interact:navigate'],
  inspector: { groups: ['layout', 'navigation'], dedicatedInspector: 'group' },
};

export const pipeWidget: WidgetDefinition = {
  id: 'pipe',
  version: 1,
  objectType: 'pipe',
  category: 'symbols.electrical',
  paletteGroup: 'display',
  paletteVisible: false,
  display: {
    label: 'Pipe',
    icon: 'droplet',
    color: '#06b6d4',
    hint: 'Pipe line — draw path on canvas',
  },
  defaults: {
    width: 240,
    height: 40,
    text: 'Pipe',
    style: {
      pathPoints: '0,20;240,20',
      flowColor: '#06b6d4',
      idleColor: '#94a3b8',
      strokeWidth: 6,
      background: 'transparent',
      stroke: 'transparent',
    },
  },
  capabilities: ['bind:flow', 'style:geometry'],
  inspector: { groups: ['layout', 'animation'], dedicatedInspector: 'flowpath' },
};

export const cable3dWidget: WidgetDefinition = {
  id: 'cable3d',
  version: 1,
  objectType: 'cable3d',
  category: 'symbols.electrical',
  paletteGroup: 'display',
  paletteVisible: false,
  display: {
    label: 'Cable 3D',
    icon: 'cable',
    color: '#a78bfa',
    hint: '3D Cable — bound to a 2D flowpath',
  },
  defaults: {
    width: 280,
    height: 48,
    text: 'Cable 3D',
    style: { pathPoints: '0,24;280,24', flowColor: '#a78bfa', strokeWidth: 4, background: 'transparent' },
  },
  capabilities: ['bind:flow', 'style:geometry'],
  inspector: { groups: ['layout'], dedicatedInspector: 'cable3d' },
};

export const wallWidget: WidgetDefinition = {
  id: 'wall',
  version: 1,
  objectType: 'wall',
  category: 'symbols.electrical',
  paletteGroup: 'display',
  paletteVisible: false,
  display: {
    label: 'Wall',
    icon: 'square',
    color: '#94a3b8',
    hint: '2D/3D Wall — Use Wall tool to draw on canvas',
  },
  defaults: {
    width: 200,
    height: 20,
    style: {
      fill: '#cbd5e1',
      background: '#cbd5e1',
      stroke: '#64748b',
      strokeWidth: 1,
      wallHeight3d: 80,
      wallThickness: 16,
    },
  },
  capabilities: ['style:geometry'],
  inspector: { groups: ['layout', 'appearance'], dedicatedInspector: 'wall' },
};

export const zone3dWidget: WidgetDefinition = {
  id: 'zone3d',
  version: 1,
  objectType: 'zone3d',
  category: 'symbols.electrical',
  paletteGroup: 'display',
  paletteVisible: false,
  display: {
    label: 'Room Zone',
    icon: 'map',
    color: '#6366f1',
    hint: 'Room zone — click to navigate + extrude 3D',
  },
  defaults: {
    width: 120,
    height: 80,
    text: 'Zone',
    style: { fill: 'rgba(99,102,241,0.2)', background: 'rgba(99,102,241,0.2)', zoneExtrudeHeight: 40 },
  },
  capabilities: ['interact:navigate', 'style:chrome'],
  inspector: { groups: ['layout', 'typography', 'appearance', 'navigation'], dedicatedInspector: 'hotspot' },
};

export const viewport3dWidget: WidgetDefinition = {
  id: 'viewport3d',
  version: 1,
  objectType: 'viewport3d',
  category: 'effects',
  paletteGroup: 'display',
  paletteVisible: false,
  display: {
    label: '3D View',
    icon: 'box',
    color: '#6366f1',
    hint: '3D Box or GLB model inside graphics area',
  },
  defaults: {
    width: 280,
    height: 220,
    text: '3D Model',
    style: { sceneBuildMode: 'box', cameraPreset: 'orbit', unifiedLayer: 'world' },
  },
  capabilities: ['style:chrome'],
  inspector: { groups: ['layout'], dedicatedInspector: 'view3d' },
};

export const scene3dWidget: WidgetDefinition = {
  id: 'scene3d',
  version: 1,
  objectType: 'scene3d',
  category: 'effects',
  paletteGroup: 'display',
  paletteVisible: false,
  display: {
    label: 'Full 3D Scene',
    icon: 'layout-panel-top',
    color: '#4f46e5',
    hint: 'Full-screen 3D Scene / GLB for digital twin',
  },
  defaults: {
    width: 1366,
    height: 768,
    text: '3D Scene',
    style: { sceneBuildMode: 'glb', cameraPreset: 'orbit', unifiedLayer: 'world', autoRotate: false },
  },
  capabilities: ['style:chrome'],
  inspector: { groups: ['layout'], dedicatedInspector: 'view3d' },
};

export const spriteWidget: WidgetDefinition = {
  id: 'sprite',
  version: 1,
  objectType: 'sprite',
  category: 'effects',
  paletteGroup: 'display',
  paletteVisible: false,
  display: {
    label: 'Sprite',
    icon: 'image',
    color: '#a855f7',
    hint: 'Sprite sheet animation controlled by tag',
  },
  defaults: {
    width: 96,
    height: 96,
    text: 'Sprite',
    style: { frameWidth: 64, frameHeight: 64, frameCount: 8, columns: 8, fps: 12, playThreshold: 0.5 },
  },
  capabilities: ['bind:scalar', 'animate:value'],
  inspector: { groups: ['layout', 'data', 'animation'], dedicatedInspector: 'sprite' },
};

export const lottieWidget: WidgetDefinition = {
  id: 'lottie',
  version: 1,
  objectType: 'lottie',
  category: 'effects',
  paletteGroup: 'display',
  paletteVisible: false,
  display: {
    label: 'Lottie',
    icon: 'play-circle',
    color: '#ec4899',
    hint: 'Lottie JSON/URL animation',
  },
  defaults: {
    width: 160,
    height: 160,
    text: 'Animation',
    style: { loop: true, autoplay: true, playThreshold: 0.5 },
  },
  capabilities: ['bind:scalar', 'animate:value'],
  inspector: { groups: ['layout', 'data', 'animation'], dedicatedInspector: 'lottie' },
};

export const iframeWidget: WidgetDefinition = {
  id: 'iframe',
  version: 1,
  objectType: 'iframe',
  category: 'media',
  paletteGroup: 'display',
  display: {
    label: 'iFrame',
    icon: 'globe',
    color: '#0ea5e9',
    hint: 'Embed an external webpage',
  },
  defaults: {
    width: 400,
    height: 280,
    text: 'https://',
    style: { iframeUrl: '' },
  },
  capabilities: ['style:chrome'],
  inspector: { groups: ['layout'], dedicatedInspector: 'iframe' },
};

export const PHASE5_WIDGETS: WidgetDefinition[] = [
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
];
