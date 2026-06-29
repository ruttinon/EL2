import React from 'react';
import type { NormalizedGraphicObject } from './types';

export type ClockFormat = 'local' | 'utc' | 'server';
export type ClockTimeStyle = '12h' | '24h';
export type ClockVariant = 'digital' | 'compact' | 'analog' | 'wall' | 'date';

export function formatClockDisplay(
  date: Date,
  clockFormat: ClockFormat,
  timeStyle: ClockTimeStyle,
  showSeconds: boolean,
): { time: string; dateLine: string } {
  const timeZone = clockFormat === 'utc' ? 'UTC' : undefined;
  const hour12 = timeStyle === '12h';
  const time = date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: showSeconds ? '2-digit' : undefined,
    hour12,
    timeZone,
  });
  const dateLine = date.toLocaleDateString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone,
  });
  return { time, dateLine };
}

const DEFAULT_ENGINE_BASE = 'http://localhost:8081';

async function fetchServerTime(baseUrl?: string): Promise<Date | null> {
  const bases = [baseUrl, typeof window !== 'undefined' ? window.location.origin : '', DEFAULT_ENGINE_BASE].filter(Boolean) as string[];
  for (const base of bases) {
    try {
      const res = await fetch(`${base.replace(/\/$/, '')}/api/time`, { signal: AbortSignal.timeout(2500) });
      if (!res.ok) continue;
      const data = (await res.json()) as { iso?: string; unixMs?: number };
      if (data.iso) return new Date(data.iso);
      if (typeof data.unixMs === 'number') return new Date(data.unixMs);
    } catch {
      /* try next base */
    }
  }
  return null;
}

function useClockNow(clockFormat: ClockFormat, engineApiBase: string | undefined, showSeconds: boolean): Date {
  const [now, setNow] = React.useState(() => new Date());
  const serverOffsetRef = React.useRef(0);

  React.useEffect(() => {
    let cancelled = false;
    const syncServer = async () => {
      if (clockFormat !== 'server') return;
      const serverDate = await fetchServerTime(engineApiBase);
      if (!serverDate || cancelled) return;
      serverOffsetRef.current = serverDate.getTime() - Date.now();
    };
    void syncServer();
    const syncTimer = window.setInterval(() => void syncServer(), 60_000);
    const tickTimer = window.setInterval(() => {
      const base = Date.now() + (clockFormat === 'server' ? serverOffsetRef.current : 0);
      setNow(new Date(base));
    }, showSeconds ? 1000 : 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(syncTimer);
      window.clearInterval(tickTimer);
    };
  }, [clockFormat, engineApiBase, showSeconds]);

  return now;
}

function handLine(cx: number, cy: number, angleDeg: number, length: number, width: number, color: string) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  const x2 = cx + Math.cos(rad) * length;
  const y2 = cy + Math.sin(rad) * length;
  return <line x1={cx} y1={cy} x2={x2} y2={y2} stroke={color} strokeWidth={width} strokeLinecap="round" />;
}

function AnalogClockFace({
  date,
  faceColor,
  handColor,
  tickColor,
  showSeconds,
}: {
  date: Date;
  faceColor: string;
  handColor: string;
  tickColor: string;
  showSeconds: boolean;
}) {
  const sec = date.getSeconds();
  const min = date.getMinutes();
  const hr = date.getHours();
  const secAngle = sec * 6;
  const minAngle = min * 6 + sec * 0.1;
  const hrAngle = (hr % 12) * 30 + min * 0.5;
  const ticks = Array.from({ length: 12 }, (_, i) => {
    const a = (i * 30 - 90) * (Math.PI / 180);
    const x1 = 50 + Math.cos(a) * 38;
    const y1 = 50 + Math.sin(a) * 38;
    const x2 = 50 + Math.cos(a) * 42;
    const y2 = 50 + Math.sin(a) * 42;
    return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={tickColor} strokeWidth={i % 3 === 0 ? 2 : 1} />;
  });

  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" style={{ display: 'block' }}>
      <circle cx={50} cy={50} r={44} fill={faceColor} stroke={tickColor} strokeWidth={1.5} />
      {ticks}
      {handLine(50, 50, hrAngle, 22, 3, handColor)}
      {handLine(50, 50, minAngle, 30, 2.2, handColor)}
      {showSeconds ? handLine(50, 50, secAngle, 34, 1, handColor) : null}
      <circle cx={50} cy={50} r={2.5} fill={handColor} />
    </svg>
  );
}

export function ClockObject({
  obj,
  style: outerStyle,
  animClass = '',
  engineApiBase,
}: {
  obj: NormalizedGraphicObject;
  style?: React.CSSProperties;
  animClass?: string;
  engineApiBase?: string;
}) {
  const clockFormat = String(obj.style?.clockFormat ?? 'local') as ClockFormat;
  const timeStyle = String(obj.style?.clockTimeStyle ?? '24h') as ClockTimeStyle;
  const variant = String(obj.style?.clockVariant ?? 'digital') as ClockVariant;
  const showDate = obj.style?.showDate !== false && variant !== 'compact';
  const showSeconds = obj.style?.showSeconds !== false;
  const fontSize = Number(obj.style?.fontSize ?? (variant === 'compact' ? 16 : variant === 'wall' ? 28 : 22));
  const color = String(obj.style?.color ?? '#142033');
  const align = String(obj.style?.textAlign ?? obj.style?.align ?? 'center');
  const faceColor = String(obj.style?.clockFaceColor ?? '#f8fafc');
  const handColor = String(obj.style?.clockHandColor ?? color);
  const tickColor = String(obj.style?.clockTickColor ?? '#94a3b8');

  const now = useClockNow(clockFormat, engineApiBase, showSeconds);
  const fmt = clockFormat === 'server' ? 'local' : clockFormat;
  const { time, dateLine } = formatClockDisplay(now, fmt, timeStyle, showSeconds);

  const alignItems = align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center';

  const boxStyle: React.CSSProperties = {
    ...outerStyle,
    color,
    display: 'flex',
    flexDirection: 'column',
    alignItems,
    justifyContent: 'center',
    textAlign: align as 'left' | 'center' | 'right',
    padding: variant === 'compact' ? '2px 8px' : variant === 'wall' ? '10px 14px' : '6px 10px',
    boxSizing: 'border-box',
    overflow: 'hidden',
  };

  const variantClass = ` rt-clock-${variant}`;

  if (variant === 'analog') {
    return (
      <div className={`rt-obj rt-clock${variantClass}${animClass}`} style={boxStyle}>
        <div className="rt-clock-analog-wrap" style={{ width: '100%', height: '100%', minHeight: 0, flex: 1 }}>
          <AnalogClockFace date={now} faceColor={faceColor} handColor={handColor} tickColor={tickColor} showSeconds={showSeconds} />
        </div>
        {obj.text ? <div className="rt-clock-label">{obj.text}</div> : null}
      </div>
    );
  }

  if (variant === 'date') {
    return (
      <div className={`rt-obj rt-clock${variantClass}${animClass}`} style={boxStyle}>
        <div className="rt-clock-date-primary" style={{ fontSize: Math.max(12, fontSize * 0.85), fontWeight: 700, lineHeight: 1.2 }}>
          {dateLine}
        </div>
        <div className="rt-clock-time-secondary" style={{ fontSize: Math.max(14, fontSize * 0.65), opacity: 0.8, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
          {time}
        </div>
        {obj.text ? <div className="rt-clock-label">{obj.text}</div> : null}
      </div>
    );
  }

  if (variant === 'wall') {
    return (
      <div className={`rt-obj rt-clock${variantClass}${animClass}`} style={{ ...boxStyle, borderRadius: 12 }}>
        {showDate ? (
          <div className="rt-clock-wall-date" style={{ fontSize: Math.max(10, fontSize * 0.4), opacity: 0.7, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            {dateLine}
          </div>
        ) : null}
        <div className="rt-clock-wall-time" style={{ fontSize, fontWeight: 800, lineHeight: 1.05, fontVariantNumeric: 'tabular-nums' }}>
          {time}
        </div>
        {obj.text ? <div className="rt-clock-label">{obj.text}</div> : null}
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className={`rt-obj rt-clock${variantClass}${animClass}`} style={{ ...boxStyle, flexDirection: 'row', gap: 8, justifyContent: alignItems === 'flex-end' ? 'flex-end' : alignItems === 'flex-start' ? 'flex-start' : 'center' }}>
        <span className="rt-clock-compact-time" style={{ fontSize, fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
          {time}
        </span>
        {obj.text ? <span className="rt-clock-label" style={{ fontSize: 10, opacity: 0.65 }}>{obj.text}</span> : null}
      </div>
    );
  }

  return (
    <div className={`rt-obj rt-clock${variantClass}${animClass}`} style={boxStyle}>
      <div className="rt-clock-time" style={{ fontSize, fontWeight: 700, lineHeight: 1.15, fontVariantNumeric: 'tabular-nums' }}>
        {time}
      </div>
      {showDate ? (
        <div className="rt-clock-date" style={{ fontSize: Math.max(10, fontSize * 0.55), opacity: 0.75, marginTop: 4 }}>
          {dateLine}
        </div>
      ) : null}
      {obj.text ? <div className="rt-clock-label" style={{ fontSize: 10, opacity: 0.6, marginTop: 4 }}>{obj.text}</div> : null}
    </div>
  );
}
