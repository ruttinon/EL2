import { reportSettingDefaults } from './reportSettingDefaults';
import type { ReportToolSettingsRegistry, ReportToolSettingsSchema } from './reportSettingTypes';

export const TOOL_TYPE_ALIASES: Record<string, string> = {
  kpi_value: 'value',
  formulavalue: 'formula',
  graph: 'trend',
  table: 'tagtable',
  alarm_table: 'alarmtable',
  shape: 'rectangle',
  circle: 'rectangle',
  polygon: 'rectangle',
  panel: 'rectangle',
};

export const REPORT_TOOL_SETTINGS_REGISTRY: ReportToolSettingsRegistry = reportSettingDefaults;

export function resolveReportToolType(toolType: string): string {
  return TOOL_TYPE_ALIASES[toolType] ?? toolType;
}

export function getReportToolSettingsSchema(toolType: string): ReportToolSettingsSchema | undefined {
  return REPORT_TOOL_SETTINGS_REGISTRY[resolveReportToolType(toolType)];
}
