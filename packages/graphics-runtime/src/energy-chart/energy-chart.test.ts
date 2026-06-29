import assert from 'node:assert/strict';
import { buildEChartsOption } from './buildOption.js';
import { ENERGY_CHART_CATALOG, normalizeChartType } from './chartCatalog.js';
import { gaugeStyleToChartType } from './gaugeCatalog.js';
import type { EnergyChartOptions } from './types.js';

assert.equal(ENERGY_CHART_CATALOG.length, 16);

const lineOpts: EnergyChartOptions = {
  chart: { type: 'line' },
  title: { text: 'Power' },
  series: [{
    name: 'kW',
    data: [
      { x: '2024-01-01T10:00:00Z', y: 10 },
      { x: '2024-01-01T11:00:00Z', y: 20 },
    ],
  }],
};

const built = buildEChartsOption(lineOpts);
assert.equal((built.series as Array<{ type: string }>)[0]?.type, 'line');

assert.equal(normalizeChartType('gauge'), 'line');
assert.equal(normalizeChartType('gauge-speedometer'), 'line');
assert.equal(normalizeChartType('column3d'), 'column3d');

assert.equal(gaugeStyleToChartType('classic'), null);
assert.equal(gaugeStyleToChartType('speedometer'), 'gauge-speedometer');

const gauge = buildEChartsOption({ chart: { type: 'gauge-solid' }, value: 42, yAxis: { min: 0, max: 100 } });
assert.equal((gauge.series as Array<{ type: string }>)[0]?.type, 'gauge');

const col3d = buildEChartsOption({ chart: { type: 'column3d' }, categories: [{ name: 'A', y: 10 }] });
assert.equal((col3d.series as Array<{ type: string }>)[0]?.type, 'bar3D');

const funnel = buildEChartsOption({ chart: { type: 'funnel3d' }, categories: [{ name: 'A', y: 100 }] });
assert.equal((funnel.series as Array<{ type: string }>)[0]?.type, 'funnel');

console.log('energy-chart: all tests passed');
