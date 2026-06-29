import type { GraphicObjectBinding } from '../graphics.js';

/** Threshold band for color / alarm styling. */
export type ThresholdBand = {
  id?: string;
  min: number;
  max: number;
  color?: string;
  label?: string;
  alarmSeverity?: 'info' | 'warning' | 'high' | 'critical';
};

/** Map tag value → display appearance. */
export type ValueMapping = {
  id?: string;
  when: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'between';
  value?: number | string | boolean;
  min?: number;
  max?: number;
  then: {
    text?: string;
    fill?: string;
    stroke?: string;
    visible?: boolean;
    imageUrl?: string;
  };
};

export type StateSlot = {
  value: number | string;
  label: string;
  color?: string;
  imageUrl?: string;
};

/**
 * Phase 1 binding schema — extends legacy GraphicObjectBinding.
 * Persisted inside `object.binding` (+ mirrored scalar fields tagId/tagIds).
 */
export type WidgetBindingSchema = GraphicObjectBinding & {
  primaryTagId?: string;
  secondaryTagIds?: string[];
  tagIdA?: string;
  tagIdB?: string;
  tagIdC?: string;
  aliasId?: string;
  unit?: string;
  unitAuto?: boolean;
  decimalPlaces?: number;
  format?: 'number' | 'percent' | 'engineering' | 'datetime';
  min?: number;
  max?: number;
  clamp?: boolean;
  thresholds?: ThresholdBand[];
  valueMappings?: ValueMapping[];
  stateSlots?: StateSlot[];
  showQuality?: boolean;
  staleTimeoutSec?: number;
  onlineTagId?: string;
  offlineAppearance?: { fill?: string; opacity?: number; text?: string };
  alarmTagIds?: string[];
  alarmSeverityFilter?: string;
};
