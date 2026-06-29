import React from 'react';
import {
  computeFlowState,
  elecSymbolState,
  formatFeedLabel,
  isFlowOverload,
  parsePathPoints,
  pathMidpoint,
  pathPointsToPolyline,
} from './sld';
import { BusSectionObject, FeedLabelObject, Zone2dObject, EquipmentSymbolObject } from './sldPro';
import type { CurrentTagValue, NormalizedGraphicObject } from './types';

export { BusSectionObject, FeedLabelObject, Zone2dObject, EquipmentSymbolObject };

export function FlowPathSvg({
  obj,
  flowValue,
  enableValue,
  particleMode = false,
}: {
  obj: NormalizedGraphicObject;
  flowValue?: CurrentTagValue;
  enableValue?: CurrentTagValue;
  particleMode?: boolean;
}) {
  const w = obj.width;
  const h = obj.height;
  const points = parsePathPoints(obj.style?.pathPoints as string | undefined, w, h);
  const poly = pathPointsToPolyline(points);
  const strokeW = Number(obj.style?.strokeWidth ?? 4);
  const idleColor = String(obj.style?.idleColor ?? '#64748b');
  const flowColor = String(obj.style?.flowColor ?? '#22d3ee');
  const glow = obj.style?.flowGlow !== false;
  const speed = Number(obj.style?.flowSpeed ?? 1);
  const threshold = Number(obj.style?.flowThreshold ?? 0.5);
  const requireEnable = obj.style?.requireEnable !== false && !!(obj.binding?.enableTagId ?? obj.style?.enableTagId);

  const { flowing, reverse, magnitude } = computeFlowState({
    flowRaw: flowValue?.value,
    enableRaw: enableValue?.value,
    threshold,
    requireEnable,
  });

  const alarmHigh = obj.style?.flowAlarmHigh ?? obj.style?.alarmHigh;
  const overload = isFlowOverload(magnitude, alarmHigh);
  const activeFlowColor = overload ? String(obj.style?.alarmColor ?? '#ef4444') : flowColor;
  const showGlow = glow || overload;

  const dashLen = 14;
  const animDuration = Math.max(0.4, 1.6 / speed);
  const showFeedLabel = obj.style?.showFeedLabel === true;
  const feedLabel = showFeedLabel
    ? formatFeedLabel(
        String(obj.style?.labelPrefix ?? obj.text ?? obj.name ?? ''),
        flowValue,
        magnitude,
      )
    : '';
  const labelPt = showFeedLabel ? pathMidpoint(points) : null;

  return (
    <svg
      className={`rt-flowpath-svg${overload ? ' rt-flow-overload' : ''}`}
      viewBox={`0 0 ${w} ${h}`}
      width={w}
      height={h}
      style={{ overflow: 'visible', display: 'block' }}
    >
      <polyline
        points={poly}
        fill="none"
        stroke={idleColor}
        strokeWidth={strokeW}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={flowing ? 0.35 : 0.85}
      />
      {flowing && (
        <>
          {showGlow && (
            <polyline
              points={poly}
              fill="none"
              stroke={activeFlowColor}
              strokeWidth={strokeW + (overload ? 8 : 4)}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={overload ? 0.45 : 0.25}
              filter="blur(2px)"
            />
          )}
          <polyline
            className={`rt-flow-anim${reverse ? ' rt-flow-reverse' : ''}${overload ? ' rt-flow-overload-anim' : ''}`}
            points={poly}
            fill="none"
            stroke={activeFlowColor}
            strokeWidth={strokeW}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={`${dashLen} ${dashLen}`}
            style={{ animationDuration: `${animDuration}s` }}
          />
          {particleMode && points.length >= 2 ? (
            <>
              {[0, 0.35, 0.7].map((delay) => (
                <circle
                  key={`particle-${delay}`}
                  r={Math.max(2, strokeW * 0.45)}
                  fill={activeFlowColor}
                  className="rt-cable-particle"
                  style={{ animationDuration: `${animDuration}s`, animationDelay: `${delay * animDuration}s` }}
                >
                  <animateMotion
                    dur={`${animDuration}s`}
                    repeatCount="indefinite"
                    begin={`${delay * animDuration}s`}
                    path={`M ${points[0].x} ${points[0].y} ${points.slice(1).map((p) => `L ${p.x} ${p.y}`).join(' ')}`}
                  />
                </circle>
              ))}
            </>
          ) : null}
        </>
      )}
      {labelPt && feedLabel ? (
        <g className="rt-wire-feed-label">
          <rect
            x={labelPt.x - feedLabel.length * 3.2}
            y={labelPt.y - 10}
            width={feedLabel.length * 6.4}
            height={18}
            rx={4}
            fill="rgba(15,23,42,0.82)"
          />
          <text
            x={labelPt.x}
            y={labelPt.y + 4}
            textAnchor="middle"
            fill="#f8fafc"
            fontSize={10}
            fontWeight={700}
          >
            {feedLabel}
          </text>
        </g>
      ) : null}
    </svg>
  );
}

function PipePathSvg({
  obj,
  flowValue,
  enableValue,
}: {
  obj: NormalizedGraphicObject;
  flowValue?: CurrentTagValue;
  enableValue?: CurrentTagValue;
}) {
  const w = obj.width;
  const h = obj.height;
  const points = parsePathPoints(obj.style?.pathPoints as string | undefined, w, h);
  const poly = pathPointsToPolyline(points);
  const pipeW = Number(obj.style?.pipeWidth ?? obj.style?.strokeWidth ?? 14);
  const wallColor = String(obj.style?.pipeWall ?? '#0e7490');
  const fillColor = String(obj.style?.fill ?? obj.style?.flowColor ?? '#06b6d4');
  const idleColor = String(obj.style?.idleColor ?? '#94a3b8');
  const flowColor = String(obj.style?.flowColor ?? fillColor);
  const speed = Number(obj.style?.flowSpeed ?? 1);
  const threshold = Number(obj.style?.flowThreshold ?? 0.5);
  const requireEnable = obj.style?.requireEnable !== false && !!(obj.binding?.enableTagId ?? obj.style?.enableTagId);

  const { flowing, reverse } = computeFlowState({
    flowRaw: flowValue?.value,
    enableRaw: enableValue?.value,
    threshold,
    requireEnable,
  });

  const activeColor = flowing ? flowColor : idleColor;
  const animDuration = Math.max(0.5, 1.8 / speed);
  const dashLen = Math.max(10, pipeW);

  return (
    <svg
      className={`rt-pipe-svg${flowing ? ' rt-pipe-flow' : ''}`}
      viewBox={`0 0 ${w} ${h}`}
      width={w}
      height={h}
      style={{ overflow: 'visible', display: 'block' }}
    >
      <polyline
        points={poly}
        fill="none"
        stroke={wallColor}
        strokeWidth={pipeW + 4}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.9}
      />
      <polyline
        points={poly}
        fill="none"
        stroke={activeColor}
        strokeWidth={pipeW}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {flowing && (
        <polyline
          className={`rt-flow-anim${reverse ? ' rt-flow-reverse' : ''}`}
          points={poly}
          fill="none"
          stroke="#ffffff"
          strokeWidth={Math.max(2, pipeW * 0.25)}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={`${dashLen} ${dashLen}`}
          opacity={0.55}
          style={{ animationDuration: `${animDuration}s` }}
        />
      )}
    </svg>
  );
}

function BreakerSymbol({ state }: { state: number }) {
  const open = state === 0;
  const trip = state >= 2;
  return (
    <g>
      <line x1="4" y1="32" x2="18" y2="32" stroke="currentColor" strokeWidth="3" />
      <line x1="46" y1="32" x2="60" y2="32" stroke="currentColor" strokeWidth="3" />
      {trip ? (
        <text x="32" y="38" textAnchor="middle" fontSize="22" fontWeight="900" fill="#ef4444">
          ✕
        </text>
      ) : open ? (
        <>
          <line x1="18" y1="32" x2="28" y2="18" stroke="currentColor" strokeWidth="3" />
          <circle cx="32" cy="32" r="5" fill="none" stroke="currentColor" strokeWidth="2" />
        </>
      ) : (
        <line x1="18" y1="32" x2="46" y2="32" stroke="#22c55e" strokeWidth="4" />
      )}
    </g>
  );
}

function DisconnectSymbol({ state }: { state: number }) {
  const open = state === 0;
  return (
    <g>
      <line x1="4" y1="32" x2="22" y2="32" stroke="currentColor" strokeWidth="3" />
      <line x1="42" y1="32" x2="60" y2="32" stroke="currentColor" strokeWidth="3" />
      {open ? (
        <line x1="22" y1="32" x2="38" y2="16" stroke="currentColor" strokeWidth="3" />
      ) : (
        <line x1="22" y1="32" x2="42" y2="32" stroke="#22c55e" strokeWidth="4" />
      )}
    </g>
  );
}

function TransformerSymbol() {
  return (
    <g>
      <circle cx="24" cy="32" r="14" fill="none" stroke="currentColor" strokeWidth="2.5" />
      <circle cx="40" cy="32" r="14" fill="none" stroke="currentColor" strokeWidth="2.5" />
    </g>
  );
}

function BusSymbol() {
  return <rect x="4" y="24" width="56" height="16" rx="2" fill="currentColor" opacity={0.85} />;
}

function MeterSymbol({ state }: { state: number }) {
  const active = state > 0;
  return (
    <g>
      <circle
        cx="32"
        cy="32"
        r="22"
        fill={active ? '#ecfeff' : '#f8fafc'}
        stroke={active ? '#0891b2' : '#94a3b8'}
        strokeWidth="2.5"
      />
      <text x="32" y="38" textAnchor="middle" fontSize="18" fontWeight="900" fill={active ? '#0e7490' : '#64748b'}>
        M
      </text>
    </g>
  );
}

function MotorSymbol({ state }: { state: number }) {
  const run = state > 0;
  return (
    <g>
      <circle cx="32" cy="32" r="22" fill={run ? '#dcfce7' : '#f8fafc'} stroke={run ? '#16a34a' : '#94a3b8'} strokeWidth="2.5" />
      <text x="32" y="38" textAnchor="middle" fontSize="16" fontWeight="900" fill={run ? '#166534' : '#64748b'}>M</text>
    </g>
  );
}

function CTSymbol() {
  return (
    <g>
      <rect x="20" y="14" width="24" height="36" rx="3" fill="none" stroke="currentColor" strokeWidth="2" />
      <text x="32" y="58" textAnchor="middle" fontSize="10" fontWeight="800">CT</text>
    </g>
  );
}

function PTSymbol() {
  return (
    <g>
      <circle cx="26" cy="32" r="12" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="38" cy="32" r="12" fill="none" stroke="currentColor" strokeWidth="2" />
      <text x="32" y="58" textAnchor="middle" fontSize="10" fontWeight="800">PT</text>
    </g>
  );
}

function GeneratorSymbol({ state }: { state: number }) {
  const run = state > 0;
  return (
    <g>
      <circle cx="32" cy="30" r="20" fill={run ? '#fef3c7' : '#f8fafc'} stroke={run ? '#d97706' : '#94a3b8'} strokeWidth="2.5" />
      <text x="32" y="36" textAnchor="middle" fontSize="14" fontWeight="900" fill={run ? '#b45309' : '#64748b'}>G</text>
      <path d="M12 48 Q22 42 32 48 T52 48" fill="none" stroke={run ? '#f59e0b' : '#cbd5e1'} strokeWidth="2" />
    </g>
  );
}

function ATSSymbol({ state }: { state: number }) {
  const auto = state !== 0;
  return (
    <g>
      <line x1="8" y1="20" x2="24" y2="20" stroke="currentColor" strokeWidth="2" />
      <line x1="8" y1="44" x2="24" y2="44" stroke="currentColor" strokeWidth="2" />
      <line x1="40" y1="32" x2="56" y2="32" stroke={auto ? '#22c55e' : '#94a3b8'} strokeWidth="3" />
      <text x="32" y="36" textAnchor="middle" fontSize="9" fontWeight="800">{auto ? 'AUTO' : 'MAN'}</text>
    </g>
  );
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

function ElecSymbolSvg({ obj, value }: { obj: NormalizedGraphicObject; value?: CurrentTagValue }) {
  const symbolId = String(obj.style?.symbolId ?? 'breaker');
  const customUrl = obj.style?.customSymbolUrl != null ? String(obj.style.customSymbolUrl) : '';
  const customSvg = obj.style?.customSymbolSvg != null ? String(obj.style.customSymbolSvg) : '';
  const states = String(obj.style?.states ?? 'open,closed,trip').split(',').map((s) => s.trim());
  const state = elecSymbolState(value?.value, states.length);
  const label = states[state] ?? `S${state}`;
  const trip = symbolId === 'breaker' && state >= 2;
  const w = obj.width;
  const h = obj.height;

  if (customUrl || customSvg) {
    return (
      <div className={`rt-elecsymbol-wrap${trip ? ' rt-elecsymbol-trip' : ''}`}>
        {customUrl ? (
          <img src={customUrl} alt={obj.name} width={w} height={h} style={{ objectFit: 'contain', display: 'block' }} />
        ) : (
          <div className="rt-custom-symbol" style={{ width: w, height: h }} dangerouslySetInnerHTML={{ __html: customSvg }} />
        )}
        {(obj.text || obj.name) && <span className="rt-elecsymbol-label">{obj.text || obj.name}</span>}
        <span className={`rt-elecsymbol-state state-${state}`}>{label}</span>
      </div>
    );
  }

  return (
    <div className={`rt-elecsymbol-wrap${trip ? ' rt-elecsymbol-trip' : ''}`}>
      <svg viewBox="0 0 64 64" width={w} height={h} className="rt-elecsymbol-svg" style={{ color: '#173047' }}>
        {symbolId === 'disconnect' && <DisconnectSymbol state={state} />}
        {symbolId === 'transformer' && <TransformerSymbol />}
        {symbolId === 'bus' && <BusSymbol />}
        {symbolId === 'meter' && <MeterSymbol state={state} />}
        {symbolId === 'motor' && <MotorSymbol state={state} />}
        {symbolId === 'ct' && <CTSymbol />}
        {symbolId === 'pt' && <PTSymbol />}
        {symbolId === 'generator' && <GeneratorSymbol state={state} />}
        {symbolId === 'ats' && <ATSSymbol state={state} />}
        {symbolId === 'door' && <DoorSymbol state={state} />}
        {symbolId === 'lamp' && <LampSymbol state={state} />}
        {(symbolId === 'breaker' || !['disconnect', 'transformer', 'bus', 'meter', 'motor', 'ct', 'pt', 'generator', 'ats', 'door', 'lamp'].includes(symbolId)) && (
          <BreakerSymbol state={state} />
        )}
      </svg>
      {(obj.text || obj.name) && <span className="rt-elecsymbol-label">{obj.text || obj.name}</span>}
      <span className={`rt-elecsymbol-state state-${state}`}>{label}</span>
    </div>
  );
}

export function FlowPathObject({
  obj,
  flowValue,
  enableValue,
  animClass = '',
}: {
  obj: NormalizedGraphicObject;
  flowValue?: CurrentTagValue;
  enableValue?: CurrentTagValue;
  animClass?: string;
}) {
  return (
    <div
      className={`rt-obj rt-flowpath${animClass}`}
      style={{
        left: obj.x,
        top: obj.y,
        width: obj.width,
        height: obj.height,
        background: 'transparent',
        border: 'none',
        overflow: 'visible',
        zIndex: obj.layer ?? 1,
      }}
    >
      <FlowPathSvg obj={obj} flowValue={flowValue} enableValue={enableValue} />
    </div>
  );
}

export function Cable3dObject({
  obj,
  flowValue,
  enableValue,
  animClass = '',
}: {
  obj: NormalizedGraphicObject;
  flowValue?: CurrentTagValue;
  enableValue?: CurrentTagValue;
  animClass?: string;
}) {
  const renderObj: NormalizedGraphicObject = {
    ...obj,
    style: {
      ...obj.style,
      strokeWidth: Number(obj.style?.strokeWidth ?? 6),
      flowColor: String(obj.style?.flowColor ?? '#a78bfa'),
      idleColor: String(obj.style?.idleColor ?? '#64748b'),
    },
  };
  return (
    <div
      className={`rt-obj rt-cable3d rt-flowpath${animClass}`}
      style={{
        left: obj.x,
        top: obj.y,
        width: obj.width,
        height: obj.height,
        background: 'transparent',
        border: 'none',
        overflow: 'visible',
        zIndex: obj.layer ?? 1,
        filter: 'drop-shadow(0 2px 4px rgba(99,102,241,0.35))',
      }}
      title={obj.name}
    >
      <FlowPathSvg
        obj={renderObj}
        flowValue={flowValue}
        enableValue={enableValue}
        particleMode={obj.style?.cableParticles !== false}
      />
    </div>
  );
}

export function PipeObject({
  obj,
  flowValue,
  enableValue,
  animClass = '',
}: {
  obj: NormalizedGraphicObject;
  flowValue?: CurrentTagValue;
  enableValue?: CurrentTagValue;
  animClass?: string;
}) {
  const hasPath = Boolean(obj.style?.pathPoints);
  if (!hasPath) {
    const on = flowValue?.value === true || flowValue?.value === 1 || flowValue?.value === '1'
      || (flowValue?.value != null && Number(flowValue.value) > 0);
    const pipeColor = String(obj.style?.fill ?? '#06b6d4');
    return (
      <div className={`rt-obj rt-pipe${on ? ' rt-pipe-flow' : ''}${animClass}`} style={{
        left: obj.x,
        top: obj.y,
        width: obj.width,
        height: obj.height,
        background: 'transparent',
        border: 'none',
        overflow: 'hidden',
        padding: 0,
        zIndex: obj.layer ?? 1,
      }}>
        <div className="rt-pipe-body" style={{ background: pipeColor, height: '40%', top: '30%', position: 'relative' }}>
          {on && <div className="rt-pipe-arrow" style={{ color: pipeColor }} />}
        </div>
        {obj.name && <span className="rt-pipe-label">{obj.name}</span>}
      </div>
    );
  }

  return (
    <div
      className={`rt-obj rt-pipe rt-pipe-path${animClass}`}
      style={{
        left: obj.x,
        top: obj.y,
        width: obj.width,
        height: obj.height,
        background: 'transparent',
        border: 'none',
        overflow: 'visible',
        zIndex: obj.layer ?? 1,
      }}
      title={obj.name}
    >
      <PipePathSvg obj={obj} flowValue={flowValue} enableValue={enableValue} />
      {obj.name ? <span className="rt-pipe-label">{obj.name}</span> : null}
    </div>
  );
}

export function ElecSymbolObject({
  obj,
  value,
  animClass = '',
}: {
  obj: NormalizedGraphicObject;
  value?: CurrentTagValue;
  animClass?: string;
}) {
  const states = String(obj.style?.states ?? 'open,closed,trip').split(',').map((s) => s.trim());
  const state = elecSymbolState(value?.value, states.length);
  const symbolId = String(obj.style?.symbolId ?? 'breaker');
  const trip = symbolId === 'breaker' && state >= 2;

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
      }}
    >
      <ElecSymbolSvg obj={obj} value={value} />
    </div>
  );
}

export { ElecSymbolSvg };
