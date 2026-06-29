import { resolveReportToolType } from './reportToolSettingsRegistry';

export type ReportSettingPreset = {
  toolType: string;
  label: string;
  description: string;
  values: Record<string, unknown>;
};

export const REPORT_TOOL_SETTING_PRESETS: ReportSettingPreset[] = [
  { toolType: 'text', label: 'Report Title', description: 'Text style for report title', values: { name: 'Report Title', text: '{{report.name}}', fontSize: 24, fontWeight: '700', align: 'center', wrapText: true } },
  { toolType: 'text', label: 'Section Header', description: 'Header text style', values: { name: 'Section Header', text: '{{section.title}}', fontSize: 18, fontWeight: '700', align: 'left', wrapText: true } },
  { toolType: 'text', label: 'Normal Note', description: 'Note style text', values: { name: 'Normal Note', text: '{{report.note}}', fontSize: 14, fontWeight: '400', align: 'left', wrapText: true } },
  { toolType: 'value', label: 'kWh Usage', description: 'Value field for energy usage', values: { name: 'kWh Usage', bindingSource: 'tag', metric: 'usage', period: 'thisMonth', decimal: 2, unit: 'kWh', fallbackValue: '--' } },
  { toolType: 'value', label: 'kW Demand', description: 'Value field for demand', values: { name: 'kW Demand', bindingSource: 'tag', metric: 'peak', period: 'today', decimal: 2, unit: 'kW', fallbackValue: '--' } },
  { toolType: 'value', label: 'Voltage', description: 'Value field for voltage', values: { name: 'Voltage', bindingSource: 'tag', metric: 'live', period: 'today', decimal: 2, unit: 'V', fallbackValue: '--' } },
  { toolType: 'value', label: 'Current', description: 'Value field for current', values: { name: 'Current', bindingSource: 'tag', metric: 'live', period: 'today', decimal: 2, unit: 'A', fallbackValue: '--' } },
  { toolType: 'value', label: 'Power Factor', description: 'Value field for power factor', values: { name: 'Power Factor', bindingSource: 'tag', metric: 'live', period: 'today', decimal: 3, unit: '', fallbackValue: '--' } },
  { toolType: 'kpicard', label: 'Total Energy', description: 'KPI card for total energy', values: { name: 'Total Energy', title: 'Total Energy', metric: 'usage', period: 'thisMonth', decimal: 2, compareMode: 'none', background: '#ffffff' } },
  { toolType: 'kpicard', label: 'Peak Demand', description: 'KPI card for peak demand', values: { name: 'Peak Demand', title: 'Peak Demand', metric: 'peak', period: 'today', decimal: 2, compareMode: 'none' } },
  { toolType: 'kpicard', label: 'Total Cost', description: 'KPI card for total cost', values: { name: 'Total Cost', title: 'Total Cost', bindingSource: 'tag', metric: 'usage', period: 'thisMonth', decimal: 2, compareMode: 'none', unit: 'THB' } },
  { toolType: 'kpicard', label: 'Carbon', description: 'KPI card for carbon', values: { name: 'Carbon', title: 'Carbon', bindingSource: 'formula', formula: 'A * 0.4999', decimal: 2, compareMode: 'none', unit: 'kgCO2e' } },
  { toolType: 'trend', label: 'Daily Load Profile', description: 'Trend chart for daily load', values: { name: 'Daily Load Profile', tagIds: [], period: '24h', aggregation: 'avg', interval: '15m', chartStyle: 'line', showLegend: true, showGrid: true } },
  { toolType: 'trend', label: 'Monthly Energy Trend', description: 'Trend chart for monthly energy', values: { name: 'Monthly Energy Trend', tagIds: [], period: '30d', aggregation: 'avg', interval: '1d', chartStyle: 'line', showLegend: true, showGrid: true } },
  { toolType: 'trend', label: 'Voltage Trend', description: 'Trend chart for voltage', values: { name: 'Voltage Trend', tagIds: [], period: '24h', aggregation: 'avg', interval: '15m', chartStyle: 'line', showLegend: true, showGrid: true } },
  { toolType: 'tagtable', label: 'Current Tag Table', description: 'Table showing current tag values', values: { name: 'Current Tag Table', columns: ['tagName','value','unit','timestamp','quality'], repeatHeader: true, rowHeight: 28 } },
  { toolType: 'tagtable', label: 'Historical Summary Table', description: 'Table showing historical summary', values: { name: 'Historical Summary Table', dataSource: 'history', columns: ['tagName','value','unit','timestamp'], repeatHeader: true, rowHeight: 28 } },
  { toolType: 'meter_billing_table', label: 'Monthly Billing', description: 'Meter billing with monthly summary', values: { name: 'Monthly Billing', period: 'month', rateMode: 'flat', vatPercent: 7, currency: 'THB', decimal: 2, summaryRow: true, repeatHeader: true } },
  { toolType: 'meter_billing_table', label: 'Meter Reading', description: 'Meter reading table for billing', values: { name: 'Meter Reading', rateMode: 'flat', currency: 'THB', decimal: 2, repeatHeader: true } },
  { toolType: 'meter_billing_table', label: 'TOU Billing', description: 'TOU billing table', values: { name: 'TOU Billing', rateMode: 'tou', vatPercent: 7, currency: 'THB', decimal: 2, summaryRow: true, repeatHeader: true } },
  { toolType: 'alarmtable', label: 'Active Alarm', description: 'Active alarm table', values: { name: 'Active Alarm', mode: 'active', levelFilter: 'all', maxRows: 100, rowColorByLevel: true, repeatHeader: true } },
  { toolType: 'alarmtable', label: 'Alarm History', description: 'Alarm history table', values: { name: 'Alarm History', mode: 'history', levelFilter: 'all', maxRows: 100, rowColorByLevel: true, repeatHeader: true } },
];

export function getPresetsForTool(toolType: string) {
  const resolvedToolType = resolveReportToolType(toolType);
  return REPORT_TOOL_SETTING_PRESETS.filter((preset) => resolveReportToolType(preset.toolType) === resolvedToolType);
}
