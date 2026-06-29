export const VALUE_WIDGET_TITLES: Record<string, string> = {
  value: 'Value',
  gauge: 'Gauge',
  progressbar: 'Progress Bar',
  levelbar: 'Level Bar',
  led: 'LED',
  status: 'Status',
  semaphore: 'Semaphore',
  multistate: 'Multistate',
  statusbadge: 'Status Badge',
  kpicard: 'KPI Card',
  formulavalue: 'Formula Value',
};

export const NUMERIC_VALUE_TYPES = new Set([
  'value', 'gauge', 'progressbar', 'levelbar', 'kpicard', 'formulavalue',
]);

export const BAR_VALUE_TYPES = new Set(['progressbar', 'levelbar']);

export const RANGE_VALUE_TYPES = new Set(['gauge', 'progressbar', 'levelbar']);

export const STATE_SLOT_TYPES = new Set(['multistate', 'statusbadge', 'semaphore']);
