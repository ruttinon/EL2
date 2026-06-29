import React from 'react';
import type { ReportObjectType } from '@energylink/shared-types';
import { REPORT_BILLING_FORMULA_TOKENS, REPORT_TAG_FORMULA_TOKENS } from '@energylink/shared-types';
import { Icon } from '@iconify/react';
import { listPaletteWidgets, type WidgetCategoryId, type WidgetDefinition } from '@energylink/widget-registry';
import { normalizeCommand } from '../../commandBus';

export type ReportToolCategory =
  | 'Layout'
  | 'Fields'
  | 'Charts'
  | 'Tables'
  | 'Billing'
  | 'Symbols'
  | 'Media'
  | 'Controls'
  | 'Navigation'
  | 'Advanced'
  | 'Report';

export type ReportToolCategoryMeta = {
  title: string;
  hint?: string;
  /** Collapsed by default in the tool sidebar */
  defaultCollapsed?: boolean;
};

export const REPORT_TOOL_CATEGORY_META: Record<ReportToolCategory, ReportToolCategoryMeta> = {
  Layout: { title: 'เลย์เอาต์' },
  Fields: { title: 'ฟิลด์' },
  Charts: { title: 'กราฟ' },
  Tables: { title: 'ตาราง' },
  Billing: { title: 'สรุปค่าไฟ', defaultCollapsed: true },
  Symbols: { title: 'สัญลักษณ์', defaultCollapsed: true },
  Media: { title: 'มีเดีย', defaultCollapsed: true },
  Controls: { title: 'คอนโทรล', defaultCollapsed: true },
  Navigation: { title: 'นำทาง', defaultCollapsed: true },
  Advanced: { title: 'ขั้นสูง', defaultCollapsed: true },
  Report: { title: 'รายงาน' },
};

export type ReportToolDefinition = {
  type: ReportObjectType;
  label: string;
  icon: React.ReactNode;
  category: ReportToolCategory;
  /** Ribbon / legacy command labels that should add this object */
  aliases?: string[];
  hint?: string;
};

function toolIcon(icon: string, color: string) {
  return <Icon icon={icon} width="20" height="20" style={{ color }} />;
}

const WIDGET_CATEGORY_TO_REPORT_CATEGORY: Record<WidgetCategoryId, ReportToolCategory> = {
  layout: 'Layout',
  shape: 'Layout',
  text: 'Layout',
  values: 'Fields',
  charts: 'Charts',
  tables: 'Tables',
  controls: 'Controls',
  'symbols.electrical': 'Symbols',
  'symbols.mechanical': 'Symbols',
  media: 'Media',
  effects: 'Advanced',
  navigation: 'Navigation',
  custom: 'Advanced',
};

const REPORT_TOOL_LABELS: Record<string, string> = {
  text: 'ข้อความ',
  rectangle: 'สี่เหลี่ยม',
  circle: 'วงกลม',
  polygon: 'หลายเหลี่ยม',
  line: 'เส้น',
  image: 'รูป',
  panel: 'Panel',
  group: 'กลุ่ม',
  value: 'ค่า Tag',
  gauge: 'Gauge',
  progressbar: 'Progress',
  levelbar: 'Level',
  kpicard: 'KPI',
  multistate: 'หลายสถานะ',
  semaphore: 'ไฟสถานะ',
  status: 'สถานะ',
  statusbadge: 'Badge สถานะ',
  clock: 'นาฬิกา',
  formulavalue: 'สูตร',
  echart: 'กราฟ',
  trend: 'เทรนด์',
  tagtable: 'ตารางข้อมูล',
  alarmtable: 'ตารางแจ้งเตือน',
  elecsymbol: 'สัญลักษณ์ไฟฟ้า',
  flowpath: 'เส้น Flow',
  bussection: 'Bus',
  feedlabel: 'Feeder Label',
  zone2d: 'Zone',
  hotspot: 'Hotspot',
  video: 'วิดีโอ',
  iframe: 'เว็บ/iframe',
  button: 'ปุ่ม',
  switch: 'สวิตช์',
  slider: 'Slider',
  inputfield: 'ช่องกรอก',
  dropdown: 'Dropdown',
  tabbar: 'Tab bar',
};

const REPORT_TOOL_ALIASES: Record<string, string[]> = {
  rectangle: ['shape', 'กรอบ'],
  value: ['value', 'value text', 'kpi value', 'tag field', 'tag'],
  formulavalue: ['formula', 'สูตรคำนวณ'],
  trend: ['graph', 'trend'],
  echart: ['e-chart', 'e chart', 'chart'],
  tagtable: ['table', 'tag table', 'data table'],
  alarmtable: ['alarm table', 'alarm_table'],
};

function reportToolFromWidget(def: WidgetDefinition): ReportToolDefinition {
  const type = def.objectType as ReportObjectType;
  const id = def.id;
  return {
    type,
    label: REPORT_TOOL_LABELS[id] ?? REPORT_TOOL_LABELS[String(type)] ?? def.display.label,
    category: WIDGET_CATEGORY_TO_REPORT_CATEGORY[def.category] ?? 'Advanced',
    icon: toolIcon(`lucide:${def.display.icon}`, def.display.color),
    aliases: [id, String(type), ...(def.aliases ?? []), ...(def.display.keywords ?? []), ...(REPORT_TOOL_ALIASES[id] ?? [])],
    hint: def.display.hint,
  };
}

const REPORT_ONLY_TOOLS: ReportToolDefinition[] = [
  { type: 'date', label: 'วันที่', category: 'Report', icon: toolIcon('solar:calendar-bold-duotone', '#f59e0b') },
  { type: 'page_number', label: 'เลขหน้า', category: 'Report', icon: toolIcon('solar:document-bold-duotone', '#3b82f6'), aliases: ['page number', 'page no'] },
  { type: 'signature', label: 'ลายเซ็น', category: 'Report', icon: toolIcon('solar:pen-bold-duotone', '#8b5cf6') },
  { type: 'qrcode', label: 'QR', category: 'Report', icon: toolIcon('solar:qr-code-bold-duotone', '#14b8a6'), aliases: ['qr code'] },
  {
    type: 'meter_billing_table',
    label: 'ตารางมิเตอร์',
    category: 'Billing',
    icon: toolIcon('solar:document-text-bold-duotone', '#087c8b'),
    aliases: ['meter table', 'meter billing', 'billing table'],
  },
  { type: 'energy_summary', label: 'สรุปพลังงาน', category: 'Billing', icon: toolIcon('solar:bolt-bold-duotone', '#f59e0b'), aliases: ['energy'] },
  { type: 'cost_summary', label: 'สรุปค่าใช้จ่าย', category: 'Billing', icon: toolIcon('solar:wallet-money-bold-duotone', '#10b981'), aliases: ['cost'] },
];

function uniqueReportTools(tools: ReportToolDefinition[]): ReportToolDefinition[] {
  const seen = new Set<string>();
  return tools.filter((tool) => {
    const key = String(tool.type);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Single source of truth for report designer tools: Graphic registry + report-only tools. */
export const REPORT_OBJECT_TOOLS: ReportToolDefinition[] = uniqueReportTools([
  ...listPaletteWidgets().map(reportToolFromWidget),
  ...REPORT_ONLY_TOOLS,
]);

const ALL_REPORT_TOOL_CATEGORIES: ReportToolCategory[] = [
  'Layout',
  'Fields',
  'Charts',
  'Tables',
  'Billing',
  'Report',
  'Symbols',
  'Media',
  'Controls',
  'Navigation',
  'Advanced',
];

export const REPORT_TOOL_CATEGORIES: ReportToolCategory[] = ALL_REPORT_TOOL_CATEGORIES.filter((category) =>
  REPORT_OBJECT_TOOLS.some((tool) => tool.category === category),
);

export function defaultCollapsedReportToolCategories(): Set<ReportToolCategory> {
  return new Set(
    REPORT_TOOL_CATEGORIES.filter((cat) => REPORT_TOOL_CATEGORY_META[cat].defaultCollapsed),
  );
}

export function resolveReportObjectType(command: string): ReportObjectType | undefined {
  const normalized = normalizeCommand(command);
  for (const tool of REPORT_OBJECT_TOOLS) {
    if (normalizeCommand(tool.label) === normalized) return tool.type;
    for (const alias of tool.aliases ?? []) {
      if (normalizeCommand(alias) === normalized) return tool.type;
    }
  }
  return undefined;
}

export function getReportTool(type: ReportObjectType): ReportToolDefinition | undefined {
  return REPORT_OBJECT_TOOLS.find((tool) => tool.type === type);
}

type LeftPanelItem = { label: string; icon: React.ReactNode; wide?: boolean; primary?: boolean };

/** Left sidebar groups for App shell (when panels are enabled). */
export function buildReportLeftToolPanels(): Array<{ title?: string; items: LeftPanelItem[] }> {
  const objectPanels = REPORT_TOOL_CATEGORIES.map((category) => ({
    title: REPORT_TOOL_CATEGORY_META[category].title,
    items: REPORT_OBJECT_TOOLS
      .filter((tool) => tool.category === category)
      .map((tool) => ({ label: tool.label, icon: tool.icon })),
  }));

  return [
    ...objectPanels,
    {
      title: 'Report',
      items: [
        { label: 'New Report', icon: toolIcon('solar:document-add-bold-duotone', '#3b82f6') },
        { label: 'Set Default', icon: toolIcon('solar:star-bold-duotone', '#f59e0b') },
        { label: 'Export Template', icon: toolIcon('solar:download-bold-duotone', '#8b5cf6') },
        { label: 'Delete', icon: toolIcon('solar:trash-bin-trash-bold-duotone', '#ef4444') },
      ],
    },
    {
      title: 'Selected Object',
      items: [
        { label: 'Duplicate', icon: toolIcon('solar:copy-bold-duotone', '#6366f1') },
        { label: 'Bring Front', icon: toolIcon('solar:round-alt-arrow-up-bold-duotone', '#10b981') },
        { label: 'Send Back', icon: toolIcon('solar:round-alt-arrow-down-bold-duotone', '#ef4444') },
        { label: 'Delete Object', icon: toolIcon('solar:trash-bin-trash-bold-duotone', '#ef4444') },
      ],
    },
  ];
}

/** Billing + tag formula variables for inspector insert menus. */
export const REPORT_FORMULA_INSERT_TOKENS = [
  ...REPORT_BILLING_FORMULA_TOKENS,
  ...REPORT_TAG_FORMULA_TOKENS,
] as const;

/** @deprecated use REPORT_FORMULA_INSERT_TOKENS */
export const REPORT_BILLING_FORMULA_VARS = REPORT_BILLING_FORMULA_TOKENS;

/** Object types that bind to tag / history data in the designer. */
export const REPORT_DATA_BOUND_TYPES = new Set<ReportObjectType>([
  'table',
  'graph',
  'tagtable',
  'trend',
  'echart',
  'value',
  'kpicard',
  'formulavalue',
  'formula',
  'kpi_value',
  'energy_summary',
  'cost_summary',
  'alarm_table',
  'alarmtable',
  'meter_billing_table',
]);
