export type ExportLevel = 'supported' | 'planned' | 'web_only' | 'unsupported';

export interface SupportStatus {
  editor: ExportLevel;
  pdf: ExportLevel;
  excel: ExportLevel;
  web: ExportLevel;
}

export const REPORT_EXPORT_SUPPORT_MATRIX: Record<string, SupportStatus> = {
  // Layout & Shapes
  text: { editor: 'supported', pdf: 'supported', excel: 'unsupported', web: 'supported' },
  image: { editor: 'supported', pdf: 'supported', excel: 'unsupported', web: 'supported' },
  line: { editor: 'supported', pdf: 'supported', excel: 'unsupported', web: 'supported' },
  rectangle: { editor: 'supported', pdf: 'supported', excel: 'unsupported', web: 'supported' },
  circle: { editor: 'supported', pdf: 'supported', excel: 'unsupported', web: 'supported' },
  polygon: { editor: 'supported', pdf: 'supported', excel: 'unsupported', web: 'supported' },
  
  // Date & Page Numbers
  date: { editor: 'supported', pdf: 'supported', excel: 'unsupported', web: 'supported' },
  page_number: { editor: 'supported', pdf: 'supported', excel: 'unsupported', web: 'supported' },
  signature: { editor: 'supported', pdf: 'supported', excel: 'unsupported', web: 'supported' },
  qrcode: { editor: 'supported', pdf: 'supported', excel: 'unsupported', web: 'supported' },
  
  // Tag / Numeric fields
  value: { editor: 'supported', pdf: 'supported', excel: 'supported', web: 'supported' },
  kpicard: { editor: 'supported', pdf: 'supported', excel: 'supported', web: 'supported' },
  formulavalue: { editor: 'supported', pdf: 'supported', excel: 'supported', web: 'supported' },
  
  // Tables & Charts
  trend: { editor: 'supported', pdf: 'supported', excel: 'unsupported', web: 'supported' },
  echart: { editor: 'supported', pdf: 'supported', excel: 'unsupported', web: 'supported' },
  tagtable: { editor: 'supported', pdf: 'supported', excel: 'supported', web: 'supported' },
  alarmtable: { editor: 'supported', pdf: 'supported', excel: 'unsupported', web: 'supported' },
  meter_billing_table: { editor: 'supported', pdf: 'supported', excel: 'supported', web: 'supported' },
  energy_summary: { editor: 'supported', pdf: 'supported', excel: 'supported', web: 'supported' },
  cost_summary: { editor: 'supported', pdf: 'supported', excel: 'supported', web: 'supported' },
  carbon_summary: { editor: 'supported', pdf: 'supported', excel: 'supported', web: 'supported' },
  device_status_table: { editor: 'supported', pdf: 'supported', excel: 'supported', web: 'supported' },
  meter_reading_table: { editor: 'supported', pdf: 'supported', excel: 'supported', web: 'supported' },
  project_info_box: { editor: 'supported', pdf: 'supported', excel: 'unsupported', web: 'supported' },
  company_header: { editor: 'supported', pdf: 'supported', excel: 'unsupported', web: 'supported' },
  report_footer: { editor: 'supported', pdf: 'supported', excel: 'unsupported', web: 'supported' },
  approval_block: { editor: 'supported', pdf: 'supported', excel: 'unsupported', web: 'supported' },
  remark_box: { editor: 'supported', pdf: 'supported', excel: 'unsupported', web: 'supported' },

  // Web Only Controls
  button: { editor: 'supported', pdf: 'web_only', excel: 'unsupported', web: 'supported' },
  switch: { editor: 'supported', pdf: 'web_only', excel: 'unsupported', web: 'supported' },
  slider: { editor: 'supported', pdf: 'web_only', excel: 'unsupported', web: 'supported' },
  inputfield: { editor: 'supported', pdf: 'web_only', excel: 'unsupported', web: 'supported' },
  dropdown: { editor: 'supported', pdf: 'web_only', excel: 'unsupported', web: 'supported' },
  tabbar: { editor: 'supported', pdf: 'web_only', excel: 'unsupported', web: 'supported' },
  video: { editor: 'supported', pdf: 'web_only', excel: 'unsupported', web: 'supported' },
  iframe: { editor: 'supported', pdf: 'web_only', excel: 'unsupported', web: 'supported' },
  gauge: { editor: 'supported', pdf: 'web_only', excel: 'unsupported', web: 'supported' },
  progressbar: { editor: 'supported', pdf: 'web_only', excel: 'unsupported', web: 'supported' },
  levelbar: { editor: 'supported', pdf: 'web_only', excel: 'unsupported', web: 'supported' },
  clock: { editor: 'supported', pdf: 'web_only', excel: 'unsupported', web: 'supported' },
  multistate: { editor: 'supported', pdf: 'web_only', excel: 'unsupported', web: 'supported' },
  semaphore: { editor: 'supported', pdf: 'web_only', excel: 'unsupported', web: 'supported' },
  status: { editor: 'supported', pdf: 'web_only', excel: 'unsupported', web: 'supported' },
  statusbadge: { editor: 'supported', pdf: 'web_only', excel: 'unsupported', web: 'supported' },
  hotspot: { editor: 'supported', pdf: 'web_only', excel: 'unsupported', web: 'supported' }
};

export function getExportSupport(type: string): SupportStatus {
  return REPORT_EXPORT_SUPPORT_MATRIX[type] || {
    editor: 'supported',
    pdf: 'unsupported',
    excel: 'unsupported',
    web: 'supported'
  };
}
