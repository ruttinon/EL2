export type TrendPoint = {
  id?: string;
  tagId: string;
  tagName?: string;
  deviceId?: string;
  deviceName?: string;
  value?: number | null;
  unit?: string | null;
  quality?: string;
  readAt: string;
  error?: string | null;
  /** Aggregation extras (present when the trend is downsampled). */
  min?: number;
  max?: number;
  avg?: number;
  count?: number;
};

export type TrendResponse = {
  tagId: string;
  count: number;
  values: TrendPoint[];
  /** True when the engine downsampled the series into time buckets. */
  aggregated?: boolean;
  /** Bucket size in ms when aggregated. */
  bucketMs?: number;
  /** Aggregate used for the primary value when aggregated. */
  agg?: string;
  /** Number of raw samples that fed the aggregation. */
  sampleCount?: number;
};

export type CurrentTagValue = {
  id: string;
  name: string;
  deviceId?: string;
  deviceName?: string;
  value?: number | boolean | string | null;
  unit?: string | null;
  quality?: string;
  dataType?: string;
  decimalPlaces?: number | null;
};

export type RuntimeAlarm = {
  id: string;
  tagId?: string;
  tagName?: string;
  deviceId?: string;
  deviceName?: string;
  message?: string;
  severity?: string;
  status?: string;
};

import type { WidgetAnimation, WidgetInteraction } from '@energylink/shared-types';

export type GraphicActionType =
  | 'show'
  | 'hide'
  | 'blink'
  | 'rotate'
  | 'move'
  | 'color'
  | 'floodFill'
  | 'swapImage';

export type GraphicObjectAction = {
  tagId: string;
  min: number;
  max: number;
  type: GraphicActionType;
  options?: {
    fillA?: string;
    fillB?: string;
    interval?: number;
    minAngle?: number;
    maxAngle?: number;
    toX?: number;
    toY?: number;
    duration?: number;
    color?: string;
    stroke?: string;
    fillColor?: string;
    imageUrl?: string;
  };
};

export type RawGraphicObject = {
  id: string;
  type: string;
  name?: string;
  text?: string;
  tagId?: string;
  tagIds?: string[];
  deviceId?: string;
  flowTagId?: string;
  enableTagId?: string;
  navigateTo?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  visible?: boolean;
  locked?: boolean;
  layer?: number;
  imageDataUrl?: string;
  displayMode?: string;
  binding?: {
    tagId?: string | null;
    tagName?: string;
    tagIds?: string[];
    deviceId?: string;
    flowTagId?: string | null;
    enableTagId?: string | null;
    tagIdA?: string | null;
    tagIdB?: string | null;
    tagIdC?: string | null;
    unit?: string | null;
    decimalPlaces?: number | null;
    rotate3dTagId?: string | null;
    rotate3dAxis?: 'x' | 'y' | 'z';
    rotate3dMultiplier?: number;
    scale3dTagId?: string | null;
    scale3dMultiplier?: number;
    splineMappings?: Record<string, string>;
  };
  style?: Record<string, string | number | boolean | undefined>;
  actions?: GraphicObjectAction[];
  interactions?: WidgetInteraction[];
  animations?: WidgetAnimation[];
};

export type NormalizedGraphicObject = RawGraphicObject & {
  tagId?: string;
  tagIds?: string[];
  deviceId?: string;
  navigateTo?: string;
  flowTagId?: string;
  enableTagId?: string;
  tagIdA?: string;
  tagIdB?: string;
  tagIdC?: string;
};

export type FetchTrendFn = (opts: {
  tagId: string;
  from?: string;
  to?: string;
  limit?: number;
}) => Promise<TrendResponse | null>;
