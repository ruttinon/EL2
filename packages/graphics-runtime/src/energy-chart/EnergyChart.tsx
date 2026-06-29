import React, { useEffect, useMemo, useRef } from 'react';
import type { CurrentTagValue, TrendPoint } from '../types.js';
import { createEnergyChart } from './createChart.js';
import { fillDemoData, chartHasLiveData } from './demoData.js';
import { runtimeToChartOptions } from './fromRuntime.js';
import type { EnergyChartInstance, EnergyChartOptions, EnergyChartType } from './types.js';

export type EnergyChartProps = {
  chartType: EnergyChartType;
  title?: string;
  width: number;
  height: number;
  series?: Array<{ label: string; points: TrendPoint[]; color?: string }>;
  items?: Array<{ label: string; value: number; color?: string }>;
  value?: number;
  min?: number;
  max?: number;
  unit?: string;
  tagIds?: string[];
  valuesByTag?: Map<string, CurrentTagValue>;
  showLegend?: boolean;
  primaryColor?: string;
  /** When false, skip Jan/Feb demo data (live preview or bound tags). Default true. */
  allowDemoData?: boolean;
  /** Full declarative override */
  options?: EnergyChartOptions;
};

export function EnergyChart({
  chartType,
  title,
  width,
  height,
  series = [],
  items = [],
  value = 0,
  min = 0,
  max = 100,
  unit,
  tagIds,
  valuesByTag,
  showLegend,
  primaryColor,
  allowDemoData = true,
  options: explicitOptions,
}: EnergyChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<EnergyChartInstance | null>(null);

  const options = useMemo(() => {
    const base = explicitOptions ?? runtimeToChartOptions({
      chartType,
      title,
      series,
      items,
      value,
      min,
      max,
      unit,
      tagIds,
      valuesByTag,
      showLegend,
      primaryColor,
    });
    const live = chartHasLiveData({
      chartType: base.chart.type,
      tagIds,
      valuesByTag,
      series: series.map((s) => ({ points: s.points })),
      value,
    });
    const boundTagCount = tagIds?.length ?? 0;
    return fillDemoData(base, live, { allowDemo: allowDemoData, boundTagCount });
  }, [
    explicitOptions,
    chartType,
    title,
    series,
    items,
    value,
    min,
    max,
    unit,
    tagIds,
    valuesByTag,
    showLegend,
    primaryColor,
    allowDemoData,
  ]);

  useEffect(() => {
    if (!containerRef.current) return;
    instanceRef.current = createEnergyChart(containerRef.current, options);
    return () => {
      instanceRef.current?.dispose();
      instanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    instanceRef.current?.setOptions(options);
  }, [options]);

  useEffect(() => {
    instanceRef.current?.resize(width, height);
  }, [width, height]);

  return (
    <div
      ref={containerRef}
      className="energy-chart"
      style={{ width, height, background: 'transparent' }}
    />
  );
}

export type { EnergyChartType };
