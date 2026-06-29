import React from 'react';
import { Icon } from '@iconify/react';
import type { ReportSummary, TagSummary } from '@energylink/shared-types';
import type { TariffSummary } from '../../api/billingApi';
import type { SpreadsheetPreviewResult, SpreadsheetSheetSnapshot } from '../../api/reportsSpreadsheetApi';
import type { ReportToolCategory } from './reportTools';

type SpreadsheetBinding = {
  id: string;
  sheetName: string;
  cell: string;
  kind: 'report_meta' | 'tag_metric' | 'billing_metric' | 'text_template';
  config?: Record<string, unknown>;
  format?: {
    decimalPlaces?: number;
    prefix?: string;
    suffix?: string;
    asText?: boolean;
  };
  fallbackText?: string;
};

type SpreadsheetTemplate = {
  version?: number;
  mode?: string;
  pages?: any[];
  spreadsheet?: {
    source?: {
      kind?: string;
      relativePath?: string;
      originalFileName?: string;
      uploadedAt?: string;
    };
    snapshot?: {
      sheets: SpreadsheetSheetSnapshot[];
    };
    bindings?: SpreadsheetBinding[];
    export?: Record<string, unknown>;
  };
};

type Props = {
  report: ReportSummary;
  reports: ReportSummary[];
  loading: boolean;
  reportSearch: string;
  onReportSearchChange(value: string): void;
  onSelectReport(reportId: string): void;
  onCreateReport(): void;
  onDeleteReport(): void;
  onReportUpdated(report: ReportSummary): void;
  onUpdateReportField(
    field: keyof Pick<ReportSummary, 'name' | 'reportType' | 'paperSize' | 'orientation' | 'defaultDateRange' | 'outputFormat'>,
    value: string,
  ): Promise<void>;
  onExport(format: 'pdf' | 'excel'): Promise<void>;
  onNotice(message: string): void;
  onError(message: string): void;
  generateBusy: boolean;
  tags: TagSummary[];
  tariffs: TariffSummary[];
  reportTariffId: string;
  onReportTariffChange(value: string): void;
};

type BindingFormState = {
  kind: SpreadsheetBinding['kind'];
  tagId: string;
  tagMetric: string;
  reportField: string;
  billingMetric: string;
  templateText: string;
  decimalPlaces: string;
  prefix: string;
  suffix: string;
  fallbackText: string;
  asText: boolean;
};

// ─── Sheet Tool Definition ─────────────────────────────────────────
type SheetToolDef = {
  type: string;
  label: string;
  icon: string;
  category: SpreadsheetToolCategory;
  description: string;
  defaultKind: SpreadsheetBinding['kind'];
  defaultConfig: Record<string, unknown>;
  defaultFormat?: SpreadsheetBinding['format'];
  hint?: string;
};

type SpreadsheetToolCategory = 'fields' | 'tables' | 'billing' | 'labels';

const SHEET_TOOL_CATEGORY_META: Record<SpreadsheetToolCategory, { title: string; color: string }> = {
  fields: { title: 'ค่าข้อมูล', color: '#2563eb' },
  tables: { title: 'ตาราง', color: '#7c3aed' },
  billing: { title: 'ค่าไฟ', color: '#059669' },
  labels: { title: 'ป้ายกำกับ', color: '#d97706' },
};

const SHEET_TOOLS: SheetToolDef[] = [
  // Fields
  { type: 'tag_value', label: 'ค่า Tag', icon: 'solar:tag-bold-duotone', category: 'fields', description: 'ค่าล่าสุด, ค่าเฉลี่ย, Min/Max', defaultKind: 'tag_metric', defaultConfig: { metric: 'last' }, defaultFormat: { decimalPlaces: 2 } },
  { type: 'tag_usage', label: 'ปริมาณการใช้', icon: 'solar:chart-square-bold-duotone', category: 'fields', description: 'ผลรวมการใช้ในช่วงเวลา', defaultKind: 'tag_metric', defaultConfig: { metric: 'usage' }, defaultFormat: { decimalPlaces: 2 } },
  { type: 'tag_min', label: 'ค่าต่ำสุด', icon: 'solar:arrow-down-bold-duotone', category: 'fields', description: 'ค่าต่ำสุดในช่วงเวลา', defaultKind: 'tag_metric', defaultConfig: { metric: 'min' }, defaultFormat: { decimalPlaces: 2 } },
  { type: 'tag_max', label: 'ค่าสูงสุด', icon: 'solar:arrow-up-bold-duotone', category: 'fields', description: 'ค่าสูงสุดในช่วงเวลา', defaultKind: 'tag_metric', defaultConfig: { metric: 'max' }, defaultFormat: { decimalPlaces: 2 } },
  { type: 'tag_avg', label: 'ค่าเฉลี่ย', icon: 'solar:calculator-minimalistic-bold-duotone', category: 'fields', description: 'ค่าเฉลี่ยในช่วงเวลา', defaultKind: 'tag_metric', defaultConfig: { metric: 'avg' }, defaultFormat: { decimalPlaces: 2 } },
  // Tables
  { type: 'meter_billing_table', label: 'ตารางค่าไฟมิเตอร์', icon: 'solar:table-bold-duotone', category: 'tables', description: 'ตารางแสดงค่ามิเตอร์ทั้งหมด', defaultKind: 'billing_metric', defaultConfig: { metric: 'grandTotal' }, defaultFormat: { decimalPlaces: 2 } },
  { type: 'energy_summary', label: 'สรุปพลังงาน', icon: 'solar:bolt-bold-duotone', category: 'tables', description: 'สรุปพลังงานรวม (kWh)', defaultKind: 'billing_metric', defaultConfig: { metric: 'totalKwh' }, defaultFormat: { decimalPlaces: 2, suffix: ' kWh' } },
  // Billing
  { type: 'cost_total', label: 'รวมค่าใช้จ่าย', icon: 'solar:wallet-bold-duotone', category: 'billing', description: 'ยอดรวมค่าไฟทั้งหมด', defaultKind: 'billing_metric', defaultConfig: { metric: 'grandTotal' }, defaultFormat: { decimalPlaces: 2, prefix: '฿' } },
  { type: 'cost_energy', label: 'ค่าพลังงาน', icon: 'solar:wallet-money-bold-duotone', category: 'billing', description: 'ค่าใช้จ่ายด้านพลังงาน', defaultKind: 'billing_metric', defaultConfig: { metric: 'energyCost' }, defaultFormat: { decimalPlaces: 2, prefix: '฿' } },
  { type: 'cost_demand', label: 'ค่า Demand', icon: 'solar:chart-2-bold-duotone', category: 'billing', description: 'ค่า Demand', defaultKind: 'billing_metric', defaultConfig: { metric: 'demandCost' }, defaultFormat: { decimalPlaces: 2, prefix: '฿' } },
  { type: 'vat', label: 'VAT', icon: 'solar:percent-bold-duotone', category: 'billing', description: 'ภาษีมูลค่าเพิ่ม', defaultKind: 'billing_metric', defaultConfig: { metric: 'vat' }, defaultFormat: { decimalPlaces: 2 } },
  // Labels
  { type: 'report_name', label: 'ชื่อรายงาน', icon: 'solar:document-text-bold-duotone', category: 'labels', description: 'ชื่อรายงาน', defaultKind: 'report_meta', defaultConfig: { field: 'reportName' } },
  { type: 'generated_date', label: 'วันที่สร้าง', icon: 'solar:calendar-date-bold-duotone', category: 'labels', description: 'วันที่สร้างรายงาน', defaultKind: 'report_meta', defaultConfig: { field: 'generatedAt' } },
  { type: 'period_label', label: 'ช่วงเวลา', icon: 'solar:clock-circle-bold-duotone', category: 'labels', description: 'ป้ายกำกับช่วงเวลา', defaultKind: 'report_meta', defaultConfig: { field: 'periodLabel' } },
  { type: 'project_name', label: 'ชื่อโปรเจกต์', icon: 'solar:folder-bold-duotone', category: 'labels', description: 'ชื่อโปรเจกต์ปัจจุบัน', defaultKind: 'report_meta', defaultConfig: { field: 'projectName' } },
  { type: 'custom_text', label: 'ข้อความกำหนดเอง', icon: 'solar:text-bold-duotone', category: 'labels', description: 'ข้อความที่กำหนดเอง', defaultKind: 'text_template', defaultConfig: { text: 'ข้อความของคุณ' } },
];

const DEFAULT_COLLAPSED_SHEET_CATEGORIES = new Set<SpreadsheetToolCategory>(['tables', 'billing']);

function getSheetTool(type: string): SheetToolDef | undefined {
  return SHEET_TOOLS.find((t) => t.type === type);
}

// ─── Helpers ────────────────────────────────────────────────────────
function defaultPages() {
  return [{
    id: 'page_1',
    name: 'Page 1',
    width: 1123,
    height: 794,
    backgroundColor: '#ffffff',
    objects: [],
  }];
}

function blankSnapshot(): { sheets: SpreadsheetSheetSnapshot[] } {
  return {
    sheets: [{
      id: 'sheet_1',
      name: 'Sheet1',
      rowCount: 20,
      colCount: 10,
      usedRange: 'A1:J20',
      columns: Array.from({ length: 10 }, (_, index) => ({ index: index + 1, width: 14 })),
      merges: [],
      cells: [],
    }],
  };
}

function parseTemplate(report: ReportSummary): SpreadsheetTemplate {
  const template = report?.template;
  return template && typeof template === 'object' ? template as SpreadsheetTemplate : {};
}

function ensureSpreadsheetTemplate(report: ReportSummary): SpreadsheetTemplate {
  const template = parseTemplate(report);
  return {
    ...template,
    version: Math.max(Number(template.version ?? 1), 2),
    mode: 'spreadsheet',
    pages: Array.isArray(template.pages) && template.pages.length ? template.pages : defaultPages(),
    spreadsheet: {
      source: template.spreadsheet?.source,
      snapshot: template.spreadsheet?.snapshot?.sheets?.length ? template.spreadsheet.snapshot : blankSnapshot(),
      bindings: Array.isArray(template.spreadsheet?.bindings) ? template.spreadsheet.bindings : [],
      export: template.spreadsheet?.export ?? {
        pdf: { sheetMode: 'all', fitToPage: true, showGridLines: false },
        excel: { preserveFormulas: true },
      },
    },
  };
}

function columnLetters(index: number) {
  let value = Math.max(1, Math.trunc(index));
  let result = '';
  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
}

function cellAddress(row: number, col: number) {
  return `${columnLetters(col)}${row}`;
}

function emptyFormState(): BindingFormState {
  return {
    kind: 'tag_metric',
    tagId: '',
    tagMetric: 'last',
    reportField: 'reportName',
    billingMetric: 'grandTotal',
    templateText: '{{report.name}}',
    decimalPlaces: '2',
    prefix: '',
    suffix: '',
    fallbackText: '',
    asText: false,
  };
}

function bindingToForm(binding: SpreadsheetBinding | undefined): BindingFormState {
  if (!binding) return emptyFormState();
  return {
    kind: binding.kind,
    tagId: String(binding.config?.tagId ?? ''),
    tagMetric: String(binding.config?.metric ?? 'last'),
    reportField: String(binding.config?.field ?? 'reportName'),
    billingMetric: String(binding.config?.metric ?? 'grandTotal'),
    templateText: String(binding.config?.text ?? '{{report.name}}'),
    decimalPlaces: String(binding.format?.decimalPlaces ?? 2),
    prefix: String(binding.format?.prefix ?? ''),
    suffix: String(binding.format?.suffix ?? ''),
    fallbackText: String(binding.fallbackText ?? ''),
    asText: binding.format?.asText === true,
  };
}

async function readFileAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file.'));
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const base64 = result.includes(',') ? result.split(',')[1] ?? '' : result;
      resolve(base64);
    };
    reader.readAsDataURL(file);
  });
}

// ─── Import Drop Zone Component ────────────────────────────────────
function ImportDropZone({
  onImport,
  onStartBlank,
}: {
  onImport(file: File): void;
  onStartBlank(): void;
}) {
  const [dragging, setDragging] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flex: 1,
      minHeight: 400,
      padding: 40,
    }}>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) onImport(file);
        }}
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: `3px dashed ${dragging ? '#2563eb' : '#cbd5e1'}`,
          borderRadius: 20,
          padding: '60px 48px',
          textAlign: 'center',
          cursor: 'pointer',
          background: dragging ? '#eff6ff' : '#fafbfc',
          transition: 'all 0.2s ease',
          maxWidth: 520,
          width: '100%',
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.csv"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onImport(file);
          }}
        />
        <Icon icon="solar:upload-square-bold-duotone" width="64" height="64" style={{ color: dragging ? '#2563eb' : '#94a3b8', marginBottom: 16 }} />
        <div style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', marginBottom: 8 }}>
          วางไฟล์ Excel หรือ CSV ที่นี่
        </div>
        <div style={{ fontSize: 14, color: '#64748b', marginBottom: 20 }}>
          หรือคลิกเพื่อเลือกไฟล์จากเครื่อง
        </div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 20 }}>
          <span style={{ background: '#e2e8f0', padding: '6px 14px', borderRadius: 8, fontSize: 13, color: '#475569' }}>.xlsx</span>
          <span style={{ background: '#e2e8f0', padding: '6px 14px', borderRadius: 8, fontSize: 13, color: '#475569' }}>.csv</span>
        </div>
        <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 20, marginTop: 8 }}>
          <button
            type="button"
            className="btn secondary"
            onClick={(e) => {
              e.stopPropagation();
              onStartBlank();
            }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Icon icon="solar:add-square-bold-duotone" width="16" height="16" />
            หรือเริ่มต้นด้วยตารางเปล่า
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Sheet Tool Palette ─────────────────────────────────────────────
function SheetToolPalette({
  activeToolType,
  onSelectTool,
  collapsedCategories,
  onToggleCategory,
  disabled,
}: {
  activeToolType: string | null;
  onSelectTool(type: string): void;
  collapsedCategories: Set<SpreadsheetToolCategory>;
  onToggleCategory(cat: SpreadsheetToolCategory): void;
  disabled: boolean;
}) {
  return (
    <div style={{ padding: 8 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', textTransform: 'uppercase', marginBottom: 8, padding: '0 4px' }}>
        เครื่องมือ Spreadsheet
      </div>
      <div style={{
        background: '#f1f5f9',
        borderRadius: 8,
        padding: '6px 8px',
        marginBottom: 12,
        fontSize: 12,
        color: '#475569',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}>
        <Icon icon="solar:info-circle-bold-duotone" width="14" height="14" style={{ color: '#3b82f6', flexShrink: 0 }} />
        <span>เลือกเครื่องมือ แล้วคลิกเซลล์ในตาราง</span>
      </div>
      {(Object.keys(SHEET_TOOL_CATEGORY_META) as SpreadsheetToolCategory[]).map((cat) => {
        const meta = SHEET_TOOL_CATEGORY_META[cat];
        const collapsed = collapsedCategories.has(cat);
        const catTools = SHEET_TOOLS.filter((t) => t.category === cat);
        if (catTools.length === 0) return null;
        return (
          <div key={cat} style={{ marginBottom: 4 }}>
            <button
              type="button"
              onClick={() => onToggleCategory(cat)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                padding: '6px 8px',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                fontSize: 11,
                fontWeight: 600,
                color: meta.color,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              <span>{meta.title}</span>
              <Icon icon={collapsed ? 'solar:alt-arrow-right-linear' : 'solar:alt-arrow-down-linear'} width={14} height={14} />
            </button>
            {!collapsed && (
              <div style={{ display: 'grid', gap: 4 }}>
                {catTools.map((tool) => (
                  <button
                    key={tool.type}
                    type="button"
                    disabled={disabled}
                    onClick={() => onSelectTool(tool.type)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 10px',
                      borderRadius: 8,
                      border: activeToolType === tool.type ? `2px solid ${meta.color}` : '1px solid transparent',
                      background: activeToolType === tool.type ? '#ffffff' : 'transparent',
                      cursor: disabled ? 'not-allowed' : 'pointer',
                      opacity: disabled ? 0.5 : 1,
                      transition: 'all 0.15s ease',
                      textAlign: 'left',
                      width: '100%',
                    }}
                    title={tool.description}
                  >
                    <Icon icon={tool.icon} width="20" height="20" style={{ color: meta.color, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#1e293b' }}>{tool.label}</div>
                      <div style={{ fontSize: 10, color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tool.description}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Binding Kind Icon ──────────────────────────────────────────────
function bindingKindIcon(kind: SpreadsheetBinding['kind']): string {
  switch (kind) {
    case 'tag_metric': return 'solar:tag-bold-duotone';
    case 'billing_metric': return 'solar:wallet-bold-duotone';
    case 'report_meta': return 'solar:document-text-bold-duotone';
    case 'text_template': return 'solar:text-bold-duotone';
  }
}

function bindingKindColor(kind: SpreadsheetBinding['kind']): string {
  switch (kind) {
    case 'tag_metric': return '#2563eb';
    case 'billing_metric': return '#059669';
    case 'report_meta': return '#d97706';
    case 'text_template': return '#7c3aed';
  }
}

// ─── Main Component ─────────────────────────────────────────────────
export function SpreadsheetReportWorkspace({
  report,
  reports,
  loading,
  reportSearch,
  onReportSearchChange,
  onSelectReport,
  onCreateReport,
  onDeleteReport,
  onReportUpdated,
  onUpdateReportField,
  onExport,
  onNotice,
  onError,
  generateBusy,
  tags,
  tariffs,
  reportTariffId,
  onReportTariffChange,
}: Props) {
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [showImportZone, setShowImportZone] = React.useState(false);
  const template = ensureSpreadsheetTemplate(report);
  const bindings = template.spreadsheet?.bindings ?? [];
  const source = template.spreadsheet?.source;
  const [preview, setPreview] = React.useState<SpreadsheetPreviewResult | null>(null);
  const [selectedSheetName, setSelectedSheetName] = React.useState<string>(template.spreadsheet?.snapshot?.sheets?.[0]?.name ?? 'Sheet1');
  const [selectedCell, setSelectedCell] = React.useState('A1');
  const [form, setForm] = React.useState<BindingFormState>(() => emptyFormState());
  const [busyImport, setBusyImport] = React.useState(false);
  const [busyPreview, setBusyPreview] = React.useState(false);
  const [activeToolType, setActiveToolType] = React.useState<string | null>(null);
  const [collapsedToolCategories, setCollapsedToolCategories] = React.useState<Set<SpreadsheetToolCategory>>(DEFAULT_COLLAPSED_SHEET_CATEGORIES);
  const [editingAddress, setEditingAddress] = React.useState<string | null>(null);
  const [editingText, setEditingText] = React.useState('');
  const editInputRef = React.useRef<HTMLTextAreaElement | null>(null);

  const hasSource = Boolean(source?.relativePath) || bindings.length > 0;

  const visibleSheets = preview?.sheets?.length ? preview.sheets : (template.spreadsheet?.snapshot?.sheets ?? blankSnapshot().sheets);
  const selectedSheet = visibleSheets.find((sheet) => sheet.name === selectedSheetName) ?? visibleSheets[0];
  const selectedBinding = bindings.find((binding) => binding.sheetName === selectedSheetName && binding.cell === selectedCell);
  const selectedSheetCellMap = React.useMemo(() => (
    new Map((selectedSheet?.cells ?? []).map((entry) => [entry.address.toUpperCase(), entry]))
  ), [selectedSheet]);
  const selectedSheetColumnWidthMap = React.useMemo(() => (
    new Map((selectedSheet?.columns ?? []).map((entry) => [entry.index, Math.max(88, (entry.width ?? 14) * 7)]))
  ), [selectedSheet]);
  const visibleBindings = React.useMemo(() => (
    bindings.filter((binding) => !selectedSheetName || binding.sheetName === selectedSheetName)
  ), [bindings, selectedSheetName]);

  // Show import zone on first load if no source
  React.useEffect(() => {
    if (!hasSource && !showImportZone) {
      setShowImportZone(true);
    }
  }, [report.id]);

  React.useEffect(() => {
    const nextSheet = template.spreadsheet?.snapshot?.sheets?.[0]?.name ?? 'Sheet1';
    setSelectedSheetName(nextSheet);
    setSelectedCell('A1');
    setForm(bindingToForm(undefined));
    setPreview(null);
    setActiveToolType(null);
  }, [report.id]);

  React.useEffect(() => {
    setForm(bindingToForm(selectedBinding));
  }, [selectedBinding?.id, selectedSheetName, selectedCell]);

  React.useEffect(() => {
    if (!report.id || !hasSource) return;
    void refreshPreview(false);
  }, [report.id, reportTariffId, hasSource]);

  React.useEffect(() => {
    if (!editingAddress) return;
    const frame = window.requestAnimationFrame(() => editInputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [editingAddress]);

  async function saveTemplate(nextTemplate: SpreadsheetTemplate, notice?: string) {
    try {
      const updated = await window.energylink.reports.update({ id: report.id, template: nextTemplate });
      onReportUpdated(updated);
      if (notice) onNotice(notice);
      return updated;
    } catch (error) {
      onError(error instanceof Error ? error.message : String(error));
      return null;
    }
  }

  async function refreshPreview(showNotice = true) {
    setBusyPreview(true);
    try {
      const nextPreview = await window.energylink.reports.resolveSpreadsheetPreview({
        reportId: report.id,
        tariffId: reportTariffId || undefined,
      });
      setPreview(nextPreview);
      if (nextPreview.sheets.length && !nextPreview.sheets.some((sheet) => sheet.name === selectedSheetName)) {
        setSelectedSheetName(nextPreview.sheets[0].name);
      }
      if (showNotice) {
        const warningSuffix = nextPreview.warnings.length ? ` with ${nextPreview.warnings.length} warning(s)` : '';
        onNotice(`Spreadsheet preview refreshed${warningSuffix}.`);
      }
    } catch (error) {
      onError(error instanceof Error ? error.message : String(error));
    } finally {
      setBusyPreview(false);
    }
  }

  async function importFile(file: File) {
    setBusyImport(true);
    try {
      const base64 = await readFileAsBase64(file);
      const lower = file.name.toLowerCase();
      const kind = lower.endsWith('.csv') ? 'csv' : 'xlsx';
      const result = await window.energylink.reports.importSpreadsheetTemplate({
        reportId: report.id,
        filename: file.name,
        dataBase64: base64,
        kind,
      });
      onReportUpdated(result.report);
      setPreview(result.preview);
      setSelectedSheetName(result.preview.sheets[0]?.name ?? 'Sheet1');
      setSelectedCell('A1');
      setShowImportZone(false);
      onNotice(`นำเข้า ${file.name} สำเร็จ`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const friendly = message.includes('anchors')
        ? 'ไฟล์ Excel นี้ไม่รองรับ (อาจมี formula หรือ graph ที่ไม่สามารถอ่านได้) — ลองบันทึกเป็น CSV หรือลองไฟล์อื่น'
        : message;
      onError(friendly);
    } finally {
      setBusyImport(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function startBlankSheet() {
    const nextTemplate = ensureSpreadsheetTemplate(report);
    nextTemplate.spreadsheet = {
      ...nextTemplate.spreadsheet,
      source: { kind: 'blank', originalFileName: 'Blank workbook', relativePath: '', uploadedAt: new Date().toISOString() },
      snapshot: blankSnapshot(),
    };
    const updated = await saveTemplate(nextTemplate, 'เริ่มต้นตารางเปล่า');
    if (updated) {
      setShowImportZone(false);
      setPreview(null);
    }
  }

  /** Handle tool selection — enters "placement mode" */
  function handleSelectTool(type: string) {
    if (activeToolType === type) {
      setActiveToolType(null);
      return;
    }
    setActiveToolType(type);
    onNotice(`เลือก "${getSheetTool(type)?.label ?? type}" แล้ว — คลิกเซลล์ในตารางเพื่อวาง`);
  }

  /** Handle cell click — if in placement mode, apply binding */
  function handleCellClick(address: string) {
    if (activeToolType) {
      const tool = getSheetTool(activeToolType);
      if (!tool) {
        setActiveToolType(null);
        return;
      }
      setSelectedCell(address);
      // Pre-fill form based on tool
      const newForm: BindingFormState = {
        kind: tool.defaultKind,
        tagId: '',
        tagMetric: (tool.defaultConfig.metric as string) ?? 'last',
        reportField: (tool.defaultConfig.field as string) ?? 'reportName',
        billingMetric: (tool.defaultConfig.metric as string) ?? 'grandTotal',
        templateText: (tool.defaultConfig.text as string) ?? '{{report.name}}',
        decimalPlaces: String(tool.defaultFormat?.decimalPlaces ?? 2),
        prefix: tool.defaultFormat?.prefix ?? '',
        suffix: tool.defaultFormat?.suffix ?? '',
        fallbackText: '',
        asText: tool.defaultFormat?.asText ?? false,
      };
      setForm(newForm);
      setActiveToolType(null);
      onNotice(`วาง "${tool.label}" ที่ ${address} — ตั้งค่าแล้วกด Save`);
      return;
    }
    setSelectedCell(address);
    setForm(bindingToForm(selectedBinding));
  }

  async function upsertBinding() {
    if (!selectedSheet) {
      onError('Select a worksheet first.');
      return;
    }

    const id = selectedBinding?.id ?? `bind_${Date.now()}`;
    const nextBinding: SpreadsheetBinding = {
      id,
      sheetName: selectedSheet.name,
      cell: selectedCell,
      kind: form.kind,
      config: form.kind === 'report_meta'
        ? { field: form.reportField }
        : form.kind === 'billing_metric'
          ? { metric: form.billingMetric }
          : form.kind === 'text_template'
            ? { text: form.templateText }
            : { tagId: form.tagId, metric: form.tagMetric },
      format: {
        decimalPlaces: Number(form.decimalPlaces || '2'),
        prefix: form.prefix,
        suffix: form.suffix,
        asText: form.asText,
      },
      fallbackText: form.fallbackText || undefined,
    };

    if (form.kind === 'tag_metric' && !form.tagId) {
      onError('เลือก Tag ก่อนบันทึก');
      return;
    }

    const nextTemplate = ensureSpreadsheetTemplate(report);
    const currentBindings = nextTemplate.spreadsheet?.bindings ?? [];
    nextTemplate.spreadsheet = {
      ...nextTemplate.spreadsheet,
      bindings: [...currentBindings.filter((binding) => binding.id !== id), nextBinding],
    };

    const updated = await saveTemplate(nextTemplate, `บันทึก Binding ที่ ${selectedCell} แล้ว`);
    if (updated) {
      await refreshPreview(false);
    }
  }

  async function removeBinding() {
    if (!selectedBinding) return;
    const nextTemplate = ensureSpreadsheetTemplate(report);
    nextTemplate.spreadsheet = {
      ...nextTemplate.spreadsheet,
      bindings: (nextTemplate.spreadsheet?.bindings ?? []).filter((binding) => binding.id !== selectedBinding.id),
    };
    const updated = await saveTemplate(nextTemplate, `ลบ Binding ที่ ${selectedCell} แล้ว`);
    if (updated) {
      await refreshPreview(false);
    }
  }

  function selectedCellDisplay() {
    return selectedSheetCellMap.get(selectedCell.toUpperCase())?.display ?? '';
  }

  function startInlineEdit(address: string, currentText: string) {
    setEditingAddress(address);
    setEditingText(currentText);
  }

  async function confirmInlineEdit(address: string) {
    if (!editingAddress) return;
    try {
      const nextTemplate = ensureSpreadsheetTemplate(report);
      const nextSnapshot = nextTemplate.spreadsheet?.snapshot?.sheets?.length
        ? nextTemplate.spreadsheet.snapshot
        : blankSnapshot();
      const sheet = (nextSnapshot.sheets ?? []).find((s) => s.name === selectedSheetName) ?? nextSnapshot.sheets?.[0];
      if (!sheet) return;
      const upper = address.toUpperCase();
      const existing = (sheet.cells ?? []).find((entry) => entry.address.toUpperCase() === upper);
      const updatedRows = nextSnapshot.sheets.map((s) => {
        if (s.name !== sheet.name) return s;
        const nextCells = (s.cells ?? []).filter((entry) => entry.address.toUpperCase() !== upper);
        if (!editingText) return { ...s, cells: nextCells };
        const base = existing ?? { address: upper, display: editingText, row: 0, col: 0, style: {} };
        return { ...s, cells: [...nextCells, { ...base, display: editingText }] };
      });
      const next = await saveTemplate(
        {
          ...nextTemplate,
          spreadsheet: {
            ...nextTemplate.spreadsheet,
            snapshot: {
              ...(nextTemplate.spreadsheet?.snapshot ?? blankSnapshot()),
              sheets: updatedRows,
            },
          },
        },
        'บันทึกข้อความที่เซลล์',
      );
      setEditingAddress(null);
      setEditingText('');
      if (next) void refreshPreview(false);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
      cancelInlineEdit();
    }
  }

  function cancelInlineEdit() {
    setEditingAddress(null);
    setEditingText('');
  }

  const bindingMap = React.useMemo(() => {
    return new Map(bindings.map((binding) => [`${binding.sheetName}:${binding.cell}`, binding]));
  }, [bindings]);

  function toggleToolCategory(cat: SpreadsheetToolCategory) {
    setCollapsedToolCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }

  // ─── Render: Show Import Drop Zone ──────────────────────────────
  if (showImportZone) {
    return (
      <section className="report-main">
        <div className="report-designer-toolbar">
          <div className="report-designer-toolbar-group">
            <button type="button" className="btn primary small-btn" onClick={onCreateReport}>
              <Icon icon="solar:document-add-bold-duotone" width="14" height="14" /> New
            </button>
          </div>
          <div className="report-designer-toolbar-meta">
            <span>{report.name}</span>
          </div>
        </div>
        <ImportDropZone onImport={importFile} onStartBlank={startBlankSheet} />
      </section>
    );
  }

  // ─── Render: Main Spreadsheet UI ─────────────────────────────────
  return (
    <section className="report-main">
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.csv"
        style={{ display: 'none' }}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void importFile(file);
        }}
      />

      {/* Toolbar */}
      <div className="report-designer-toolbar">
        <div className="report-designer-toolbar-group">
          <button type="button" className="btn primary small-btn" onClick={() => fileInputRef.current?.click()} disabled={busyImport}>
            <Icon icon="solar:upload-bold-duotone" width="14" height="14" />
            {busyImport ? 'กำลังนำเข้า...' : 'นำเข้า Excel/CSV'}
          </button>
          <button type="button" className="btn secondary small-btn" onClick={() => void refreshPreview()} disabled={busyPreview}>
            <Icon icon="solar:refresh-bold-duotone" width="14" height="14" />
            {busyPreview ? 'กำลังโหลด...' : 'รีเฟรช'}
          </button>
        </div>
        <div className="report-designer-toolbar-group">
          <button type="button" className="btn primary small-btn" disabled={generateBusy} onClick={() => void onExport('pdf')}>
            <Icon icon="solar:file-text-bold-duotone" width="14" height="14" />
            PDF
          </button>
          <button type="button" className="btn secondary small-btn" disabled={generateBusy} onClick={() => void onExport('excel')}>
            <Icon icon="solar:document-bold-duotone" width="14" height="14" />
            Excel
          </button>
        </div>
        <div className="report-designer-toolbar-meta">
          <span>{report.name}</span>
          <span>{source?.originalFileName ?? 'Blank workbook'}</span>
          {activeToolType && (
            <span style={{ color: '#2563eb', fontWeight: 600 }}>
              <Icon icon="solar:mouse-bold-duotone" width="14" height="14" style={{ verticalAlign: 'middle', marginRight: 4 }} />
              คลิกเซลล์เพื่อวาง
            </span>
          )}
        </div>
      </div>

      {/* Layout */}
      <div className="report-layout" style={{ display: 'flex', flexDirection: 'row', width: '100%', height: '100%', flex: 1, minHeight: 0, overflow: 'hidden' }}>

        {/* ────── Left Panel: Reports list + Tool Palette ────── */}
        <aside className="report-sidebar report-list-panel" style={{ width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column', background: '#f8fafc', borderRight: '1px solid #e2e8f0', overflowY: 'auto' }}>

          {/* Reports list */}
          <div className="report-sidebar-section">
            <div className="section-title">รายงาน</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <button type="button" className="btn primary small-btn" onClick={onCreateReport}>
                <Icon icon="solar:document-add-bold-duotone" width="14" height="14" /> สร้าง
              </button>
              <button type="button" className="btn danger small-btn" onClick={onDeleteReport}>
                <Icon icon="solar:trash-bin-trash-bold-duotone" width="14" height="14" /> ลบ
              </button>
            </div>
            <input
              type="text"
              placeholder="ค้นหารายงาน..."
              value={reportSearch}
              onChange={(event) => onReportSearchChange(event.target.value)}
              className="report-search-input"
            />
            <div className="report-list-container">
              {loading ? (
                <p className="loading-text">กำลังโหลด...</p>
              ) : reports.length === 0 ? (
                <p className="loading-text">ไม่มีรายงาน</p>
              ) : (
                reports
                  .filter((entry) => entry.name.toLowerCase().includes(reportSearch.toLowerCase()))
                  .map((entry) => (
                    <button
                      key={entry.id}
                      className={entry.id === report.id ? 'report-list-item active' : 'report-list-item'}
                      onClick={() => onSelectReport(entry.id)}
                    >
                      <Icon icon="solar:document-text-bold-duotone" width="16" height="16" className="report-icon" />
                      <div className="report-info">
                        <div className="report-name">{entry.isDefault ? '* ' : ''}{entry.name}</div>
                        <div style={{ fontSize: 10, opacity: 0.6, marginTop: 1 }}>
                          {(entry.template as SpreadsheetTemplate | undefined)?.mode === 'spreadsheet' ? 'Spreadsheet' : 'Canvas'}
                        </div>
                      </div>
                    </button>
                  ))
              )}
            </div>
          </div>

          {/* Tool Palette */}
          <div className="report-sidebar-section" style={{ flex: 1, borderBottom: 'none', overflowY: 'auto' }}>
            <SheetToolPalette
              activeToolType={activeToolType}
              onSelectTool={handleSelectTool}
              collapsedCategories={collapsedToolCategories}
              onToggleCategory={toggleToolCategory}
              disabled={false}
            />
          </div>

          {/* Sheets & Bindings */}
          <div className="report-sidebar-section" style={{ borderTop: '1px solid #e2e8f0' }}>
            <div className="section-title">ชีท</div>
            <div style={{ display: 'grid', gap: 8 }}>
              {visibleSheets.map((sheet) => (
                <button
                  key={sheet.name}
                  type="button"
                  className={sheet.name === selectedSheetName ? 'report-list-item active' : 'report-list-item'}
                  onClick={() => setSelectedSheetName(sheet.name)}
                >
                  <Icon icon="solar:table-bold-duotone" width="16" height="16" className="report-icon" />
                  <div className="report-info">
                    <div className="report-name">{sheet.name}</div>
                    <div style={{ fontSize: 10, opacity: 0.6 }}>{sheet.colCount} cols x {sheet.rowCount} rows</div>
                  </div>
                </button>
              ))}
            </div>

            <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid #e2e8f0' }}>
              <div className="section-title" style={{ marginBottom: 8 }}>Cell Bindings</div>
              <div style={{ display: 'grid', gap: 6 }}>
                {bindings.length === 0 ? (
                  <div style={{ fontSize: 12, color: '#64748b' }}>ยังไม่มี binding</div>
                ) : visibleBindings.map((binding) => (
                    <button
                      key={binding.id}
                      type="button"
                      className={binding.cell === selectedCell && binding.sheetName === selectedSheetName ? 'report-list-item active' : 'report-list-item'}
                      onClick={() => {
                        setSelectedSheetName(binding.sheetName);
                        setActiveToolType(null);
                        setSelectedCell(binding.cell);
                      }}
                    >
                      <Icon icon={bindingKindIcon(binding.kind)} width="16" height="16" className="report-icon" style={{ color: bindingKindColor(binding.kind) }} />
                      <div className="report-info">
                        <div className="report-name" style={{ fontSize: 12 }}>{binding.sheetName}!{binding.cell}</div>
                        <div style={{ fontSize: 10, opacity: 0.6 }}>{binding.kind}</div>
                      </div>
                    </button>
                  ))}
              </div>
            </div>
          </div>
        </aside>

        {/* ────── Center: Spreadsheet Grid ────── */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: '#eef4f8' }}>
          {/* Sheet tabs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderBottom: '1px solid #d8e2eb', background: '#ffffff' }}>
            {visibleSheets.map((sheet) => (
              <button
                key={sheet.name}
                type="button"
                className={sheet.name === selectedSheetName ? 'btn primary small-btn' : 'btn secondary small-btn'}
                onClick={() => setSelectedSheetName(sheet.name)}
              >
                {sheet.name}
              </button>
            ))}
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12, fontSize: 12, color: '#64748b' }}>
              <span>ดับเบิลคลิกเซลล์เพื่อพิมพ์ | คลิกเพื่อวาง binding</span>
              {activeToolType && (
                <span style={{ color: '#2563eb', fontWeight: 600, background: '#dbeafe', padding: '4px 10px', borderRadius: 999 }}>
                  <Icon icon="solar:mouse-bold-duotone" width="14" height="14" style={{ verticalAlign: 'middle', marginRight: 4 }} />
                  วาง: {getSheetTool(activeToolType)?.label}
                </span>
              )}
              <span>
                Cell: <strong>{selectedCell}</strong> {(selectedCellDisplay() ?? '').length > 30 ? `| ${selectedCellDisplay().slice(0, 30)}` : `| ${selectedCellDisplay()}`}
              </span>
            </div>
          </div>

          {/* Grid hint */}
          <div style={{ padding: '8px 16px', fontSize: 12, color: '#475569', background: '#ffffff', borderBottom: '1px solid #f1f5f9' }}>
            💡 ดับเบิลคลิกเซลล์เพื่อพิมพ์ข้อความ | คลิกเลือกใช้เครื่องมือ binding
          </div>

          {/* Grid */}
          <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 16 }}>
            {!selectedSheet ? (
              <div className="empty-state">No worksheet selected.</div>
            ) : (
              <table style={{ borderCollapse: 'collapse', background: '#fff', minWidth: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 2, border: '1px solid #d8e2eb', minWidth: 44, padding: 6 }} />
                    {Array.from({ length: selectedSheet.colCount }, (_, index) => index + 1).map((col) => (
                      <th
                        key={col}
                        style={{
                          position: 'sticky',
                          top: 0,
                          background: '#f8fafc',
                          zIndex: 2,
                          border: '1px solid #d8e2eb',
                          padding: 6,
                          minWidth: selectedSheetColumnWidthMap.get(col) ?? 88,
                          textAlign: 'center',
                        }}
                      >
                        {columnLetters(col)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: selectedSheet.rowCount }, (_, index) => index + 1).map((row) => (
                    <tr key={row}>
                      <th style={{ border: '1px solid #d8e2eb', background: '#f8fafc', padding: '4px 6px', textAlign: 'right', fontSize: 12 }}>{row}</th>
                      {Array.from({ length: selectedSheet.colCount }, (_, index) => index + 1).map((col) => {
                        const address = cellAddress(row, col);
                        const cell = selectedSheetCellMap.get(address);
                        const binding = bindingMap.get(`${selectedSheet.name}:${address}`);
                        const selected = selectedCell === address;
                        return (
                          <td
                            key={address}
                            onClick={() => handleCellClick(address)}
                            onDoubleClick={() => startInlineEdit(address, cell?.display ?? '')}
                            style={{
                              border: selected ? '2px solid #2563eb' : '1px solid #d8e2eb',
                              padding: '5px 8px',
                              minWidth: selectedSheetColumnWidthMap.get(col) ?? 88,
                              height: 32,
                              cursor: activeToolType ? 'crosshair' : 'pointer',
                              background: selected
                                ? '#dbeafe'
                                : binding
                                  ? 'linear-gradient(135deg, #ecfeff 0%, #f0fdf4 100%)'
                                  : '#ffffff',
                              color: cell?.style?.color ?? '#0f172a',
                              fontWeight: cell?.style?.bold ? 700 : 400,
                              fontStyle: cell?.style?.italic ? 'italic' : 'normal',
                              textAlign: cell?.style?.align ?? 'left',
                              position: 'relative',
                              verticalAlign: 'top',
                              transition: 'background 0.1s ease',
                              overflow: 'hidden',
                            }}
                            title={binding ? `${binding.kind} -> ${address}` : address}
                          >
                            {binding ? (
                              <span
                                style={{
                                  position: 'absolute',
                                  top: 2,
                                  right: 2,
                                  width: 8,
                                  height: 8,
                                  borderRadius: '50%',
                                  background: bindingKindColor(binding.kind),
                                  border: '1px solid #ffffff',
                                  boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
                                }}
                                title={`${binding.kind} binding`}
                              />
                            ) : null}
                            {editingAddress === address ? (
                              <textarea
                                value={editingText}
                                onChange={(event) => setEditingText(event.target.value)}
                                onBlur={() => void confirmInlineEdit(address)}
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter' && !event.shiftKey) {
                                    event.preventDefault();
                                    void confirmInlineEdit(address);
                                  }
                                  if (event.key === 'Escape') {
                                    event.preventDefault();
                                    cancelInlineEdit();
                                  }
                                }}
                                ref={editInputRef}
                                style={{
                                  width: '100%',
                                  minWidth: 60,
                                  height: '100%',
                                  minHeight: 28,
                                  boxSizing: 'border-box',
                                  border: '1px solid #2563eb',
                                  borderRadius: 4,
                                  padding: '2px 4px',
                                  fontSize: 12,
                                  lineHeight: '18px',
                                  resize: 'none',
                                  outline: 'none',
                                  background: '#ffffff',
                                  color: '#0f172a',
                                  fontFamily: 'inherit',
                                }}
                              />
                            ) : (
                              <span style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{cell?.display ?? ''}</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* ────── Right Panel: Cell Binding Inspector ────── */}
        <aside style={{ width: 320, flexShrink: 0, borderLeft: '1px solid #e2e8f0', background: '#ffffff', overflowY: 'auto', padding: 16 }}>
          <div style={{ display: 'grid', gap: 14 }}>
            {/* Selected cell info */}
            <section>
              <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: 10 }}>
                <Icon icon="solar:code-circle-bold-duotone" width="16" height="16" style={{ verticalAlign: 'middle', marginRight: 6, color: '#2563eb' }} />
                Cell: {selectedSheet?.name}!{selectedCell}
              </div>
              {selectedBinding && (
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 11,
                  padding: '3px 8px',
                  borderRadius: 999,
                  background: `${bindingKindColor(selectedBinding.kind)}18`,
                  color: bindingKindColor(selectedBinding.kind),
                  fontWeight: 600,
                }}>
                  <Icon icon={bindingKindIcon(selectedBinding.kind)} width="14" height="14" />
                  {selectedBinding.kind}
                </div>
              )}
            </section>

            {/* Report meta */}
            <section>
              <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: 10 }}>รายงาน</div>
              <div style={{ display: 'grid', gap: 10 }}>
                <label className="ins-row">
                  <span>ชื่อ</span>
                  <input value={report.name} onChange={(event) => void onUpdateReportField('name', event.target.value)} />
                </label>
                <label className="ins-row">
                  <span>ประเภท</span>
                  <select value={report.reportType} onChange={(event) => void onUpdateReportField('reportType', event.target.value)}>
                    <option value="daily_energy">รายวัน</option>
                    <option value="monthly_energy">รายเดือน</option>
                    <option value="device_energy">ตามอุปกรณ์</option>
                    <option value="cost">ค่าใช้จ่าย</option>
                    <option value="alarm">แจ้งเตือน</option>
                  </select>
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <label className="ins-row">
                    <span>ขนาด</span>
                    <select value={report.paperSize} onChange={(event) => void onUpdateReportField('paperSize', event.target.value)}>
                      <option value="A4">A4</option>
                      <option value="A3">A3</option>
                      <option value="Letter">Letter</option>
                    </select>
                  </label>
                  <label className="ins-row">
                    <span>แนว</span>
                    <select value={report.orientation} onChange={(event) => void onUpdateReportField('orientation', event.target.value)}>
                      <option value="landscape">แนวนอน</option>
                      <option value="portrait">แนวตั้ง</option>
                    </select>
                  </label>
                </div>
                <label className="ins-row">
                  <span>ช่วงเวลา</span>
                  <select value={report.defaultDateRange} onChange={(event) => void onUpdateReportField('defaultDateRange', event.target.value)}>
                    <option value="today">วันนี้</option>
                    <option value="this_week">สัปดาห์นี้</option>
                    <option value="this_month">เดือนนี้</option>
                    <option value="last_month">เดือนที่แล้ว</option>
                    <option value="this_year">ปีนี้</option>
                    <option value="last_year">ปีที่แล้ว</option>
                  </select>
                </label>
                <label className="ins-row">
                  <span>อัตราค่าไฟ</span>
                  <select value={reportTariffId} onChange={(event) => onReportTariffChange(event.target.value)}>
                    {tariffs.map((tariff) => (
                      <option key={tariff.id} value={tariff.id}>{tariff.name}{tariff.isDefault ? ' ★' : ''}</option>
                    ))}
                  </select>
                </label>
              </div>
            </section>

            {/* Cell Binding Form */}
            <section>
              <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: 10 }}>
                <Icon icon="solar:link-circle-bold-duotone" width="16" height="16" style={{ verticalAlign: 'middle', marginRight: 6, color: '#059669' }} />
                การผูกค่า (Binding)
              </div>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>
                ชีท <strong>{selectedSheet?.name ?? '-'}</strong>, เซลล์ <strong>{selectedCell}</strong>
              </div>
              <div style={{ display: 'grid', gap: 10 }}>
                <label className="ins-row">
                  <span>ประเภท</span>
                  <select value={form.kind} onChange={(event) => setForm((prev) => ({ ...prev, kind: event.target.value as BindingFormState['kind'] }))}>
                    <option value="tag_metric">ค่า Tag</option>
                    <option value="billing_metric">ค่าไฟ</option>
                    <option value="report_meta">ข้อมูลรายงาน</option>
                    <option value="text_template">ข้อความกำหนดเอง</option>
                  </select>
                </label>

                {form.kind === 'tag_metric' ? (
                  <>
                    <label className="ins-row">
                      <span>Tag</span>
                      <select value={form.tagId} onChange={(event) => setForm((prev) => ({ ...prev, tagId: event.target.value }))}>
                        <option value="">เลือก Tag</option>
                        {tags.map((tag) => (
                          <option key={tag.id} value={tag.id}>{tag.deviceId} / {tag.name}</option>
                        ))}
                      </select>
                    </label>
                    <label className="ins-row">
                      <span>ค่า</span>
                      <select value={form.tagMetric} onChange={(event) => setForm((prev) => ({ ...prev, tagMetric: event.target.value }))}>
                        <option value="last">ล่าสุด</option>
                        <option value="first">แรกสุด</option>
                        <option value="usage">รวม</option>
                        <option value="avg">เฉลี่ย</option>
                        <option value="min">ต่ำสุด</option>
                        <option value="max">สูงสุด</option>
                      </select>
                    </label>
                  </>
                ) : null}

                {form.kind === 'billing_metric' ? (
                  <label className="ins-row">
                    <span>ค่า</span>
                    <select value={form.billingMetric} onChange={(event) => setForm((prev) => ({ ...prev, billingMetric: event.target.value }))}>
                      <option value="grandTotal">รวมทั้งสิ้น</option>
                      <option value="totalKwh">รวม kWh</option>
                      <option value="energyCost">ค่าพลังงาน</option>
                      <option value="demandCost">ค่า Demand</option>
                      <option value="vat">VAT</option>
                    </select>
                  </label>
                ) : null}

                {form.kind === 'report_meta' ? (
                  <label className="ins-row">
                    <span>ฟิลด์</span>
                    <select value={form.reportField} onChange={(event) => setForm((prev) => ({ ...prev, reportField: event.target.value }))}>
                      <option value="reportName">ชื่อรายงาน</option>
                      <option value="projectName">ชื่อโปรเจกต์</option>
                      <option value="generatedAt">วันที่สร้าง</option>
                      <option value="periodStart">วันที่เริ่มต้น</option>
                      <option value="periodEnd">วันที่สิ้นสุด</option>
                      <option value="periodLabel">ป้ายช่วงเวลา</option>
                      <option value="reportType">ประเภทรายงาน</option>
                    </select>
                  </label>
                ) : null}

                {form.kind === 'text_template' ? (
                  <label className="ins-row">
                    <span>ข้อความ</span>
                    <textarea
                      value={form.templateText}
                      onChange={(event) => setForm((prev) => ({ ...prev, templateText: event.target.value }))}
                      rows={4}
                      placeholder={'ใช้ {{report.name}}, {{billing.grandTotal}} ฯลฯ'}
                    />
                  </label>
                ) : null}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <label className="ins-row">
                    <span>ทศนิยม</span>
                    <input value={form.decimalPlaces} onChange={(event) => setForm((prev) => ({ ...prev, decimalPlaces: event.target.value }))} />
                  </label>
                  <label className="ins-row">
                    <span>สำรอง</span>
                    <input value={form.fallbackText} onChange={(event) => setForm((prev) => ({ ...prev, fallbackText: event.target.value }))} placeholder="—" />
                  </label>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <label className="ins-row">
                    <span>นำหน้า</span>
                    <input value={form.prefix} onChange={(event) => setForm((prev) => ({ ...prev, prefix: event.target.value }))} placeholder="฿" />
                  </label>
                  <label className="ins-row">
                    <span>ต่อท้าย</span>
                    <input value={form.suffix} onChange={(event) => setForm((prev) => ({ ...prev, suffix: event.target.value }))} placeholder=" kWh" />
                  </label>
                </div>
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12 }}>
                  <input
                    type="checkbox"
                    checked={form.asText}
                    onChange={(event) => setForm((prev) => ({ ...prev, asText: event.target.checked }))}
                  />
                  ส่งออกเป็นข้อความ
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" className="btn primary small-btn" onClick={() => void upsertBinding()}>
                    <Icon icon="solar:diskette-bold-duotone" width="14" height="14" />
                    บันทึก Binding
                  </button>
                  <button type="button" className="btn secondary small-btn" onClick={() => setForm(emptyFormState())}>
                    รีเซ็ต
                  </button>
                  {selectedBinding ? (
                    <button type="button" className="btn danger small-btn" onClick={() => void removeBinding()}>
                      ลบ
                    </button>
                  ) : null}
                </div>
              </div>
            </section>

            {/* Preview Status */}
            <section>
              <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: 10 }}>
                <Icon icon="solar:chart-square-bold-duotone" width="16" height="16" style={{ verticalAlign: 'middle', marginRight: 6, color: '#7c3aed' }} />
                สถานะ
              </div>
              <div style={{ fontSize: 12, color: '#475569', display: 'grid', gap: 6 }}>
                <div>ไฟล์: {source?.originalFileName ?? 'Blank workbook'}</div>
                <div>ที่เก็บ: {source?.relativePath ?? 'In template'}</div>
                <div>ช่วง: {preview?.range.label ?? report.defaultDateRange}</div>
                <div>ประวัติ: {preview?.source.historyCount ?? 0} rows</div>
                <div>Alarms: {preview?.source.alarmCount ?? 0}</div>
                <div>Bindings: {bindings.length}</div>
                {preview?.warnings.length ? (
                  <div style={{ color: '#b45309' }}>{preview.warnings.length} คำเตือน</div>
                ) : null}
              </div>
            </section>
          </div>
        </aside>
      </div>
    </section>
  );
}