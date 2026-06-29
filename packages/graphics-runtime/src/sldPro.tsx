import React from 'react';
import { parsePorts } from './ports';
import { elecSymbolState } from './sld';
import type { CurrentTagValue, NormalizedGraphicObject } from './types';

function fmtVal(v: CurrentTagValue | undefined, dp = 2) {
  if (!v || v.value === null || v.value === undefined) return '--';
  const places = Number.isFinite(v.decimalPlaces) ? Number(v.decimalPlaces) : dp;
  return `${Number(v.value).toFixed(places)}${v.unit ? ` ${v.unit}` : ''}`;
}

function DoorSymbol({ state }: { state: number }) {
  const open = state === 0;
  return (
    <g>
      <rect x="10" y="8" width="44" height="48" fill="none" stroke="currentColor" strokeWidth="2" rx="2" />
      {open ? (
        <path d="M10 8 L54 28 L54 56 L10 56 Z" fill="rgba(34,197,94,0.15)" stroke="#22c55e" strokeWidth="2" />
      ) : (
        <line x1="32" y1="56" x2="32" y2="32" stroke="currentColor" strokeWidth="2" />
      )}
    </g>
  );
}

function LampSymbol({ state }: { state: number }) {
  const on = state >= 1;
  return (
    <g>
      <circle cx="32" cy="28" r="14" fill={on ? '#facc15' : '#e2e8f0'} stroke={on ? '#f59e0b' : '#94a3b8'} strokeWidth="2" />
      <rect x="26" y="42" width="12" height="10" fill="#64748b" rx="1" />
      <line x1="32" y1="52" x2="32" y2="58" stroke="#64748b" strokeWidth="3" />
      {on && <circle cx="32" cy="28" r="20" fill="none" stroke="#facc15" strokeWidth="1" opacity="0.4" />}
    </g>
  );
}

export function CustomSymbolSvg({ svgContent, width, height }: { svgContent: string; width: number; height: number }) {
  if (svgContent.startsWith('data:image/svg')) {
    return <img src={svgContent} alt="" width={width} height={height} style={{ display: 'block', objectFit: 'contain' }} />;
  }
  const inner = svgContent.includes('<svg') ? svgContent : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${svgContent}</svg>`;
  return (
    <div
      className="rt-custom-symbol"
      style={{ width, height }}
      dangerouslySetInnerHTML={{ __html: inner }}
    />
  );
}

export function BusSectionObject({
  obj,
  animClass = '',
}: {
  obj: NormalizedGraphicObject;
  animClass?: string;
}) {
  const w = obj.width;
  const h = obj.height;
  const barH = Math.max(8, Math.round(h * 0.35));
  const y = (h - barH) / 2;
  const ports = parsePorts(obj.style?.ports);
  const stroke = String(obj.style?.stroke ?? '#173047');

  return (
    <div
      className={`rt-obj rt-bussection${animClass}`}
      style={{
        left: obj.x,
        top: obj.y,
        width: w,
        height: h,
        background: 'transparent',
        border: 'none',
        zIndex: obj.layer ?? 1,
      }}
      title={obj.text || obj.name}
    >
      <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} style={{ display: 'block' }}>
        <rect x={4} y={y} width={w - 8} height={barH} fill={stroke} rx={2} />
        {ports.map((p) => (
          <circle
            key={p.id}
            cx={p.x * w}
            cy={p.y * h}
            r={4}
            fill="#fff"
            stroke="#0ea5e9"
            strokeWidth="2"
          />
        ))}
      </svg>
      {(obj.text || obj.name) && <span className="rt-bussection-label">{obj.text || obj.name}</span>}
    </div>
  );
}

export function FeedLabelObject({
  obj,
  value,
  flowValue,
  animClass = '',
}: {
  obj: NormalizedGraphicObject;
  value?: CurrentTagValue;
  flowValue?: CurrentTagValue;
  animClass?: string;
}) {
  const live = flowValue ?? value;
  const prefix = String(obj.style?.labelPrefix ?? obj.text ?? obj.name ?? 'Feed');
  const showUnit = obj.style?.showUnit !== false;

  return (
    <div
      className={`rt-obj rt-feedlabel${animClass}`}
      style={{
        left: obj.x,
        top: obj.y,
        width: obj.width,
        height: obj.height,
        background: String(obj.style?.background ?? 'rgba(255,255,255,0.92)'),
        border: `1px solid ${String(obj.style?.stroke ?? '#cbd5e1')}`,
        borderRadius: 6,
        padding: '4px 8px',
        fontSize: 11,
        fontWeight: 700,
        zIndex: obj.layer ?? 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 2,
      }}
    >
      <span className="rt-feedlabel-name">{prefix}</span>
      <span className="rt-feedlabel-value" style={{ color: String(obj.style?.flowColor ?? '#0ea5e9') }}>
        {fmtVal(live, Number(obj.style?.decimalPlaces ?? 2))}
        {!showUnit && live?.unit ? '' : null}
      </span>
    </div>
  );
}

export function Zone2dObject({
  obj,
  value,
  onNavigate,
  animClass = '',
}: {
  obj: NormalizedGraphicObject;
  value?: CurrentTagValue;
  onNavigate?: (graphicId: string) => void;
  animClass?: string;
}) {
  const alarm = value?.value != null && Number(value.value) > Number(obj.style?.alarmThreshold ?? 0);
  const floor = obj.style?.floorLevel != null ? Number(obj.style.floorLevel) : null;
  const clickable = Boolean(obj.navigateTo);

  return (
    <div
      className={`rt-obj rt-zone2d${animClass}${alarm ? ' rt-zone2d-alarm' : ''}`}
      style={{
        left: obj.x,
        top: obj.y,
        width: obj.width,
        height: obj.height,
        background: alarm
          ? String(obj.style?.alarmFill ?? 'rgba(239,68,68,0.25)')
          : String(obj.style?.fill ?? 'rgba(99,102,241,0.12)'),
        border: `2px ${clickable ? 'solid' : 'dashed'} ${alarm ? '#ef4444' : String(obj.style?.stroke ?? '#6366f1')}`,
        borderRadius: 8,
        cursor: clickable ? 'pointer' : 'default',
        zIndex: obj.layer ?? 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 2,
      }}
      onClick={() => {
        if (obj.navigateTo && onNavigate) onNavigate(obj.navigateTo);
      }}
      title={obj.text || obj.name}
    >
      <span className="rt-zone2d-label">{String(obj.style?.zoneLabel ?? obj.text ?? obj.name)}</span>
      {floor != null && !Number.isNaN(floor) && <span className="rt-zone2d-floor">Floor {floor}</span>}
    </div>
  );
}

export function EquipmentSymbolObject({
  obj,
  value,
  valuesByTag,
  onNavigate,
  animClass = '',
  renderSymbol,
}: {
  obj: NormalizedGraphicObject;
  value?: CurrentTagValue;
  valuesByTag?: Map<string, CurrentTagValue>;
  onNavigate?: (graphicId: string) => void;
  animClass?: string;
  renderSymbol: React.ReactNode;
}) {
  const [tipOpen, setTipOpen] = React.useState(false);
  const symbolId = String(obj.style?.symbolId ?? 'breaker');
  const states = String(obj.style?.states ?? 'open,closed,trip').split(',').map((s) => s.trim());
  const state = elecSymbolState(value?.value, states.length);
  const trip = symbolId === 'breaker' && state >= 2;
  const drillDown = String(obj.style?.drillDown ?? '');
  const tooltipTagIds = String(obj.style?.tooltipTagIds ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const tooltipLines = tooltipTagIds.map((tid) => {
    const tv = valuesByTag?.get(tid);
    return tv ? `${tv.name}: ${fmtVal(tv)}` : null;
  }).filter(Boolean);

  return (
    <div
      className={`rt-obj rt-elecsymbol${animClass}${trip ? ' rt-elecsymbol-trip' : ''}`}
      style={{
        left: obj.x,
        top: obj.y,
        width: obj.width,
        height: obj.height,
        background: 'transparent',
        border: '1px dashed #cbd5e1',
        borderRadius: 8,
        zIndex: obj.layer ?? 1,
        cursor: drillDown || obj.navigateTo ? 'pointer' : 'default',
      }}
      onMouseEnter={() => { if (tooltipLines.length) setTipOpen(true); }}
      onMouseLeave={() => setTipOpen(false)}
      onClick={() => {
        if (drillDown === 'device' && obj.deviceId && onNavigate) {
          onNavigate(`device:${obj.deviceId}`);
          return;
        }
        if (obj.navigateTo && onNavigate) onNavigate(obj.navigateTo);
      }}
    >
      {renderSymbol}
      {tipOpen && tooltipLines.length > 0 && (
        <div className="rt-equipment-tooltip">
          <strong>{obj.text || obj.name}</strong>
          {tooltipLines.map((line) => <div key={line}>{line}</div>)}
        </div>
      )}
    </div>
  );
}

export { DoorSymbol, LampSymbol };
