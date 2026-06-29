import type { GraphicObjectType } from '@energylink/shared-types';

export type WidgetCategoryId =
  | 'layout'
  | 'shape'
  | 'text'
  | 'values'
  | 'charts'
  | 'tables'
  | 'controls'
  | 'symbols.electrical'
  | 'symbols.mechanical'
  | 'media'
  | 'effects'
  | 'navigation'
  | 'custom';

export type WidgetPaletteGroup = 'display' | 'action';

export type WidgetCapability =
  | 'bind:scalar'
  | 'bind:multi'
  | 'bind:timeseries'
  | 'bind:alarm'
  | 'bind:formula'
  | 'bind:flow'
  | 'interact:write'
  | 'interact:navigate'
  | 'animate:value'
  | 'style:chrome'
  | 'style:typography'
  | 'style:geometry'
  | 'ports'
  | 'groupable';

export type InspectorFieldType =
  | 'text'
  | 'number'
  | 'toggle'
  | 'select'
  | 'color'
  | 'tag'
  | 'segmented'
  | 'combobox';

export type InspectorFieldDef = {
  id: string;
  type: InspectorFieldType;
  label: string;
  /** Dot path: style.fill | binding.tagId | width */
  path: string;
  min?: number;
  max?: number;
  step?: number;
  options?: { value: string; label: string }[];
  placeholder?: string;
  help?: string;
};

export type InspectorGroupId =
  | 'layout'
  | 'transform'
  | 'appearance'
  | 'typography'
  | 'stroke'
  | 'data'
  | 'thresholds'
  | 'interaction'
  | 'animation'
  | 'navigation'
  | 'effects'
  | 'advanced';

export type InspectorGroupRef =
  | InspectorGroupId
  | { custom: string; fields: InspectorFieldDef[] };

export type WidgetDefinition = {
  /** Registry id — usually matches GraphicObjectType */
  id: string;
  version: number;
  /** Runtime object type persisted to layout JSON */
  objectType: GraphicObjectType | string;
  category: WidgetCategoryId;
  paletteGroup: WidgetPaletteGroup;

  display: {
    label: string;
    icon: string;
    color: string;
    hint?: string;
    keywords?: string[];
  };

  defaults: {
    width: number;
    height: number;
    text?: string;
    name?: string;
    style?: Record<string, unknown>;
    binding?: Record<string, unknown>;
  };

  capabilities: WidgetCapability[];

  inspector: {
    /** Shared group ids + optional widget-specific fields */
    groups: InspectorGroupRef[];
    /** Delegate to dedicated React inspector component in editor */
    dedicatedInspector?: 'value' | 'gauge' | 'button' | 'status' | 'elecsymbol' | 'clock' | 'switch' | 'chart' | 'table' | 'slider' | 'input' | 'dropdown' | 'nav' | 'tabbar' | 'shape' | 'image' | 'video' | 'flowpath' | 'hotspot' | 'group' | 'view3d' | 'iframe' | 'sprite' | 'lottie' | 'wall' | 'cable3d';
  };

  aliases?: string[];
  /** When false, widget stays in registry/runtime but is hidden from editor palette. */
  paletteVisible?: boolean;
};

export type WidgetCategoryMeta = {
  id: WidgetCategoryId;
  label: string;
  paletteGroup: WidgetPaletteGroup;
  icon: string;
};
