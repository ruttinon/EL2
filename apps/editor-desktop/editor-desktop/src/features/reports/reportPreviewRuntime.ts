import React from 'react';
import type { DeviceSummary, ReportObjectDefinition, TagSummary } from '@energylink/shared-types';
import type { CurrentTagValue, TrendPoint, TrendResponse } from '@energylink/graphics-runtime';
import { chartTypeUsesTrend } from '@energylink/graphics-runtime';
import type { TrendSeries } from '@energylink/graphics-runtime';
import { resolveReportScopeDeviceIds } from '@energylink/shared-types';
import { editorRuntimeApi } from '../../api/editorRuntimeApi';
import { resolveReportTagIds } from './reportPatchUtils';

export const REPORT_CHART_PERIOD_OPTIONS = [
  { value: '1h', label: '1 ชั่วโมง' },
  { value: '6h', label: '6 ชั่วโมง' },
  { value: '24h', label: '24 ชั่วโมง' },
  { value: '7d', label: '7 วัน' },
  { value: '30d', label: '30 วัน' },
] as const;

export const REPORT_CHART_VIEW_MODES = [
  { value: 'line', label: 'เส้นกราฟ (Line)' },
  { value: 'points', label: 'จุด (Points)' },
  { value: 'area', label: 'พื้นที่ (Area)' },
  { value: 'table', label: 'ตารางข้อมูล (Table)' },
] as const;

export const REPORT_SAMPLE_DENSITY = [
  { value: '12', label: 'หยาบ (12 จุด)' },
  { value: '24', label: 'ปานกลาง (24 จุด)' },
  { value: '48', label: 'ละเอียด (48 จุด)' },
  { value: '96', label: 'มาก (96 จุด)' },
] as const;

export type ReportChartViewMode = (typeof REPORT_CHART_VIEW_MODES)[number]['value'];

function periodSpanMs(period: string): number {
  switch (period) {
    case '1h': return 60 * 60 * 1000;
    case '6h': return 6 * 60 * 60 * 1000;
    case '7d': return 7 * 24 * 60 * 60 * 1000;
    case '30d': return 30 * 24 * 60 * 60 * 1000;
    case '24h':
    default: return 24 * 60 * 60 * 1000;
  }
}

export function reportTrendPeriodToRange(period: string, pointCount: number): { from: string; to: string; limit: number } {
  const now = Date.now();
  const to = new Date(now).toISOString();
  return {
    from: new Date(now - periodSpanMs(period)).toISOString(),
    to,
    limit: Math.min(500, Math.max(pointCount, 50)),
  };
}

/** Never generates demo/fake data — returns null when no tags/values */
export function buildTagValuesFromCatalog(
  tags: TagSummary[],
  devices: DeviceSummary[],
  liveMap?: Map<string, CurrentTagValue>,
): CurrentTagValue[] {
  if (!tags.length) return [];
  return tags
    .map((tag) => {
      const live = liveMap?.get(tag.id);
      if (live) return live;
      return null;
    })
    .filter((v): v is CurrentTagValue => v !== null);
}

export function resolveReportTableValues(
  object: ReportObjectDefinition,
  allValues: CurrentTagValue[],
  devices: DeviceSummary[] = [],
): CurrentTagValue[] {
  if (object.type !== 'tagtable') return [];
  const tagIds = object.tagIds?.length ? object.tagIds : resolveReportTagIds(object);
  if (tagIds.length > 0) {
    return tagIds
      .map((id) => allValues.find((v) => v.id === id))
      .filter((v): v is CurrentTagValue => Boolean(v));
  }
  const scopedDeviceIds = new Set(resolveReportScopeDeviceIds(devices, object.props ?? {}));
  const deviceId = object.props?.scopeDeviceId ?? object.props?.deviceId ?? object.deviceId ?? object.binding?.deviceId;
  if (scopedDeviceIds.size > 0) return allValues.filter((v) => scopedDeviceIds.has(v.deviceId ?? ''));
  if (deviceId) return allValues.filter((v) => v.deviceId === deviceId);
  return allValues;
}

export function chartPeriodForObject(object: ReportObjectDefinition): string {
  const style = object.style ?? {};
  return String(object.props?.period ?? object.props?.reportPeriod ?? style.period ?? style.chartPeriod ?? '24h');
}

export function chartPointCountForObject(object: ReportObjectDefinition): number {
  const raw = Number(object.style?.reportSamplePoints ?? object.style?.chartPoints ?? 24);
  return Number.isFinite(raw) ? Math.min(200, Math.max(2, raw)) : 24;
}

export function chartViewModeForObject(object: ReportObjectDefinition): ReportChartViewMode {
  const mode = String(object.props?.chartStyle ?? object.style?.reportViewMode ?? 'line');
  if (mode === 'points' || mode === 'area' || mode === 'table') return mode;
  return 'line';
}

function toTrendResponse(tagId: string, points: TrendPoint[]): TrendResponse {
  return { tagId, count: points.length, values: points };
}

export function useReportObjectPreview(
  object: ReportObjectDefinition,
  tags: TagSummary[],
  devices: DeviceSummary[],
) {
  const [liveMap, setLiveMap] = React.useState<Map<string, CurrentTagValue>>(new Map());
  const [trend, setTrend] = React.useState<TrendResponse | null>(null);
  const [trendSeries, setTrendSeries] = React.useState<TrendSeries[] | undefined>();
  const [tablePoints, setTablePoints] = React.useState<TrendPoint[]>([]);
  const [hasEngine, setHasEngine] = React.useState<boolean | null>(null);

  const allValues = React.useMemo(
    () => buildTagValuesFromCatalog(tags, devices, liveMap),
    [tags, devices, liveMap],
  );

  const valuesByTag = React.useMemo(
    () => new Map(allValues.map((v) => [v.id, v])),
    [allValues],
  );

  const tableValues = React.useMemo(
    () => (object.type === 'tagtable' ? resolveReportTableValues(object, allValues, devices) : allValues),
    [object, allValues, devices],
  );

  const primaryTagId = resolveReportTagIds(object)[0];
  const primaryValue = primaryTagId ? valuesByTag.get(primaryTagId) : undefined;

  const period = chartPeriodForObject(object);
  const pointCount = chartPointCountForObject(object);
  const viewMode = chartViewModeForObject(object);
  const tagIdsKey = (object.tagIds ?? resolveReportTagIds(object)).join(',');
  const echartType = String(object.props?.chartType ?? object.style?.echartType ?? 'line');

  const tagIds = React.useMemo(() => object.tagIds?.length ? object.tagIds : resolveReportTagIds(object), [object.id, object.tagIds, object.sourceTagId, object.tagId, object.deviceId]);

  // Check engine availability
  React.useEffect(() => {
    let cancelled = false;
    void editorRuntimeApi.getCurrentValues()
      .then((res) => { if (!cancelled) setHasEngine(res.ok && Array.isArray(res.data?.values)); })
      .catch(() => { if (!cancelled) setHasEngine(false); });
    return () => { cancelled = true; };
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await editorRuntimeApi.getCurrentValues();
      if (cancelled || !res.ok) return;
      setLiveMap(new Map(res.data.values.map((v) => [v.id, v])));
    })();
    return () => { cancelled = true; };
  }, [object.id, tags.length]);

  React.useEffect(() => {
    let cancelled = false;
    const isChart = object.type === 'trend' || object.type === 'echart';
    if (!isChart) {
      setTrend(null);
      setTrendSeries(undefined);
      setTablePoints([]);
      return;
    }

    const needsTrend = object.type === 'trend' || chartTypeUsesTrend(echartType as 'line');
    if (!needsTrend && object.type === 'echart') {
      setTrend(null);
      setTrendSeries(undefined);
      setTablePoints([]);
      return;
    }

    async function loadTrends() {
      // If no tags bound — show empty, never demo
      if (tagIds.length === 0) {
        if (!cancelled) {
          setTrend(null);
          setTrendSeries(undefined);
          setTablePoints([]);
        }
        return;
      }

      const range = reportTrendPeriodToRange(period, pointCount);
      const results = await Promise.all(
        tagIds.map(async (tagId, index) => {
          const res = await editorRuntimeApi.getTrend({
            tagId,
            from: range.from,
            to: range.to,
            limit: pointCount,
            points: pointCount,
          });
          const tag = tags.find((t) => t.id === tagId);
          // Use real data only — if no data, points is empty array
          const points = res.ok && res.data.values?.length ? res.data.values : [];
          return {
            label: tag?.name ?? tagId.slice(-6),
            color: ['#087c8b', '#f59e0b', '#8b5cf6', '#ef4444', '#22c55e', '#06b6d4'][index % 6],
            points,
          } satisfies TrendSeries;
        }),
      );

      if (cancelled) return;
      if (viewMode === 'table') {
        setTablePoints(results[0]?.points ?? []);
        setTrend(null);
        setTrendSeries(undefined);
        return;
      }
      if (results.length > 1) {
        setTrendSeries(results);
        setTrend(null);
        setTablePoints([]);
      } else {
        const only = results[0];
        setTrend(toTrendResponse(tagIds[0]!, only?.points ?? []));
        setTrendSeries(undefined);
        setTablePoints([]);
      }
    }

    void loadTrends();
    return () => { cancelled = true; };
  }, [object.id, object.type, period, pointCount, viewMode, tagIdsKey, echartType, tags, tagIds.join(',')]);

  return {
    valuesByTag,
    values: tableValues,
    primaryValue,
    trend,
    trendSeries,
    tablePoints,
    viewMode,
    period,
    pointCount,
    hasEngine: hasEngine === true,
    hasEngineBeenChecked: hasEngine !== null,
  };
}