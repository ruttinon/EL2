import React from 'react';
import { MiniTrendChart, MiniBarChart, SparklineChart, SvgGauge, MiniPieChart, KpiCard, MultiTrendChart, type TrendSeries } from './charts';
import { FlowPathObject, ElecSymbolObject, Cable3dObject, PipeObject, ElecSymbolSvg, BusSectionObject, FeedLabelObject, Zone2dObject, EquipmentSymbolObject } from './SldObjects';
import { SpriteObject, LottieObject, Viewport3dObject } from './EffectObjects';
import { EquipmentChrome, resolveStatusImageUrl, withEquipmentPosition } from './equipmentChrome';
import { EChartsWidget } from './EChartsWidget';
import { EnergyChart } from './energy-chart';
import { resolveChartType, gaugeStyleToChartType } from './energy-chart';
import { designPreviewTag } from './designPreview';
import { applyConditionalStyle } from './normalize';
import {
  applyBaseWidgetStyle,
  evaluateFormula,
  formatDynamicText,
  hasActiveAlarmForTag,
  parseMemberIds,
  parseTagTableColumns,
  resolveButtonWriteValue,
  resolveControlEnabled,
  resolveInterlockBlocked,
  resolveObjectActions,
  resolveRuntimeVisible,
  resolveStatusBadge,
  resolveSwitchWriteValue,
  tagTableToCsv,
  type TagTableColumn,
  type WriteTagOptions,
} from './objectLogic';
import { runInteractions } from './runInteractions';
import { resolveWidgetAnimations } from './resolveWidgetAnimations';
import {
  parsePolygonPointString,
  polygonSvgPoints,
  applyBoxBorder,
  resolveLineCap,
  resolveLineDash,
} from './layoutShapes';
import { ClockObject } from './ClockObject';
import { getWidgetComponent, type RtWidgetContext } from './widgetRegistry';
import { applyChromelessStyle, resolveObjectFit, resolveRenderMode, isChromelessRenderMode, isFreeMediaFrame, resolveMediaSrc } from './sceneUtils';
import { resolveValueStateAppearance, valueVariantClass, usesVisualShell } from './valueAppearance';
import { ValueDisplayShell } from './ValueDisplayShell';
import type {
  CurrentTagValue,
  NormalizedGraphicObject,
  RuntimeAlarm,
  TrendResponse,
} from './types';

function chromelessShellStyle(style: React.CSSProperties): React.CSSProperties {
  const rest: React.CSSProperties = { ...style };
  delete rest.border;
  return {
    ...rest,
    padding: 0,
    background: 'transparent',
    borderWidth: 0,
    borderStyle: 'none',
    borderColor: 'transparent',
    boxShadow: 'none',
  };
}

function isTransparentWidget(style: Record<string, string | number | boolean | undefined> | undefined): boolean {
  if (style?.transparentBg === true) return true;
  const bg = String(style?.background ?? style?.fill ?? '').trim().toLowerCase();
  return bg === 'transparent' || bg === 'none';
}

export type RtObjectProps = {
  obj: NormalizedGraphicObject;
  value?: CurrentTagValue;
  flowValue?: CurrentTagValue;
  enableValue?: CurrentTagValue;
  values?: CurrentTagValue[];
  alarm?: RuntimeAlarm;
  alarms?: RuntimeAlarm[];
  trend?: TrendResponse | null;
  trendSeries?: TrendSeries[];
  onWriteTag?: (tagId: string, tagName: string, dataType: string, options?: WriteTagOptions) => void;
  onNavigate?: (graphicId: string) => void;
  onAcknowledge?: (alarmId: string) => void;
  valuesByTag?: Map<string, CurrentTagValue>;
  index?: number;
  animate?: boolean;
  runtimeMode?: boolean;
  engineApiBase?: string;
  stageWidth?: number;
  stageHeight?: number;
  allObjects?: NormalizedGraphicObject[];
  /** Resolve asset:// refs from bundled/local asset library */
  resolveAssetRef?: (ref: string) => string;
};

const ECHART_COLORS = ['#087c8b', '#f59e0b', '#8b5cf6', '#ef4444', '#22c55e', '#06b6d4'];

function withChartTheme(style: React.CSSProperties, obj: NormalizedGraphicObject): React.CSSProperties {
  const primary = obj.style?.chartPrimaryColor;
  if (typeof primary === 'string' && primary) {
    return { ...style, ['--chart-primary' as string]: primary } as React.CSSProperties;
  }
  return style;
}

function fmtVal(v: CurrentTagValue | undefined, fallbackDp = 2, styleDp?: number) {
  if (!v || v.value === null || v.value === undefined) return '--';
  if (typeof v.value === 'boolean') return v.value ? 'ON' : 'OFF';
  const dp = Number.isFinite(v.decimalPlaces)
    ? Number(v.decimalPlaces)
    : Number.isFinite(styleDp)
      ? Number(styleDp)
      : fallbackDp;
  const n = Number(v.value);
  if (!Number.isFinite(n)) return String(v.value);
  return n.toFixed(dp);
}

function loadScriptOnce(id: string, src: string): Promise<void> {
  if (document.getElementById(id)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.id = id;
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

type HlsPlayer = {
  loadSource: (url: string) => void;
  attachMedia: (el: HTMLMediaElement) => void;
  destroy: () => void;
};

declare global {
  interface Window {
    Hls?: {
      isSupported: () => boolean;
      new (config?: { enableWorker?: boolean }): HlsPlayer;
    };
  }
}

function HlsVideoPlayer({ src, alt }: { src: string; alt: string }) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const el = videoRef.current;
    if (!el || !src) return undefined;
    let hls: HlsPlayer | null = null;
    let cancelled = false;

    void (async () => {
      try {
        if (el.canPlayType('application/vnd.apple.mpegurl')) {
          el.src = src;
          await el.play().catch(() => undefined);
          return;
        }
        await loadScriptOnce('energylink-hls-js', 'https://cdn.jsdelivr.net/npm/hls.js@1.5.15/dist/hls.min.js');
        if (cancelled || !window.Hls?.isSupported()) {
          setError('HLS not supported in this browser');
          return;
        }
        hls = new window.Hls({ enableWorker: true });
        hls.loadSource(src);
        hls.attachMedia(el);
        await el.play().catch(() => undefined);
      } catch {
        if (!cancelled) setError('HLS playback failed');
      }
    })();

    return () => {
      cancelled = true;
      hls?.destroy();
    };
  }, [src]);

  if (error) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a', color: '#f87171', fontSize: 11, padding: 8, textAlign: 'center' }}>
        {error}
      </div>
    );
  }

  return (
    <video
      ref={videoRef}
      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      autoPlay
      muted
      playsInline
      controls
      title={alt}
    />
  );
}

function RtspVideoPlayer({
  rtspUrl,
  engineApiBase,
  alt,
}: {
  rtspUrl: string;
  engineApiBase?: string;
  alt: string;
}) {
  const [mjpegUrl, setMjpegUrl] = React.useState<string | null>(null);
  const [hlsUrl, setHlsUrl] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!rtspUrl || !engineApiBase) {
      setError(engineApiBase ? null : 'Engine URL required for RTSP bridge');
      return undefined;
    }
    let cancelled = false;
    let sessionId: string | null = null;

    void (async () => {
      try {
        const res = await fetch(`${engineApiBase.replace(/\/$/, '')}/api/stream/rtsp/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rtspUrl }),
        });
        const data = (await res.json()) as {
          ok?: boolean;
          id?: string;
          mjpegUrl?: string;
          hlsUrl?: string;
          error?: string;
        };
        if (cancelled) return;
        if (!res.ok || !data.ok) {
          setError(data.error ?? 'RTSP bridge failed');
          return;
        }
        sessionId = data.id ?? null;
        const base = engineApiBase.replace(/\/$/, '');
        if (data.hlsUrl) setHlsUrl(`${base}${data.hlsUrl}`);
        if (data.mjpegUrl) setMjpegUrl(`${base}${data.mjpegUrl}`);
      } catch {
        if (!cancelled) setError('RTSP bridge unavailable');
      }
    })();

    return () => {
      cancelled = true;
      if (sessionId && engineApiBase) {
        void fetch(`${engineApiBase.replace(/\/$/, '')}/api/stream/rtsp/${sessionId}`, { method: 'DELETE' });
      }
    };
  }, [rtspUrl, engineApiBase]);

  if (error) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a', color: '#f87171', fontSize: 11, padding: 8, textAlign: 'center' }}>
        {error}
      </div>
    );
  }
  if (hlsUrl) {
    return <HlsVideoPlayer src={hlsUrl} alt={alt} />;
  }
  if (!mjpegUrl) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a', color: '#94a3b8', fontSize: 11 }}>
        Starting RTSP…
      </div>
    );
  }
  return (
    <img
      src={mjpegUrl}
      alt={alt}
      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      referrerPolicy="no-referrer"
    />
  );
}

export function RtObject({
  obj,
  value,
  flowValue,
  enableValue,
  values = [],
  alarm,
  alarms = [],
  trend,
  trendSeries,
  onWriteTag,
  onNavigate,
  onAcknowledge,
  valuesByTag,
  index = 0,
  animate = true,
  runtimeMode = true,
  engineApiBase,
  stageWidth,
  stageHeight,
  allObjects = [],
  resolveAssetRef,
}: RtObjectProps) {
  if (obj.visible === false) return null;
  if (valuesByTag && !resolveRuntimeVisible(obj, valuesByTag)) return null;

  const controlEnabled = valuesByTag ? resolveControlEnabled(obj, valuesByTag) : true;
  const interlockBlocked = valuesByTag ? resolveInterlockBlocked(obj, valuesByTag) : false;
  const canWrite = controlEnabled && !interlockBlocked;
  const boundTagIds = obj.tagIds?.length ? obj.tagIds : (obj.tagId ? [obj.tagId] : []);
  const hasBoundTag = boundTagIds.length > 0;
  let displayValue = value ?? (!runtimeMode && !hasBoundTag ? designPreviewTag(obj) : undefined);

  if (obj.style?.formulaEnabled && obj.style?.formula && valuesByTag) {
    try {
      const A = Number(valuesByTag.get(obj.binding?.tagIdA || '')?.value ?? 0);
      const B = Number(valuesByTag.get(obj.binding?.tagIdB || '')?.value ?? 0);
      const C = Number(valuesByTag.get(obj.binding?.tagIdC || '')?.value ?? 0);
      const Tag = Number(value?.value ?? 0);

      const fn = new Function('A', 'B', 'C', 'Tag', `return ${obj.style.formula}`);
      const computedValue = fn(A, B, C, Tag);

      if (displayValue) {
        displayValue = { ...displayValue, value: computedValue };
      } else {
        displayValue = { id: 'formula', name: 'Formula', value: computedValue, dataType: 'number' };
      }
    } catch (err) {
      console.error('Formula evaluation error:', err);
      if (displayValue) {
        displayValue = { ...displayValue, value: 'ERR' };
      } else {
        displayValue = { id: 'formula', name: 'Formula', value: 'ERR', dataType: 'string' };
      }
    }
  }
  const controlDisabled = runtimeMode && (!obj.tagId || !canWrite);
  const alarmBlink = obj.style?.blinkWhenAlarm && hasActiveAlarmForTag(obj.tagId, alarms);

  const fireWrite = (tagId: string, tagName: string, dataType: string, options?: WriteTagOptions) => {
    if (!onWriteTag || !canWrite) return;
    onWriteTag(tagId, tagName, dataType, options);
  };

  const animDelay = `${0.04 + index * 0.035}s`;
  let animClass = `${animate ? ' rt-obj-animate' : ''}${alarmBlink ? ' rt-alarm-pulse' : ''}`;
  let style: React.CSSProperties = applyBaseWidgetStyle({
    left: obj.x,
    top: obj.y,
    width: obj.width,
    height: obj.height,
    color: String(obj.style?.color ?? '#173047'),
    borderColor: String(obj.style?.borderColor ?? obj.style?.stroke ?? '#9fc4cc'),
    background: String(obj.style?.background ?? obj.style?.fill ?? 'rgba(255,255,255,.95)'),
    animationDelay: animDelay,
    zIndex: obj.layer ?? 1,
  }, obj);
  style = applyChromelessStyle(style, obj);
  if (!runtimeMode) {
    if (isTransparentWidget(obj.style)) {
      style = chromelessShellStyle(style);
    } else {
      const sw = Number(obj.style?.strokeWidth ?? obj.style?.borderWidth);
      if (Number.isFinite(sw) && sw <= 0) {
        const borderlessStyle: React.CSSProperties = { ...style };
        delete borderlessStyle.border;
        style = { ...borderlessStyle, borderWidth: 0, borderStyle: 'none', borderColor: 'transparent' };
      }
    }
  }

  const numVal = displayValue?.value != null ? Number(displayValue.value) : null;
  style = applyConditionalStyle(style, numVal, obj.style);

  if (alarmBlink) {
    const speed = String(obj.style?.alarmBlinkSpeed ?? 'normal');
    if (speed === 'slow') style.animationDuration = '2s';
    else if (speed === 'fast') style.animationDuration = '0.5s';
    else style.animationDuration = '1s';
  }

  // Value-driven actions (legacy actions[]) + declarative animations[]
  let actionImageUrl: string | undefined;
  if (valuesByTag) {
    const actionFx = resolveObjectActions(obj, valuesByTag);
    const animFx = resolveWidgetAnimations(obj, valuesByTag);
    if (actionFx || animFx) {
      const baseTransform = style.transform;
      if (actionFx) {
        style = { ...style, ...actionFx.style };
        if (actionFx.className) animClass += actionFx.className;
        if (actionFx.imageUrl) actionImageUrl = actionFx.imageUrl;
      }
      if (animFx) {
        style = { ...style, ...animFx.style };
        if (animFx.className) animClass += animFx.className;
        if (animFx.imageUrl) actionImageUrl = animFx.imageUrl;
      }
      const fxTransform = [actionFx?.style.transform, animFx?.style.transform].filter(Boolean).join(' ');
      if (baseTransform && fxTransform) {
        style.transform = `${baseTransform} ${fxTransform}`;
      } else if (fxTransform) {
        style.transform = fxTransform;
      }
    }
  }

  // Widget registry (P4): allow custom/extensible widgets to render before the
  // built-in if-chain. Falls through to built-ins when no widget is registered.
  const RegisteredWidget = getWidgetComponent(obj.type);
  if (RegisteredWidget) {
    const ctx: RtWidgetContext = {
      obj,
      value: displayValue,
      flowValue,
      enableValue,
      values,
      valuesByTag,
      alarm,
      alarms,
      trend,
      trendSeries,
      style,
      animClass,
      numVal,
      canWrite,
      interlockBlocked,
      runtimeMode,
      engineApiBase,
      stageWidth,
      stageHeight,
      allObjects,
      fireWrite,
      onNavigate,
      onAcknowledge,
      formatValue: fmtVal,
    };
    return <RegisteredWidget ctx={ctx} />;
  }

  if (obj.type === 'flowpath') {
    return <FlowPathObject obj={obj} flowValue={flowValue ?? value} enableValue={enableValue} animClass={animClass} />;
  }

  if (obj.type === 'cable3d' && obj.style?.viewportHostId) {
    return null;
  }

  if (obj.type === 'cable3d') {
    return <Cable3dObject obj={obj} flowValue={flowValue ?? value} enableValue={enableValue} animClass={animClass} />;
  }

  if (obj.type === 'pipe') {
    return <PipeObject obj={obj} flowValue={flowValue ?? value} enableValue={enableValue} animClass={animClass} />;
  }

  if (obj.type === 'elecsymbol') {
    const hasTooltip = Boolean(obj.style?.tooltipTagIds) || Boolean(obj.style?.drillDown) || Boolean(obj.navigateTo);
    if (hasTooltip) {
      return (
        <EquipmentSymbolObject
          obj={obj}
          value={value}
          valuesByTag={valuesByTag}
          onNavigate={onNavigate}
          animClass={animClass}
          renderSymbol={<ElecSymbolSvg obj={obj} value={value} />}
        />
      );
    }
    return <ElecSymbolObject obj={obj} value={value} animClass={animClass} />;
  }

  if (obj.type === 'bussection') {
    return <BusSectionObject obj={obj} animClass={animClass} />;
  }

  if (obj.type === 'feedlabel') {
    return <FeedLabelObject obj={obj} value={value} flowValue={flowValue} animClass={animClass} />;
  }

  if (obj.type === 'zone2d') {
    return <Zone2dObject obj={obj} value={value} onNavigate={onNavigate} animClass={animClass} />;
  }

  if (obj.type === 'sprite') {
    return <SpriteObject obj={obj} value={value} animClass={animClass} hideEmptyPlaceholder={runtimeMode} />;
  }

  if (obj.type === 'lottie') {
    return <LottieObject obj={obj} value={value} animClass={animClass} hideEmptyPlaceholder={runtimeMode} />;
  }

  if (obj.type === 'viewport3d' || obj.type === 'scene3d') {
    const vpObj =
      obj.type === 'scene3d' && stageWidth && stageHeight
        ? { ...obj, x: 0, y: 0, width: stageWidth, height: stageHeight }
        : obj;
    return (
      <Viewport3dObject
        obj={vpObj}
        animClass={animClass}
        value={value}
        valuesByTag={valuesByTag}
        hideEmptyPlaceholder={runtimeMode}
        peerObjects={allObjects}
      />
    );
  }

  if (obj.type === 'line') {
    const sw = Math.max(1, Number(obj.style?.strokeWidth ?? 2));
    const lineColor = String(obj.style?.stroke ?? obj.style?.background ?? '#475569');
    const dash = resolveLineDash(obj.style);
    const cap = resolveLineCap(obj.style);
    const w = Math.max(1, obj.width);
    const h = Math.max(sw + 4, obj.height);
  return (
      <div
        className={`rt-line${animClass}`}
        style={{
          left: obj.x,
          top: obj.y,
          width: w,
          height: h,
          background: 'transparent',
          animationDelay: animDelay,
          zIndex: obj.layer ?? 1,
          pointerEvents: 'none',
        }}
      >
        <svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${w} ${h}`}
          preserveAspectRatio="none"
          style={{ display: 'block', overflow: 'visible' }}
        >
          <line
            x1={0}
            y1={h / 2}
            x2={w}
            y2={h / 2}
            stroke={lineColor}
            strokeWidth={sw}
            strokeDasharray={dash}
            strokeLinecap={cap}
          />
        </svg>
      </div>
    );
  }

  const imgUrl = resolveMediaSrc(obj.style?.imageAssetRef as string | undefined, resolveAssetRef)
    ?? resolveMediaSrc(obj.style?.imageDataUrl as string | undefined, resolveAssetRef)
    ?? resolveMediaSrc((obj as { imageDataUrl?: string }).imageDataUrl, resolveAssetRef);
  if (obj.type === 'image' || (imgUrl && obj.type !== 'hotspot')) {
    const fit = resolveObjectFit(obj.style?.objectFit);
    const statusUrl = valuesByTag ? resolveStatusImageUrl(obj, valuesByTag) : undefined;
    const shownUrl = actionImageUrl ?? statusUrl ?? imgUrl;
    const chromeActive = obj.style?.statusEnabled === true || obj.style?.showValueOverlay === true;
    const freeFrame = isFreeMediaFrame(obj.style as Record<string, unknown> | undefined);
    const opacity = Number(obj.style?.mediaOpacity ?? 100) / 100;
    const imgStyle = chromeActive ? withEquipmentPosition(style) : style;
    const containerStyle: React.CSSProperties = freeFrame
      ? { ...imgStyle, background: 'transparent', border: 'none', boxShadow: 'none', padding: 0, opacity }
      : { ...imgStyle, opacity };
    const imgTagStyle: React.CSSProperties = fit === 'none'
      ? { maxWidth: '100%', maxHeight: '100%', width: 'auto', height: 'auto', objectFit: 'none', display: 'block', margin: 'auto' }
      : { width: '100%', height: '100%', objectFit: fit, display: 'block' };
    return (
      <div
        className={`rt-obj rt-image rt-render-${resolveRenderMode(obj)}${freeFrame ? ' rt-image-free' : ''}${animClass}`}
        style={{
          ...containerStyle,
          ...(fit === 'none' ? { display: 'flex', alignItems: 'center', justifyContent: 'center' } : {}),
        }}
      >
        {shownUrl ? (
          <img src={shownUrl} alt={obj.name} style={imgTagStyle} />
        ) : (
          <span style={{ fontSize: 10, color: 'var(--muted)' }}>No Image</span>
        )}
        <EquipmentChrome obj={obj} valuesByTag={valuesByTag} primaryValue={value} />
      </div>
    );
  }

  if (obj.type === 'panel') {
    const sw = Number(obj.style?.strokeWidth ?? 1);
    const stroke = String(obj.style?.stroke ?? obj.style?.borderColor ?? '#64748b');
    const borderRadius = obj.style?.borderRadius != null ? `${Number(obj.style.borderRadius)}px` : '8px';
    const title = obj.text || 'หัวข้อ';
    return (
      <div
        className={`rt-obj rt-panel${animClass}`}
        style={{
          ...applyBoxBorder(style, sw, stroke),
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          overflow: 'hidden',
          borderRadius,
          boxSizing: 'border-box',
        }}
      >
        <div
          className="rt-panel-title"
          style={{
            padding: '6px 10px',
            fontSize: 12,
            fontWeight: 700,
            background: 'rgba(100,116,139,0.18)',
            borderBottomWidth: 1,
            borderBottomStyle: 'solid',
            borderBottomColor: stroke,
            color: String(obj.style?.color ?? '#334155'),
          }}
        >
          {title}
        </div>
        <div style={{ flex: 1, minHeight: 0 }} />
      </div>
    );
  }

  if (obj.type === 'rectangle' || obj.type === 'circle') {
    const sw = Number(obj.style?.strokeWidth ?? 1);
    const stroke = String(obj.style?.stroke ?? obj.style?.borderColor ?? '#9fc4cc');
    const borderRadius = obj.type === 'circle'
      ? '50%'
      : (obj.style?.borderRadius != null ? `${Number(obj.style.borderRadius)}px` : undefined);
    return (
      <div
        className={`rt-obj rt-rectangle${animClass}`}
        style={{
          ...applyBoxBorder(style, sw, stroke),
          borderRadius,
          boxSizing: 'border-box',
        }}
      />
    );
  }

  if (obj.type === 'text') {
    const displayText = formatDynamicText(obj.text || obj.name || '', value, obj.name);
    return (
      <div className={`rt-obj rt-text${animClass}`} style={style}>
        {displayText}
      </div>
    );
  }

  if (obj.type === 'button') {
    const preset = resolveButtonWriteValue(obj);
    const requireConfirm = obj.style?.confirmWrite === true;
    const buttonActionMode = obj.style?.buttonActionMode === 'navigate'
      ? 'navigate'
      : obj.style?.buttonActionMode === 'write'
        ? 'write'
        : undefined;
    const buttonUsesNavigation = buttonActionMode === 'navigate' || (buttonActionMode == null && !obj.tagId && Boolean(obj.navigateTo));
    const buttonDisabled = runtimeMode && (buttonUsesNavigation ? !obj.navigateTo : (!obj.tagId || !canWrite));
    return (
      <div
        className={`rt-obj rt-button${animClass}${buttonDisabled ? ' rt-control-disabled' : ''}${interlockBlocked ? ' rt-interlock-blocked' : ''}`}
        style={{
          ...style,
          cursor: buttonDisabled ? 'not-allowed' : 'pointer',
          opacity: buttonDisabled ? 0.55 : style.opacity,
        }}
        onClick={() => {
          if (buttonDisabled) return;
          if (runInteractions(obj.interactions, 'click', { fireWrite, onNavigate })) return;
          if (buttonUsesNavigation) {
            if (obj.navigateTo && onNavigate) onNavigate(obj.navigateTo);
            return;
          }
          if (!obj.tagId) return;
          fireWrite(obj.tagId, obj.name || obj.tagId, value?.dataType || 'uint16', { presetValue: preset, requireConfirm });
        }}
      >
        {obj.text || obj.name}
      </div>
    );
  }

  if (obj.type === 'gauge') {
    const appearance = resolveValueStateAppearance(obj, displayValue, valuesByTag, actionImageUrl);
    const variantCls = valueVariantClass(appearance.variant);
    const minV = typeof obj.style?.min === 'number' ? obj.style.min : Number(obj.style?.min ?? 0);
    const maxV = typeof obj.style?.max === 'number' ? obj.style.max : Number(obj.style?.max ?? 100);
    const fill = appearance.fill ?? appearance.background ?? String(obj.style?.fill ?? obj.style?.background ?? 'transparent');
    const sw = Number(obj.style?.strokeWidth ?? 1);
    const stroke = String(obj.style?.stroke ?? obj.style?.borderColor ?? '#9fc4cc');
    const title = (appearance.text ?? obj.text)?.trim();
    const gaugeStyle = String(obj.style?.gaugeStyle ?? 'classic');
    const energyGaugeType = gaugeStyleToChartType(gaugeStyle);
    const gaugeTagIds = obj.tagIds?.length ? obj.tagIds : (obj.tagId ? [obj.tagId] : []);
    const gaugeAllowDemo = !runtimeMode && gaugeTagIds.length === 0;

    if (energyGaugeType) {
      const energyBody = (
        <EnergyChart
          chartType={energyGaugeType}
          title={title || undefined}
          width={obj.width}
          height={obj.height}
          value={numVal ?? 0}
          min={minV}
          max={maxV}
          unit={String(displayValue?.unit ?? obj.style?.unit ?? '')}
          tagIds={gaugeTagIds}
          valuesByTag={valuesByTag}
          primaryColor={String(appearance.color ?? obj.style?.color ?? obj.style?.chartPrimaryColor ?? '') || undefined}
          showLegend={false}
          allowDemoData={gaugeAllowDemo}
        />
      );
      return (
        <div
          className={`rt-obj rt-gauge rt-gauge-energy${variantCls}${animClass}`}
          style={{ ...applyBoxBorder(style, sw, stroke), background: fill, padding: 0, overflow: 'hidden', position: 'relative' }}
        >
          {energyBody}
          {!runtimeMode && gaugeTagIds.length > 0 ? (
            <div className="rt-chart-live-hint">เปิด Live preview</div>
          ) : null}
        </div>
      );
    }

    const gaugeBody = (
      <>
        {title ? <div className="rt-obj-name">{title}</div> : null}
        <SvgGauge
          value={numVal}
          min={minV}
          max={maxV}
          unit={displayValue?.unit ?? (obj.style?.unit as string | null)}
          arcColor={String(appearance.color ?? obj.style?.color ?? '#087c8b')}
          trackColor={stroke}
        />
      </>
    );
    if (usesVisualShell(appearance)) {
      return (
        <ValueDisplayShell
          appearance={appearance}
          className={`rt-obj rt-gauge rt-value-pulse${variantCls}${animClass}`}
          style={chromelessShellStyle(style)}
          autoRotate3d={obj.style?.autoRotate !== false}
        >
          {gaugeBody}
        </ValueDisplayShell>
      );
    }
    return (
      <div
        className={`rt-obj rt-gauge rt-value-pulse${variantCls}${animClass}`}
        style={{ ...applyBoxBorder(style, sw, stroke), background: fill, padding: 4 }}
      >
        {gaugeBody}
      </div>
    );
  }

  if (obj.type === 'trend') {
    const chartStyle = withChartTheme({ ...style, padding: 4 }, obj);
    if (trendSeries && trendSeries.length > 1) {
      return (
        <div className={`rt-obj rt-trend${animClass}`} style={chartStyle}>
          <MultiTrendChart
            series={trendSeries}
            title={obj.text || obj.name}
            showLegend={obj.style?.showLegend !== false}
          />
        </div>
      );
    }
    const pts = trendSeries?.[0]?.points ?? trend?.values ?? [];
    const unit = value?.unit ?? undefined;
    return (
      <div className={`rt-obj rt-trend${animClass}`} style={chartStyle}>
        <MiniTrendChart
          points={pts}
          title={obj.text || obj.name}
          unit={unit}
          showAxes={obj.style?.showAxes !== false}
          showPointMarkers={obj.style?.reportPointMarkers === true || obj.style?.reportPointMarkers === 'true' || obj.style?.reportViewMode === 'points'}
        />
      </div>
    );
  }

  if (obj.type === 'sparkline') {
    const pts = trend?.values ?? [];
    return (
      <div className={`rt-obj rt-sparkline${animClass}`} style={withChartTheme({ ...style, padding: 6 }, obj)}>
        <div className="rt-sparkline-header">
          <span className="rt-obj-name">{obj.name}</span>
          <span className="rt-sparkline-val">{fmtVal(value)}</span>
        </div>
        <SparklineChart points={pts} />
      </div>
    );
  }

  if (obj.type === 'barchart') {
    const tagIds = obj.tagIds ?? [];
    const items = tagIds.map((tid) => {
      const v = values.find((x) => x.id === tid);
      return { label: v?.name ?? tid.slice(-6), value: Number(v?.value ?? 0), unit: v?.unit ?? undefined };
    });
    return (
      <div className={`rt-obj rt-barchart${animClass}`} style={withChartTheme({ ...style, padding: 6 }, obj)}>
        <MiniBarChart items={items} title={obj.text || obj.name} />
      </div>
    );
  }

  if (obj.type === 'tagtable') {
    const rows = values.slice(0, typeof obj.style?.maxRows === 'number' ? obj.style.maxRows : 20);
    const columns = parseTagTableColumns(obj.style?.columns);
    const colLabels: Record<TagTableColumn, string> = {
      name: 'Name',
      value: 'Value',
      unit: 'Unit',
      quality: 'Quality',
      device: 'Device',
    };
    const cellValue = (row: CurrentTagValue, col: TagTableColumn) => {
      if (col === 'name') return row.name;
      if (col === 'value') return fmtVal(row);
      if (col === 'unit') return row.unit ?? '';
      if (col === 'quality') return row.quality ?? '—';
      if (col === 'device') return row.deviceName ?? row.deviceId ?? '—';
      return '';
    };
    const exportCsv = () => {
      const csv = tagTableToCsv(rows, columns);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(obj.text || obj.name || 'tags').replace(/\s+/g, '_')}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    };
    return (
      <div className={`rt-obj rt-tagtable${animClass}`} style={{ ...style, padding: 0 }}>
        <div className="rt-table-title-row">
          <div className="rt-table-title">{obj.text || obj.name || 'Tags'}</div>
          {obj.style?.exportCsv === true ? (
            <button type="button" className="rt-table-export-btn" onClick={exportCsv}>
              CSV
            </button>
          ) : null}
        </div>
        <table className="rt-table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col}>{colLabels[col]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="rt-table-empty">
                  No tags
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  {columns.map((col) => (
                    <td key={col} className={col === 'value' && row.quality !== 'good' ? 'rt-table-bad' : ''}>
                      {cellValue(row, col)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    );
  }

  if (obj.type === 'alarmtable') {
    const maxRows = typeof obj.style?.maxRows === 'number' ? obj.style.maxRows : 10;
    const deviceFilter = obj.deviceId;
    const severityFilter = String(obj.style?.alarmSeverityFilter ?? 'all').toLowerCase();
    const rows = alarms
      .filter((a) => a.status === 'active')
      .filter((a) => !deviceFilter || a.deviceId === deviceFilter)
      .filter((a) => severityFilter === 'all' || String(a.severity ?? '').toLowerCase() === severityFilter)
      .slice(0, maxRows);
    return (
      <div className={`rt-obj rt-alarmtable${animClass}`} style={{ ...style, padding: 0 }}>
        <div className="rt-table-title">{obj.text || obj.name || 'Alarms'}</div>
        <table className="rt-table rt-alarm-table">
          <thead>
            <tr>
              <th>Severity</th>
              <th>Device</th>
              <th>Message</th>
              {onAcknowledge ? <th /> : null}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={onAcknowledge ? 4 : 3} className="rt-table-empty">
                  No active alarms
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className={`sev-${row.severity ?? 'info'}`}>
                  <td>{row.severity ?? '—'}</td>
                  <td>{row.deviceName ?? row.deviceId}</td>
                  <td>{row.message ?? row.tagName}</td>
                  {onAcknowledge ? (
                    <td>
                      <button type="button" className="rt-alarm-ack-btn" onClick={() => onAcknowledge(row.id)}>
                        Ack
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    );
  }

  if (obj.type === 'alarm') {
    const isActive = alarm?.status === 'active';
    return (
      <div className={`rt-obj${animClass}${isActive ? ' alarm-active' : ''}`} style={style}>
        <div className="rt-obj-name">{obj.name}</div>
        <span className={`rt-alarm-badge ${isActive ? 'active' : 'normal'}`}>
          {isActive ? alarm?.severity ?? 'ACTIVE' : 'NORMAL'}
        </span>
      </div>
    );
  }

  if (obj.type === 'polygon') {
    const pts = parsePolygonPointString(obj.style?.polygonPoints);
    const bbox = { x: obj.x, y: obj.y, w: obj.width, h: obj.height };
    const pointsAttr = polygonSvgPoints(pts, bbox);
    const fill = String(obj.style?.fill ?? obj.style?.background ?? '#fdba74');
    const stroke = String(obj.style?.stroke ?? '#f97316');
    const sw = Number(obj.style?.strokeWidth ?? 1);
    const label = obj.text?.trim();
    return (
      <div
        className={`rt-obj rt-polygon${animClass}`}
        style={{
          ...style,
          border: 'none',
          background: 'transparent',
          padding: 0,
          overflow: 'visible',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${Math.max(1, obj.width)} ${Math.max(1, obj.height)}`}
          preserveAspectRatio="none"
          style={{ display: 'block', overflow: 'visible' }}
        >
          <polygon points={pointsAttr} fill={fill} stroke={stroke} strokeWidth={sw} />
        </svg>
        {label ? (
          <span
            className="rt-polygon-label"
            style={{
              position: 'absolute',
              color: String(obj.style?.color ?? '#142033'),
              pointerEvents: 'none',
            }}
          >
            {label}
          </span>
        ) : null}
      </div>
    );
  }

  if (obj.type === 'led' || (obj.type === 'status' && obj.style?.statusVariant !== 'badge')) {
    const appearance = resolveValueStateAppearance(obj, displayValue, valuesByTag, actionImageUrl);
    const variantCls = valueVariantClass(appearance.variant);
    const hasMedia = Boolean(appearance.imageUrl || appearance.glbUrl);
    const lampShape = String(obj.style?.lampShape ?? 'circle');
    const ledRadius = hasMedia
      ? String(obj.style?.valueBorderRadius ?? '8px')
      : lampShape === 'circle'
        ? '50%'
        : String(obj.style?.valueBorderRadius ?? (lampShape === 'square' ? '4px' : '12px'));
    return (
      <ValueDisplayShell
        appearance={appearance}
        className={`rt-obj rt-led${variantCls}${animClass}`}
        style={{ ...style, borderRadius: ledRadius, padding: 0 }}
        autoRotate3d={obj.style?.autoRotate !== false}
      />
    );
  }

  if (obj.type === 'switch') {
    const on = displayValue?.value === true || displayValue?.value === 1 || displayValue?.value === '1';
    const nextVal = resolveSwitchWriteValue(obj, value);
    return (
      <div
        className={`rt-obj rt-switch${animClass}${on ? ' rt-switch-on' : ''}${controlDisabled ? ' rt-control-disabled' : ''}${interlockBlocked ? ' rt-interlock-blocked' : ''}`}
        style={{ ...style, cursor: controlDisabled ? 'not-allowed' : 'pointer' }}
        onClick={() => {
          if (!obj.tagId || controlDisabled) return;
          if (runInteractions(obj.interactions, 'click', { fireWrite, onNavigate })) return;
          fireWrite(obj.tagId, obj.name || obj.tagId, value?.dataType || 'bool', {
            presetValue: nextVal,
            requireConfirm: obj.style?.confirmWrite === true,
          });
        }}
      >
        <span className="rt-switch-thumb" />
        <span className="rt-switch-label">{on ? 'ON' : 'OFF'}</span>
      </div>
    );
  }

  if (obj.type === 'slider') {
    const minV = typeof obj.style?.min === 'number' ? obj.style.min : Number(obj.style?.min ?? 0);
    const maxV = typeof obj.style?.max === 'number' ? obj.style.max : Number(obj.style?.max ?? 100);
    const num = numVal;
    return (
      <div className={`rt-obj rt-slider${animClass}${controlDisabled ? ' rt-control-disabled' : ''}`} style={style}>
        <input
          type="range"
          className="rt-slider-input"
          min={minV}
          max={maxV}
          step={Number(obj.style?.step ?? 1) || 1}
          value={num !== null && Number.isFinite(num) ? num : minV}
          disabled={!obj.tagId || controlDisabled}
          onChange={(e) => {
            if (!obj.tagId) return;
            const v = Number(e.target.value);
            fireWrite(obj.tagId, obj.name || obj.tagId, value?.dataType || 'uint16', {
              presetValue: v,
              requireConfirm: obj.style?.confirmWrite === true,
            });
          }}
        />
        <span className="rt-slider-readout">{num !== null && Number.isFinite(num) ? num.toFixed(1) : '--'}</span>
      </div>
    );
  }

  if (obj.type === 'kpicard') {
    const appearance = resolveValueStateAppearance(obj, displayValue, valuesByTag, actionImageUrl);
    const variantCls = valueVariantClass(appearance.variant);
    const deltaTag = String(obj.style?.deltaTagId ?? '');
    const deltaVal = deltaTag && valuesByTag ? valuesByTag.get(deltaTag) : undefined;
    const deltaPct = deltaVal?.value != null ? Number(deltaVal.value) : null;
    const dp = Number(obj.style?.decimalPlaces ?? 0);
    const transparentCard = isTransparentWidget(obj.style);
    const fill = transparentCard
      ? 'transparent'
      : (appearance.fill ?? appearance.background ?? String(obj.style?.fill ?? obj.style?.background ?? '#f0f9ff'));
    const sw = transparentCard ? 0 : Number(obj.style?.strokeWidth ?? 1);
    const stroke = String(obj.style?.stroke ?? '#7dd3fc');
    const title = obj.text?.trim();
    const card = (
      <KpiCard
        title={title || undefined}
        value={fmtVal(displayValue, dp, dp)}
        unit={displayValue?.unit ?? (String(obj.style?.unit ?? '') || undefined)}
        subtitle={displayValue?.name}
        deltaPct={deltaPct}
        valueColor={appearance.color ?? String(obj.style?.color ?? '#056473')}
        onImageBg={Boolean(appearance.imageUrl)}
      />
    );
    if (usesVisualShell(appearance)) {
      return (
        <ValueDisplayShell
          appearance={appearance}
          className={`rt-obj rt-kpicard-wrap${variantCls}${animClass}`}
          style={chromelessShellStyle(style)}
        >
          {card}
        </ValueDisplayShell>
      );
    }
    return (
      <div
        className={`rt-obj rt-kpicard-wrap${variantCls}${animClass}`}
        style={transparentCard ? chromelessShellStyle(style) : { ...applyBoxBorder(style, sw, stroke), background: fill, padding: 8 }}
      >
        {card}
      </div>
    );
  }

  if (obj.type === 'piechart') {
    const tagIds = obj.tagIds ?? [];
    const items = tagIds.map((tid) => {
      const v = valuesByTag?.get(tid) ?? values.find((x) => x.id === tid);
      return { label: v?.name ?? tid.slice(-6), value: Math.max(0, Number(v?.value ?? 0)) };
    });
    return (
      <div className={`rt-obj rt-piechart${animClass}`} style={withChartTheme({ ...style, padding: 6 }, obj)}>
        <MiniPieChart items={items} title={obj.text || obj.name} donut={obj.style?.donut === true} />
      </div>
    );
  }

  if (obj.type === 'formulavalue') {
    const appearance = resolveValueStateAppearance(obj, displayValue, valuesByTag, actionImageUrl);
    const variantCls = valueVariantClass(appearance.variant);
    const tagIds = obj.tagIds ?? (obj.tagId ? [obj.tagId] : []);
    const formula = String(obj.style?.formula ?? 'A');
    const dp = Number(obj.style?.decimalPlaces ?? 2);
    let display = '--';
    if (valuesByTag && tagIds.length > 0) {
      const result = evaluateFormula(formula, tagIds, valuesByTag);
      display = result != null ? result.toFixed(dp) : '--';
    } else if (displayValue?.value != null) {
      display = fmtVal(displayValue, dp, dp);
    }
    const fill = appearance.fill ?? appearance.background ?? String(obj.style?.fill ?? obj.style?.background ?? 'transparent');
    const sw = Number(obj.style?.strokeWidth ?? 1);
    const stroke = String(obj.style?.stroke ?? '#9fc4cc');
    const label = (appearance.text ?? obj.text)?.trim();
    const body = (
      <>
        {label ? <div className="rt-obj-name">{label}</div> : null}
        <div className="rt-obj-value" style={{ color: String(appearance.color ?? obj.style?.color ?? '#056473') }}>{display}</div>
        <div className="rt-obj-unit">{String(obj.style?.unit ?? '')}</div>
      </>
    );
    if (usesVisualShell(appearance)) {
      return (
        <ValueDisplayShell
          appearance={appearance}
          className={`rt-obj rt-formulavalue rt-value-pulse${variantCls}${animClass}`}
          style={chromelessShellStyle(style)}
        >
          {body}
        </ValueDisplayShell>
      );
    }
    return (
      <div
        className={`rt-obj rt-formulavalue rt-value-pulse${variantCls}${animClass}`}
        style={{ ...applyBoxBorder(style, sw, stroke), background: fill, padding: 6 }}
      >
        {body}
      </div>
    );
  }

  if (obj.type === 'statusbadge' || (obj.type === 'status' && obj.style?.statusVariant === 'badge')) {
    const appearance = resolveValueStateAppearance(obj, displayValue, valuesByTag, actionImageUrl);
    const variantCls = valueVariantClass(appearance.variant);
    const badge = resolveStatusBadge(numVal, alarm, obj.style);
    const label = appearance.text ?? badge.label;
    const chipColor = appearance.background ?? appearance.fill ?? badge.color;
    const chipStyle: React.CSSProperties = appearance.imageUrl && appearance.displayMode === 'classic'
      ? {
        backgroundImage: `url("${appearance.imageUrl}")`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        color: appearance.color ?? '#fff',
      }
      : { background: chipColor, color: appearance.color ?? '#fff' };
    const chip = (
      <span className="rt-status-badge-chip" style={chipStyle}>
        {label}
      </span>
    );
    if (usesVisualShell(appearance)) {
      return (
        <ValueDisplayShell
          appearance={appearance}
          className={`rt-obj rt-statusbadge${variantCls}${animClass}`}
          style={{ ...style, background: 'transparent', border: 'none', padding: 4, overflow: 'hidden' }}
          autoRotate3d={obj.style?.autoRotate !== false}
        >
          <span className="rt-status-badge-overlay">{label}</span>
        </ValueDisplayShell>
      );
    }
    return (
      <div className={`rt-obj rt-statusbadge${variantCls}${animClass}`} style={{ ...style, background: 'transparent', border: 'none', padding: 4, overflow: 'hidden' }}>
        {chip}
      </div>
    );
  }

  if (obj.type === 'group') {
    const members = parseMemberIds(obj.style?.memberIds);
    const composite = obj.style?.composite === true;
    const bg = obj.style?.backgroundImage as string | undefined;
    const borderStroke = composite ? '#6366f1' : '#94a3b8';
    const groupStyle: React.CSSProperties = composite
      ? {
          ...applyBoxBorder(style, 2, borderStroke),
          background: bg ? `url("${bg}") center/contain no-repeat` : 'rgba(148,163,184,0.08)',
        }
      : {
          ...style,
          border: 'none',
          background: 'transparent',
          boxShadow: 'none',
        };
    return (
      <div
        className={`rt-obj rt-group${composite ? ' rt-composite' : ''}${animClass}`}
        style={{
          ...groupStyle,
          pointerEvents: composite ? 'auto' : 'none',
          cursor: composite && obj.navigateTo ? 'pointer' : undefined,
        }}
        title={`${composite ? 'Composite' : 'Group'}: ${members.length} members`}
        onClick={() => {
          if (composite && obj.navigateTo && onNavigate) onNavigate(obj.navigateTo);
        }}
      >
        <span className="rt-group-label">{obj.text || obj.name}</span>
        <span className="rt-group-count">{members.length} items{composite ? ' · composite' : ''}</span>
      </div>
    );
  }

  if (obj.type === 'multistate') {
    const appearance = resolveValueStateAppearance(obj, displayValue, valuesByTag, actionImageUrl);
    const variantCls = valueVariantClass(appearance.variant);
    const states = String(obj.style?.states ?? 'Stopped,Running,Fault')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const idx = Math.max(0, Math.min(states.length - 1, Math.round(Number(displayValue?.value ?? 0))));
    const fill = appearance.fill ?? appearance.background ?? String(obj.style?.fill ?? obj.style?.background ?? '#eef2ff');
    const sw = Number(obj.style?.strokeWidth ?? 1);
    const stroke = String(obj.style?.stroke ?? '#6366f1');
    const label = appearance.text ?? states[idx] ?? '--';
    const labelStyle: React.CSSProperties = {
      color: String(appearance.color ?? obj.style?.color ?? '#312e81'),
    };
    const boxStyle = {
      ...applyBoxBorder(style, sw, stroke),
      padding: 8,
      overflow: 'hidden' as const,
      ...(appearance.imageUrl && appearance.displayMode === 'classic'
        ? {
          backgroundImage: `url("${appearance.imageUrl}")`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }
        : { background: fill }),
    };
    if (usesVisualShell(appearance)) {
      return (
        <ValueDisplayShell
          appearance={appearance}
          className={`rt-obj rt-multistate${variantCls}${animClass}`}
          style={boxStyle}
          autoRotate3d={obj.style?.autoRotate !== false}
        >
          <span className="rt-multistate-label" style={labelStyle}>{label}</span>
        </ValueDisplayShell>
      );
    }
    return (
      <div className={`rt-obj rt-multistate${variantCls}${animClass}`} style={boxStyle}>
        <span className="rt-multistate-label" style={labelStyle}>{label}</span>
      </div>
    );
  }

  if (obj.type === 'navbutton') {
    return (
      <div
        className={`rt-obj rt-navbutton${animClass}`}
        style={{ ...style, cursor: obj.navigateTo ? 'pointer' : 'default' }}
        onClick={() => {
          if (obj.navigateTo && onNavigate) onNavigate(obj.navigateTo);
        }}
      >
        {obj.text || obj.name}
      </div>
    );
  }

  if (obj.type === 'hotspot') {
    const action = String(obj.style?.hotspotAction ?? 'tooltip');
    const [open, setOpen] = React.useState(false);
    return (
      <div
        className={`rt-obj rt-hotspot${animClass}${open ? ' rt-hotspot-open' : ''}`}
        style={{ ...style, background: 'transparent', border: '2px dashed rgba(8,124,139,.45)', cursor: 'pointer' }}
        onClick={() => {
          if (action === 'navigate' && obj.navigateTo && onNavigate) {
            onNavigate(obj.navigateTo);
            return;
          }
          setOpen((v) => !v);
        }}
        title={obj.name}
      >
        {open && (
          <div className="rt-hotspot-popup">
            <strong>{obj.name}</strong>
            <div>{fmtVal(value)} {value?.unit ?? ''}</div>
          </div>
        )}
      </div>
    );
  }

  if (obj.type === 'zone3d') {
    const label = String(obj.style?.zoneLabel ?? obj.text ?? obj.name);
    const chromeless = isChromelessRenderMode(resolveRenderMode(obj));
    const extrudeH = Number(obj.style?.zoneExtrudeHeight ?? obj.style?.wallHeight3d ?? 0);
    const fillTag = String(obj.style?.zoneFillTagId ?? obj.tagId ?? '');
    const fillVal = fillTag && valuesByTag ? valuesByTag.get(fillTag)?.value : undefined;
    const fillOn = fillVal === true || fillVal === 1 || fillVal === '1' || (fillVal != null && Number(fillVal) > 0);
    const baseFill = chromeless ? 'transparent' : 'rgba(99,102,241,0.14)';
    const activeFill = fillOn ? 'rgba(34,197,94,0.22)' : baseFill;
    return (
      <div
        className={`rt-obj rt-zone3d rt-render-scene${animClass}${chromeless ? ' rt-zone3d-chromeless' : ''}${extrudeH > 0 ? ' rt-zone3d-extrude' : ''}`}
        style={{
          ...style,
          background: chromeless ? 'transparent' : activeFill,
          border: chromeless ? 'none' : `2px solid ${fillOn ? 'rgba(34,197,94,0.55)' : 'rgba(99,102,241,0.5)'}`,
          cursor: obj.navigateTo ? 'pointer' : 'default',
          boxShadow: extrudeH > 0 && !chromeless ? `inset 0 -${Math.min(24, extrudeH / 4)}px 0 rgba(99,102,241,0.15)` : undefined,
        }}
        onClick={() => {
          if (obj.navigateTo && onNavigate) onNavigate(obj.navigateTo);
        }}
        title={obj.navigateTo ? `${label} → open graphic` : label}
      >
        <span className="rt-zone3d-label">{label}</span>
        {obj.navigateTo ? <span className="rt-zone3d-hint">Click to enter</span> : null}
      </div>
    );
  }

  if (obj.type === 'tabbar') {
    const raw = String(obj.style?.tabs ?? '');
    const tabs = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((part) => {
        const [label, gid] = part.split(':').map((x) => x.trim());
        return { label: label || gid, graphicId: gid || '' };
      })
      .filter((t) => t.graphicId);
    return (
      <div className={`rt-obj rt-tabbar${animClass}`} style={{ ...style, padding: 4 }}>
        {tabs.map((tab) => (
          <button
            key={tab.graphicId}
            type="button"
            className="rt-tabbar-btn"
            onClick={() => onNavigate?.(tab.graphicId)}
          >
            {tab.label}
          </button>
        ))}
      </div>
    );
  }

  if (obj.type === 'echart') {
    const chartType = resolveChartType(String(obj.style?.echartType ?? 'line'));
    const tagIds = obj.tagIds ?? (obj.tagId ? [obj.tagId] : []);
    const useTagValues = tagIds.length > 0 && valuesByTag;

    // Build items from live tag values for bar/pie/donut
    const liveItems = useTagValues
      ? tagIds.map(tid => {
          const tv = valuesByTag!.get(tid);
          return { label: tv?.name ?? tid.slice(-8), value: tv?.value != null ? Number(tv.value) : 0 };
        })
      : [];

    // Build series from trend data for line/area charts
    const trendSeriesForEChart = trendSeries ?? (trend
      ? [{ label: obj.name || 'Value', points: trend.values ?? [], color: ECHART_COLORS[0] }]
      : []);
    const echartAllowDemo = !runtimeMode && tagIds.length === 0;
    const hasTrendPts = trendSeriesForEChart.some((s) => s.points.length > 0);
    const hasLiveItems = liveItems.some((i) => Number.isFinite(i.value));

    return (
      <div
        className={`rt-obj rt-echart${animClass}`}
        style={withChartTheme({
          ...style,
          padding: 0,
          overflow: 'hidden',
          background: String(obj.style?.background ?? obj.style?.fill ?? 'rgba(255,255,255,0.95)'),
          position: 'relative',
        }, obj)}
      >
        <EChartsWidget
          chartType={chartType}
          title={obj.text || obj.name}
          width={obj.width}
          height={obj.height}
          series={trendSeriesForEChart}
          items={liveItems}
          value={useTagValues && tagIds[0] ? Number(valuesByTag!.get(tagIds[0])?.value ?? 0) : 0}
          min={typeof obj.style?.min === 'number' ? obj.style.min : Number(obj.style?.min ?? 0)}
          max={typeof obj.style?.max === 'number' ? obj.style.max : Number(obj.style?.max ?? 100)}
          unit={String(obj.style?.unit ?? value?.unit ?? '')}
          tagIds={tagIds}
          valuesByTag={valuesByTag}
          showLegend={obj.style?.showLegend !== false}
          primaryColor={String(obj.style?.chartPrimaryColor ?? '') || undefined}
          allowDemoData={echartAllowDemo}
        />
        {!runtimeMode && tagIds.length > 0 ? (
          <div className="rt-chart-live-hint">เปิด Live preview</div>
        ) : null}
        {runtimeMode && tagIds.length > 0 && !hasTrendPts && !hasLiveItems && (chartType === 'line' || chartType === 'area') ? (
          <div className="rt-chart-empty-overlay">
            <span className="rt-chart-no-data">รอข้อมูล trend…</span>
          </div>
        ) : null}
      </div>
    );
  }

  // ── Input Field (writable text input)
  if (obj.type === 'inputfield') {
    return (
      <div className={`rt-obj rt-inputfield${animClass}${!canWrite ? ' rt-control-disabled' : ''}`} style={{ ...style, padding: 0 }}>
        <input
          type="text"
          className="rt-input-native"
          defaultValue={value?.value != null ? String(value.value) : ''}
          placeholder={obj.text || obj.name}
          disabled={!obj.tagId || !canWrite}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && obj.tagId) {
              fireWrite(obj.tagId, obj.name || obj.tagId, value?.dataType || 'string', {
                presetValue: (e.target as HTMLInputElement).value,
                requireConfirm: obj.style?.confirmWrite === true,
              });
            }
          }}
        />
      </div>
    );
  }

  // ── Dropdown Select
  if (obj.type === 'dropdown') {
    const raw = String(obj.style?.options ?? '');
    const opts = raw.split(',').map((s) => s.trim()).filter(Boolean);
    const current = value?.value != null ? String(value.value) : '';
    return (
      <div className={`rt-obj rt-dropdown${animClass}${!canWrite ? ' rt-control-disabled' : ''}`} style={{ ...style, padding: 0 }}>
        <select
          className="rt-dropdown-native"
          value={current}
          disabled={!obj.tagId || !canWrite}
          onChange={(e) => {
            if (!obj.tagId) return;
            fireWrite(obj.tagId, obj.name || obj.tagId, value?.dataType || 'string', {
              presetValue: e.target.value,
              requireConfirm: obj.style?.confirmWrite === true,
            });
          }}
        >
          {opts.length === 0 && <option value="">{obj.text || 'Choose...'}</option>}
          {opts.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
    );
  }

  // ── Video Player (file / MJPEG / HLS URL)
  if (obj.type === 'video') {
    const srcRaw = String(obj.style?.videoUrl ?? obj.text ?? '');
    const src = resolveMediaSrc(srcRaw, resolveAssetRef) ?? srcRaw;
    const streamType = String(obj.style?.streamType ?? 'file');
    const fit = resolveObjectFit(obj.style?.videoObjectFit ?? obj.style?.objectFit);
    const freeFrame = isFreeMediaFrame(obj.style as Record<string, unknown> | undefined);
    const frameStyle: React.CSSProperties = freeFrame
      ? { ...style, padding: 0, overflow: 'hidden', background: 'transparent', border: 'none', boxShadow: 'none' }
      : { ...style, padding: 0, overflow: 'hidden' };
    const mediaStyle: React.CSSProperties = { width: '100%', height: '100%', objectFit: fit };
    const autoplay = obj.style?.videoAutoplay !== false;
    const muted = obj.style?.videoMuted !== false;
    const loop = obj.style?.videoLoop !== false;
    const controls = obj.style?.videoControls === true;
    return (
      <div className={`rt-obj rt-video${freeFrame ? ' rt-video-free' : ''}${animClass}`} style={frameStyle}>
        {src ? (
          streamType === 'rtsp' ? (
            <RtspVideoPlayer rtspUrl={src} engineApiBase={engineApiBase} alt={obj.name ?? 'video'} />
          ) : streamType === 'mjpeg' ? (
            <img src={src} alt={obj.name} style={mediaStyle} referrerPolicy="no-referrer" />
          ) : streamType === 'hls' ? (
            <HlsVideoPlayer src={src} alt={obj.name ?? 'video'} />
          ) : (
            <video
              src={src}
              style={mediaStyle}
              autoPlay={autoplay}
              muted={muted}
              loop={loop}
              controls={controls}
              playsInline
            />
          )
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: freeFrame ? 'transparent' : '#0f172a', color: '#64748b', fontSize: 11 }}>
            ▶ ยังไม่มีวิดีโอ
          </div>
        )}
      </div>
    );
  }

  // ── iFrame Embed
  if (obj.type === 'iframe') {
    const src = String(obj.style?.iframeUrl ?? obj.text ?? '');
    return (
      <div className={`rt-obj rt-iframe${animClass}`} style={{ ...style, padding: 0, overflow: 'hidden' }}>
        {src && src.startsWith('http') ? (
          <iframe src={src} style={{ width: '100%', height: '100%', border: 'none' }} title={obj.name} loading="lazy" sandbox="allow-scripts allow-same-origin" />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9', color: '#64748b', fontSize: 11 }}>
            🌐 iFrame — ใส่ URL ในProperties
          </div>
        )}
      </div>
    );
  }

  if (obj.type === 'clock') {
    return <ClockObject obj={obj} style={style} animClass={animClass} engineApiBase={engineApiBase} />;
  }

  if (obj.type === 'value') {
    const appearance = resolveValueStateAppearance(obj, displayValue, valuesByTag, actionImageUrl);
    const variantCls = valueVariantClass(appearance.variant);
    const clearBg = isTransparentWidget(obj.style);
    const dp = Number(obj.style?.decimalPlaces ?? 2);
    const unit = String(displayValue?.unit ?? obj.style?.unit ?? '');
    const fill = clearBg
      ? 'transparent'
      : appearance.fill ?? appearance.background ?? String(obj.style?.fill ?? obj.style?.background ?? 'rgba(255,255,255,.95)');
    const sw = clearBg ? 0 : Number(obj.style?.strokeWidth ?? 1);
    const stroke = clearBg ? 'transparent' : String(obj.style?.stroke ?? obj.style?.borderColor ?? '#9fc4cc');
    const label = (appearance.text ?? obj.text)?.trim();
    const valueBody = (
      <>
        {label ? <div className="rt-obj-name">{label}</div> : null}
        <div className="rt-obj-value" style={{ color: String(appearance.color ?? obj.style?.color ?? '#056473') }}>
          {fmtVal(displayValue, dp, dp)}
        </div>
        {unit ? <div className="rt-obj-unit">{unit}</div> : null}
      </>
    );
    const clearCls = clearBg ? ' rt-value-clear' : '';
    if (usesVisualShell(appearance)) {
      return (
        <ValueDisplayShell
          appearance={appearance}
          className={`rt-obj rt-value rt-value-pulse${clearCls}${variantCls}${animClass}`}
          style={chromelessShellStyle(style)}
          autoRotate3d={obj.style?.autoRotate !== false}
        >
          {valueBody}
        </ValueDisplayShell>
      );
    }
    return (
      <div
        className={`rt-obj rt-value rt-value-pulse${clearCls}${variantCls}${animClass}`}
        style={{
          ...(clearBg
            ? { ...style, background: 'transparent', border: 'none', boxShadow: 'none', padding: 2 }
            : { ...applyBoxBorder(style, sw, stroke), background: fill, padding: 6 }),
        }}
      >
        {valueBody}
      </div>
    );
  }


  return (
    <div className={`rt-obj rt-value-pulse${animClass}`} style={style}>
      <div className="rt-obj-name">{obj.name}</div>
      <div className="rt-obj-value">{fmtVal(displayValue)}</div>
      <div className="rt-obj-unit">{displayValue?.unit ?? String(obj.style?.unit ?? '')}</div>
    </div>
  );
}
