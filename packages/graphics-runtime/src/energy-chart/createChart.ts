import { buildEChartsOption } from './buildOption.js';
import { ensureEchartsCore } from './echartsCore.js';
import type { EnergyChartInstance, EnergyChartOptions } from './types.js';

/**
 * Create a chart instance on a DOM element.
 * Pattern: similar to `Chart(container, options)` factories in common chart libraries.
 */
export function createEnergyChart(
  container: HTMLElement,
  options: EnergyChartOptions,
): EnergyChartInstance {
  const echarts = ensureEchartsCore();
  const chart = echarts.init(container, undefined, { renderer: 'canvas' });

  const apply = (next: EnergyChartOptions) => {
    chart.setOption(buildEChartsOption(next), { notMerge: true });
  };

  apply(options);

  return {
    setOptions: apply,
    resize: (width, height) => chart.resize({ width, height }),
    dispose: () => chart.dispose(),
  };
}
