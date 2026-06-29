import React from 'react';
import { RtObject } from './RtObject';
import { sortGraphicObjects, trendPeriodToRange } from './normalize';
import { chartTypeUsesTrend } from './energy-chart';
import { appendSessionTrend, resolveTrendPoints } from './trendSession';
import { collectFloorLevels, resolveFloorVisible } from './objectLogic';
import { playAlarmBeep } from './alarmSound';
import { useGraphicScale } from './useGraphicScale';
import { DiagramViewport } from './DiagramViewport';
import type {
  CurrentTagValue,
  FetchTrendFn,
  RawGraphicObject,
  RuntimeAlarm,
  TrendPoint,
  TrendResponse,
} from './types';
import type { WriteTagOptions } from './objectLogic';
import { TREND_SERIES_COLORS, type TrendSeries } from './charts';

export type { WriteTagOptions };

export type GraphicStageProps = {
  width: number;
  height: number;
  backgroundColor?: string;
  backgroundImage?: string | null;
  objects?: RawGraphicObject[];
  currentValues: CurrentTagValue[];
  alarms: RuntimeAlarm[];
  onWriteTag?: (tagId: string, tagName: string, dataType: string, options?: WriteTagOptions) => void;
  onNavigate?: (graphicId: string) => void;
  onAcknowledge?: (alarmId: string) => void;
  fetchTrend: FetchTrendFn;
  refreshIntervalMs?: number;
  fitViewport?: boolean;
  diagramMode?: boolean;
  wrapClassName?: string;
  stageClassName?: string;
  animate?: boolean;
  emptyMessage?: string;
  /** When set, only objects with matching style.floorLevel (or no floor) are shown */
  activeFloor?: number | null;
  navigationBar?: React.ReactNode;
  viewModeBar?: React.ReactNode;
  /** When true (default), hide dashed placeholders for empty effect objects in runtime */
  runtimeMode?: boolean;
  /** Engine base URL for clock server sync (e.g. http://localhost:8081) */
  engineApiBase?: string;
  resolveAssetRef?: (ref: string) => string;
};

function resolveTableValues(
  obj: ReturnType<typeof sortGraphicObjects>[number],
  allValues: CurrentTagValue[],
): CurrentTagValue[] {
  if (obj.type !== 'tagtable') return [];
  if (obj.tagIds && obj.tagIds.length > 0) {
    return obj.tagIds
      .map((id) => allValues.find((v) => v.id === id))
      .filter((v): v is CurrentTagValue => !!v);
  }
  if (obj.deviceId) {
    return allValues.filter((v) => v.deviceId === obj.deviceId);
  }
  return allValues;
}

export function GraphicStage({
  width,
  height,
  backgroundColor = '#fbfdff',
  backgroundImage,
  objects = [],
  currentValues,
  alarms,
  onWriteTag,
  onNavigate,
  onAcknowledge,
  fetchTrend,
  refreshIntervalMs = 10000,
  fitViewport = false,
  diagramMode = false,
  wrapClassName = 'graphic-stage-scroll',
  stageClassName = 'graphic-runtime-stage',
  animate = true,
  emptyMessage = 'Graphic has no objects yet.',
  activeFloor = null,
  navigationBar,
  viewModeBar,
  runtimeMode = true,
  engineApiBase,
  resolveAssetRef,
}: GraphicStageProps) {
  const normalized = React.useMemo(() => sortGraphicObjects(objects), [objects]);
  const visibleObjects = React.useMemo(
    () => normalized.filter((obj) => resolveFloorVisible(obj, activeFloor)),
    [normalized, activeFloor],
  );
  const valuesByTag = React.useMemo(() => new Map(currentValues.map((v) => [v.id, v])), [currentValues]);
  const alarmByTag = React.useMemo(
    () => new Map(alarms.filter((a) => a.status === 'active').map((a) => [a.tagId, a])),
    [alarms],
  );

  const alarmSoundEnabled = React.useMemo(
    () => normalized.some((o) => o.type === 'alarmtable' && o.style?.alarmSound === true),
    [normalized],
  );
  const prevAlarmIdsRef = React.useRef<Set<string>>(new Set());
  React.useEffect(() => {
    if (!alarmSoundEnabled || !runtimeMode) return;
    const active = alarms.filter((a) => a.status === 'active');
    const ids = new Set(active.map((a) => a.id));
    let hasNew = false;
    for (const id of ids) {
      if (!prevAlarmIdsRef.current.has(id)) {
        hasNew = true;
        break;
      }
    }
    prevAlarmIdsRef.current = ids;
    if (hasNew && active.length > 0) playAlarmBeep();
  }, [alarms, alarmSoundEnabled, runtimeMode]);

  const [trends, setTrends] = React.useState<Map<string, TrendResponse | null>>(new Map());
  const sessionTrendRef = React.useRef<Map<string, TrendPoint[]>>(new Map());
  const { wrapRef, scale } = useGraphicScale(width, height, fitViewport && !diagramMode);

  React.useEffect(() => {
    if (!runtimeMode) return;
    appendSessionTrend(sessionTrendRef.current, currentValues);
  }, [currentValues, runtimeMode]);

  const trendTargets = React.useMemo(() => {
    const map = new Map<string, { tagId: string; period: string }>();
    for (const obj of normalized) {
      if (obj.type === 'sparkline') {
        const tagId = obj.tagId;
        if (!tagId) continue;
        const period = String(obj.style?.period ?? '24h');
        map.set(obj.id, { tagId, period });
      }
      if (obj.type === 'trend' || obj.type === 'echart') {
        const ids = obj.tagIds?.length ? obj.tagIds : (obj.tagId ? [obj.tagId] : []);
        const period = String(obj.style?.period ?? obj.style?.chartPeriod ?? '24h');
        const echartType = String(obj.style?.echartType ?? 'line');
        const needsTrend = obj.type === 'trend' || chartTypeUsesTrend(echartType as 'line' | 'area');
        if (!needsTrend) continue;
        for (const tid of ids) {
          map.set(`${obj.type}-${obj.id}-${tid}`, { tagId: tid, period });
        }
      }
      if (obj.type === 'barchart' && obj.tagIds) {
        for (const tid of obj.tagIds) {
          if (!map.has(`bar-${tid}`)) map.set(`bar-${tid}`, { tagId: tid, period: '1h' });
        }
      }
    }
    return map;
  }, [normalized]);

  const loadTrends = React.useCallback(async () => {
    const entries = [...trendTargets.entries()];
    if (entries.length === 0) return;
    const results = await Promise.all(
      entries.map(async ([key, { tagId, period }]) => {
        const range = trendPeriodToRange(period);
        const data = await fetchTrend({ tagId, from: range.from, to: range.to, limit: range.limit });
        return [key, data] as const;
      }),
    );
    setTrends(new Map(results));
  }, [trendTargets, fetchTrend]);

  React.useEffect(() => {
    void loadTrends();
    const ms = Math.max(2500, refreshIntervalMs);
    const timer = window.setInterval(() => void loadTrends(), ms);
    return () => window.clearInterval(timer);
  }, [loadTrends, refreshIntervalMs]);

  const stageContent = (
    <div
      className={stageClassName}
      style={{
        width,
        height,
        backgroundColor: backgroundImage ? undefined : backgroundColor,
        backgroundImage: backgroundImage ? `url("${backgroundImage}")` : undefined,
        backgroundSize: backgroundImage ? 'cover' : undefined,
        backgroundPosition: backgroundImage ? 'center' : undefined,
        backgroundRepeat: backgroundImage ? 'no-repeat' : undefined,
        transform: diagramMode ? undefined : `scale(${scale})`,
        transformOrigin: fitViewport ? 'center center' : 'top left',
        position: 'relative',
      }}
    >
      {visibleObjects.length === 0 ? (
        <div className="empty-graphic-stage">{emptyMessage}</div>
      ) : (
        visibleObjects.map((obj, i) => {
          let trendData: TrendResponse | null = null;
          let trendSeries: TrendSeries[] | undefined;

          if (obj.type === 'sparkline') {
            trendData = trends.get(obj.id) ?? null;
          } else if (obj.type === 'trend' || obj.type === 'echart') {
            const ids = obj.tagIds?.length ? obj.tagIds : (obj.tagId ? [obj.tagId] : []);
            const period = String(obj.style?.period ?? obj.style?.chartPeriod ?? '24h');
            const range = trendPeriodToRange(period);
            const echartType = String(obj.style?.echartType ?? 'line');
            const needsTrend = obj.type === 'trend' || chartTypeUsesTrend(echartType as 'line' | 'area');
            if (needsTrend && ids.length > 1) {
              trendSeries = ids.map((tid, idx) => ({
                label: valuesByTag.get(tid)?.name ?? tid.slice(-6),
                color: TREND_SERIES_COLORS[idx % TREND_SERIES_COLORS.length],
                points: resolveTrendPoints(
                  trends.get(`${obj.type}-${obj.id}-${tid}`),
                  sessionTrendRef.current,
                  tid,
                  range.from,
                ),
              }));
            } else if (needsTrend && ids.length === 1) {
              const tid = ids[0]!;
              const pts = resolveTrendPoints(
                trends.get(`${obj.type}-${obj.id}-${tid}`),
                sessionTrendRef.current,
                tid,
                range.from,
              );
              trendData = { tagId: tid, count: pts.length, values: pts };
            }
          }

          const flowVal = obj.flowTagId ? valuesByTag.get(obj.flowTagId) : undefined;
          const enableVal = obj.enableTagId ? valuesByTag.get(obj.enableTagId) : undefined;

          const primaryTagId = obj.tagId ?? obj.tagIds?.[0];
          const primaryValue = primaryTagId ? valuesByTag.get(primaryTagId) : undefined;

          return (
            <RtObject
              key={obj.id}
              obj={obj}
              index={i}
              animate={animate}
              value={primaryValue}
              flowValue={flowVal}
              enableValue={enableVal}
              values={obj.type === 'tagtable' ? resolveTableValues(obj, currentValues) : currentValues}
              alarm={obj.tagId ? alarmByTag.get(obj.tagId) : undefined}
              alarms={alarms}
              trend={trendData}
              trendSeries={trendSeries}
              onWriteTag={onWriteTag}
              onNavigate={onNavigate}
              onAcknowledge={onAcknowledge}
              valuesByTag={valuesByTag}
              runtimeMode={runtimeMode}
              engineApiBase={engineApiBase}
              stageWidth={width}
              stageHeight={height}
              allObjects={visibleObjects}
              resolveAssetRef={resolveAssetRef}
            />
          );
        })
      )}
    </div>
  );

  return (
    <div className={wrapClassName} ref={wrapRef} style={{ overflow: diagramMode ? 'hidden' : 'hidden' }}>
      {viewModeBar}
      {navigationBar}
      {diagramMode ? (
        <DiagramViewport enabled stageWidth={width} stageHeight={height} className="diagram-viewport-embedded">
          {stageContent}
        </DiagramViewport>
      ) : (
        stageContent
      )}
    </div>
  );
}

export { useGraphicScale };
export { useGraphicNavigation } from './useGraphicNavigation';
export type { GraphicNavigationState } from './useGraphicNavigation';
export { GraphicNavigationBar } from './GraphicNavigationBar';
export type { GraphicNavigationBarProps } from './GraphicNavigationBar';
export { collectFloorLevels, resolveFloorVisible } from './objectLogic';
