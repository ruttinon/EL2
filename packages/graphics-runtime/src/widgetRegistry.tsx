import React from 'react';
import { applyBoxBorder } from './layoutShapes';
import { resolveValueStateAppearance, valueVariantClass, usesVisualShell } from './valueAppearance';
import { parseStateSlots, resolveStateSlot } from './stateSlots';
import { ValueDisplayShell } from './ValueDisplayShell';
import type { TrendSeries } from './charts';
import type { WriteTagOptions } from './objectLogic';
import type {
  CurrentTagValue,
  NormalizedGraphicObject,
  RuntimeAlarm,
  TrendResponse,
} from './types';

export type RtWidgetContext = {
  obj: NormalizedGraphicObject;
  value?: CurrentTagValue;
  flowValue?: CurrentTagValue;
  enableValue?: CurrentTagValue;
  values: CurrentTagValue[];
  valuesByTag?: Map<string, CurrentTagValue>;
  alarm?: RuntimeAlarm;
  alarms: RuntimeAlarm[];
  trend?: TrendResponse | null;
  trendSeries?: TrendSeries[];
  style: React.CSSProperties;
  animClass: string;
  numVal: number | null;
  canWrite: boolean;
  interlockBlocked: boolean;
  runtimeMode: boolean;
  engineApiBase?: string;
  stageWidth?: number;
  stageHeight?: number;
  allObjects: NormalizedGraphicObject[];
  fireWrite: (tagId: string, tagName: string, dataType: string, options?: WriteTagOptions) => void;
  onNavigate?: (graphicId: string) => void;
  onAcknowledge?: (alarmId: string) => void;
  formatValue: (value: CurrentTagValue | undefined, fallbackDp?: number) => string;
};

export type RtWidgetComponent = React.ComponentType<{ ctx: RtWidgetContext }>;

const registry = new Map<string, RtWidgetComponent>();

export function registerWidget(
  type: string,
  component: RtWidgetComponent,
  options?: { override?: boolean },
): void {
  if (!type) return;
  if (registry.has(type) && !options?.override) return;
  registry.set(type, component);
}

export function unregisterWidget(type: string): boolean {
  return registry.delete(type);
}

export function getWidgetComponent(type: string): RtWidgetComponent | undefined {
  return registry.get(type);
}

export function hasWidget(type: string): boolean {
  return registry.has(type);
}

export function listRegisteredWidgets(): string[] {
  return Array.from(registry.keys());
}

function EllipseWidget({ ctx }: { ctx: RtWidgetContext }) {
  const sw = Number(ctx.obj.style?.strokeWidth ?? 1);
  const stroke = String(ctx.obj.style?.stroke ?? ctx.obj.style?.borderColor ?? '#9fc4cc');
  return (
    <div
      className={`rt-obj rt-rectangle${ctx.animClass}`}
      style={{
        ...applyBoxBorder(ctx.style, sw, stroke),
        borderRadius: '50%',
        boxSizing: 'border-box',
      }}
    />
  );
}

function ProgressBarWidget({ ctx }: { ctx: RtWidgetContext }) {
  const { obj, numVal, value, style, animClass, valuesByTag } = ctx;
  const minV = Number(obj.style?.min ?? 0);
  const maxV = Number(obj.style?.max ?? 100);
  const dp = Number(obj.style?.decimalPlaces ?? 1);
  const span = maxV - minV;
  const pct =
    numVal === null || !Number.isFinite(numVal) || span === 0
      ? 0
      : Math.min(1, Math.max(0, (numVal - minV) / span));
  const appearance = resolveValueStateAppearance(obj, value, valuesByTag);
  const barColor = appearance.fill ?? appearance.background ?? String(obj.style?.fill ?? '#22c55e');
  const fillImage = appearance.displayMode === 'image' ? appearance.imageUrl : undefined;
  const trackColor = String(obj.style?.trackColor ?? obj.style?.background ?? '#e2e8f0');
  const sw = Number(obj.style?.strokeWidth ?? 0);
  const stroke = String(obj.style?.stroke ?? '#94a3b8');
  const unit = String(obj.style?.unit ?? value?.unit ?? '');
  const orientation = String(obj.style?.barOrientation ?? (obj.type === 'levelbar' ? 'vertical' : 'horizontal')) === 'vertical'
    ? 'vertical'
    : 'horizontal';
  const vertical = orientation === 'vertical';
  const frameClass = vertical ? 'rt-levelbar' : 'rt-progressbar';
  const trackClass = vertical ? 'rt-levelbar-inner' : 'rt-progressbar-track';
  const fillClass = vertical ? 'rt-levelbar-fill' : 'rt-progressbar-fill';
  const labelClass = vertical ? 'rt-levelbar-label' : 'rt-progressbar-label';
  return (
    <div
      className={`rt-obj ${frameClass}${animClass}`}
      style={{ ...applyBoxBorder(style, sw, stroke), background: vertical ? trackColor : 'transparent', padding: 4, overflow: 'hidden' }}
    >
      <div className={trackClass} style={vertical ? undefined : { background: trackColor }}>
        <div
          className={fillClass}
          style={{
            width: vertical ? '100%' : `${pct * 100}%`,
            height: vertical ? `${pct * 100}%` : undefined,
            background: fillImage ? 'transparent' : barColor,
            overflow: 'hidden',
          }}
        >
          {fillImage ? (
            <img src={fillImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          ) : null}
        </div>
      </div>
      <span className={labelClass}>
        {numVal !== null && Number.isFinite(numVal) ? numVal.toFixed(dp) : '--'}
        {unit}
      </span>
    </div>
  );
}

function SemaphoreWidget({ ctx }: { ctx: RtWidgetContext }) {
  const { obj, value, style, animClass, valuesByTag } = ctx;
  const v = Number(value?.value ?? 0);
  const activeKey = v >= 2 ? 2 : v <= 0 ? 0 : 1;
  const slots = parseStateSlots(obj.style);
  const appearance = resolveValueStateAppearance(obj, value, valuesByTag);
  const variantCls = valueVariantClass(appearance.variant);
  const slotColor = (key: number, fallback: string) => resolveStateSlot(key, slots)?.color ?? fallback;

  if (usesVisualShell(appearance)) {
    const activeSlot = resolveStateSlot(activeKey, slots);
    const shellAppearance = {
      ...appearance,
      imageUrl: appearance.imageUrl ?? activeSlot?.imageUrl,
      glbUrl: appearance.glbUrl ?? activeSlot?.glbUrl,
    };
    return (
      <ValueDisplayShell
        appearance={shellAppearance}
        className={`rt-obj rt-semaphore${variantCls}${animClass}`}
        style={{ ...style, padding: 4, borderRadius: 12 }}
        autoRotate3d={obj.style?.autoRotate !== false}
      >
        {activeSlot?.label ? <span className="rt-semaphore-label">{activeSlot.label}</span> : null}
      </ValueDisplayShell>
    );
  }

  const lights = [
    { color: slotColor(2, '#ef4444'), active: v >= 2 },
    { color: slotColor(1, '#f59e0b'), active: v === 1 },
    { color: slotColor(0, '#22c55e'), active: v <= 0 },
  ];
  return (
    <div
      className={`rt-obj rt-semaphore${variantCls}${animClass}`}
      style={{
        ...style,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-evenly',
        gap: 4,
        padding: 6,
        borderRadius: 12,
        background: String(obj.style?.fill ?? obj.style?.background ?? '#1e293b'),
      }}
    >
      {lights.map((l, idx) => (
        <div
          key={idx}
          className="rt-semaphore-light"
          style={{
            background: l.active ? l.color : `${l.color}33`,
            boxShadow: l.active ? `0 0 10px 2px ${l.color}99` : 'none',
          }}
        />
      ))}
    </div>
  );
}

import {
  EnergySummaryWidget,
  DemandSummaryWidget,
  PowerQualityWidget,
  TouTableWidget,
  PageBreakWidget,
  SectionWidget,
  HeaderFooterWidget,
  VariableWidget,
  QrCodeWidget,
  SignatureWidget,
  MeterBillingWidget,
  CostSummaryWidget,
} from './reportWidgets';

registerWidget('ellipse', EllipseWidget);
registerWidget('progressbar', ProgressBarWidget);
registerWidget('levelbar', ProgressBarWidget);
registerWidget('semaphore', SemaphoreWidget);

// Report widgets
registerWidget('energysummary', EnergySummaryWidget);
registerWidget('demandsummary', DemandSummaryWidget);
registerWidget('powerquality', PowerQualityWidget);
registerWidget('toutable', TouTableWidget);
registerWidget('pagebreak', PageBreakWidget);
registerWidget('section', SectionWidget);
registerWidget('headerfooter', HeaderFooterWidget);
registerWidget('variable', VariableWidget);
registerWidget('qrcode', QrCodeWidget);
registerWidget('signature', SignatureWidget);
registerWidget('meterbilling', MeterBillingWidget);
registerWidget('costsummary', CostSummaryWidget);
