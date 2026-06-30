import React from 'react';
import type { ReportObjectDefinition, ReportObjectType, ReportSummary, ReportTemplate, TagSummary, DeviceSummary } from '@energylink/shared-types';
import { reportSchedulerApi, type ReportSchedule, type ReportScheduleRun } from '../../api/reportSchedulerApi';
import { billingApi, type TariffSummary } from '../../api/billingApi';
import { reportsGenerateApi } from '../../api/reportsGenerateApi';
import { EDITOR_COMMAND_EVENT, normalizeCommand, type EditorCommand } from '../../commandBus';
import { getEngineUrl } from '@energylink/shared-ui';
import { Icon } from '@iconify/react';
import { useModal } from '../../context/ModalContext';
import { BillingPanel } from './BillingPanel';
import { RtObject } from '@energylink/graphics-runtime';
import { getWidgetByObjectType } from '@energylink/widget-registry';
import { InspectorPanel } from '../graphics/editor/InspectorPanel';
import {
  REPORT_DATA_BOUND_TYPES,
  REPORT_OBJECT_TOOLS,
  REPORT_TOOL_CATEGORIES,
  REPORT_TOOL_CATEGORY_META,
  defaultCollapsedReportToolCategories,
  getReportTool,
  resolveReportObjectType,
  type ReportToolCategory,
} from './reportTools';
import { applyReportObjectPatch, pageBackgroundIsTransparent, reportObjectStyleToCss, reportChromelessFieldStyle, resolveReportTagIds } from './reportPatchUtils';
import { clamp, DEFAULT_GRID_SIZE, isGridCommand, normalizeGridSize, parseGridSizeFromCommand, snapToGrid, type EditorGridStyle } from '../editorGrid';
import { EditorGridControls } from '../EditorGridControls';
import { EditorGridOverlay } from '../EditorGridOverlay';
import { ReportObjectSupplement, ReportPageBackgroundSection, ReportDecorationSection, reportObjectPreviewStyle } from './ReportInspectorSections';
import { ReportTrendTablePreview } from './ReportChartSettings';
import { ReportToolSettingsInspector } from './settings/ReportToolSettingsInspector';
import { validateReportObjectSettings } from './settings/reportSettingValidator';
import { useReportObjectPreview } from './reportPreviewRuntime';
import { useReportPeriodContext, type ReportPeriodContext, type ReportPeriodContextInput } from './reportPeriodContext';
import { MeterBillingTablePreview } from './MeterBillingTablePreview';
import { useMeterBillingTableData } from './useMeterBillingTableData';
import { useReportObjectFieldData } from './useReportObjectFieldData';
import { REPORT_RANGE_OPTIONS } from './reportUiLabels';
import { formatReportFormulaResult, listMeterBillingTags } from '@energylink/shared-types';
import { SpreadsheetReportWorkspace } from './SpreadsheetReportWorkspace';
import '../graphics/editor/editor.css';

type ExportFormat = 'pdf' | 'excel';
type ReportMode = 'canvas' | 'spreadsheet';

type ReportValidationResult = {
  ok: boolean;
  errors: string[];
  warnings: ReportValidationIssue[];
};

type ReportValidationIssue = {
  message: string;
  objectId?: string;
  pageId?: string;
  severity: 'error' | 'warning';
};

const REPORT_CUSTOM_ONLY_INSPECTOR_TYPES = new Set<string>([
  'date',
  'page_number',
  'signature',
  'qrcode',
  'meter_billing_table',
  'energy_summary',
  'cost_summary',
  'formula',
  'formulavalue',
  'value',
  'kpi_value',
  'kpicard',
]);

function collectReportValidation(
  page: ReportTemplate['pages'][number] | undefined,
  report: ReportSummary | undefined,
  options?: { pageId?: string; pageLabel?: string; includeReportChecks?: boolean },
) {
  const errors: string[] = [];
  const warnings: ReportValidationIssue[] = [];
  const includeReportChecks = options?.includeReportChecks ?? true;
  const pagePrefix = options?.pageLabel ? `${options.pageLabel}: ` : '';

  if (includeReportChecks && !report) errors.push('No report selected');
  if (!page) errors.push('Report has no page');
  if (includeReportChecks && report && !report.name.trim()) errors.push('Report name is required');

  page?.objects.forEach((object) => {
    const objectName = object.name || object.id;
    const warn = (message: string) => warnings.push({
      message: `${pagePrefix}${objectName}: ${message}`,
      objectId: object.id,
      pageId: options?.pageId,
      severity: 'warning',
    });

    const validation = validateReportObjectSettings(object);
    validation.errors.forEach((issue) => errors.push(`${pagePrefix}${objectName}: ${issue.message}`));
    validation.warnings.forEach((issue) => warn(issue.message));
  });

  return { errors, warnings };
}

function collectTemplateValidation(template: ReportTemplate | null | undefined, report: ReportSummary | undefined) {
  const errors: string[] = [];
  const warnings: ReportValidationIssue[] = [];
  const pages = template?.pages ?? [];

  if (!report) errors.push('No report selected');
  if (report && !report.name.trim()) errors.push('Report name is required');
  if (!pages.length) errors.push('Report has no page');

  pages.forEach((page, index) => {
    const result = collectReportValidation(page, report, {
      pageId: page.id,
      pageLabel: page.name?.trim() || `Page ${index + 1}`,
      includeReportChecks: false,
    });
    errors.push(...result.errors);
    warnings.push(...result.warnings);
  });

  return { errors, warnings };
}

const tools = REPORT_OBJECT_TOOLS;

const paperSizes: Record<string, { width: number; height: number }> = {
  A4: { width: 794, height: 1123 },
  A3: { width: 1123, height: 1587 },
  Letter: { width: 816, height: 1056 }
};

const currencyFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

function safeName(value: string) {
  return value.trim().replace(/[^a-z0-9_-]+/gi, '_') || 'report';
}

function todayText() {
  return new Date().toLocaleString();
}

function objectText(type: ReportObjectType) {
  const tool = tools.find((candidate) => candidate.type === type);
  if (tool) return tool.label;

  switch (type) {
    case 'text':
      return 'Text';
    case 'image':
      return 'Image';
    case 'shape':
    case 'rectangle':
      return '';
    case 'line':
      return '';
    case 'date':
      return '[Report Date]';
    case 'formula':
    case 'formulavalue':
      return '[Formula]';
    case 'table':
    case 'tagtable':
      return 'Data Table';
    case 'graph':
    case 'trend':
      return 'Trend Graph';
    case 'echart':
      return 'Chart';
    case 'kpi_value':
    case 'value':
      return '[Tag]';
    case 'kpicard':
      return 'KPI';
    case 'qrcode':
      return '[QR Code]';
    case 'signature':
      return 'Sign Here\n......................\n(                       )';
    case 'energy_summary':
      return 'Energy Summary';
    case 'cost_summary':
      return 'Cost Summary';
    case 'alarm_table':
    case 'alarmtable':
      return 'Alarm Table';
    case 'meter_billing_table':
      return 'Meter Billing Table';
    case 'page_number':
      return 'Page [n]';
    default:
      return 'Object';
  }
}

const emptyTemplate = (paperSize = 'A4', orientation = 'landscape'): ReportTemplate => {
  const size = paperSizes[paperSize] ?? paperSizes.A4;
  const isLandscape = orientation === 'landscape';

  return {
    version: 1,
    pages: [
      {
        id: 'page_1',
        name: 'Page 1',
        width: isLandscape ? size.height : size.width,
        height: isLandscape ? size.width : size.height,
        backgroundColor: '#ffffff',
        objects: []
      }
    ]
  };
};

function spreadsheetTemplate() {
  return {
    version: 2,
    mode: 'spreadsheet',
    pages: emptyTemplate().pages,
    spreadsheet: {
      snapshot: {
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
      },
      bindings: [],
      export: {
        pdf: { sheetMode: 'all', fitToPage: true, showGridLines: false },
        excel: { preserveFormulas: true },
      },
    },
  };
}

function newObject(type: ReportObjectType, index: number): ReportObjectDefinition {
  const widgetDef = getWidgetByObjectType ? getWidgetByObjectType(type) : undefined;
  
  const base = {
    id: `report_object_${Date.now()}_${index}`,
    type,
    name: `${type}_${index}`,
    x: 60 + index * 14,
    y: 70 + index * 14,
    width: widgetDef?.defaults?.width ?? 180,
    height: widgetDef?.defaults?.height ?? 46,
    visible: true,
    locked: false,
    layer: index,
    text: widgetDef?.defaults?.text ?? objectText(type),
    style: {
      fontSize: 14,
      color: '#0f172a',
      background: '#ffffff',
      borderColor: '#94a3b8',
      align: 'left',
      ...(widgetDef?.defaults?.style || {})
    },
    ...(widgetDef?.defaults || {})
  } satisfies ReportObjectDefinition;

  if (type === 'image') return { ...base, width: 220, height: 100 };
  if (type === 'shape' || type === 'line') return { ...base, width: 200, height: type === 'line' ? 2 : 80, style: { ...base.style, background: type === 'line' ? '#0f172a' : base.style.background } };
  if (type === 'rectangle') return { ...base, width: 200, height: 80, style: { ...base.style, background: '#f8fafc' } };
  if (type === 'date') return { ...base, width: 200, height: 36, text: todayText() };
  if (type === 'formula' || type === 'formulavalue') {
    return {
      ...base,
      width: 100,
      height: 24,
      formula: 'A',
      text: '',
      style: {
        ...base.style,
        ...reportChromelessFieldStyle(),
        formula: 'A',
        fontSize: 14,
        align: 'right',
        decimalPlaces: 2,
      },
    };
  }
  if (type === 'kpi_value' || type === 'value') {
    return {
      ...base,
      width: 100,
      height: 24,
      text: '',
      style: {
        ...base.style,
        ...reportChromelessFieldStyle(),
        fontSize: 14,
        align: 'right',
        decimalPlaces: 2,
      },
    };
  }
  if (type === 'kpicard') return { ...base, width: 180, height: 90 };
  if (type === 'qrcode') return { ...base, width: 120, height: 120, text: '[QR Code]', style: { ...base.style, align: 'center' } };
  if (type === 'signature') return { ...base, width: 200, height: 80, text: 'Sign Here\n......................\n(                       )', style: { ...base.style, align: 'center', fontSize: 12 } };
  if (type === 'table' || type === 'tagtable') return { ...base, width: 560, height: 180 };
  if (type === 'graph' || type === 'trend' || type === 'echart') return { ...base, width: 420, height: 220 };
  if (type === 'energy_summary') return { ...base, width: 280, height: 100, style: { ...base.style, ...reportChromelessFieldStyle(), padding: 8 } };
  if (type === 'cost_summary') return { ...base, width: 280, height: 100, style: { ...base.style, ...reportChromelessFieldStyle(), padding: 8 } };
  if (type === 'alarm_table' || type === 'alarmtable') return { ...base, width: 560, height: 180 };
  if (type === 'meter_billing_table') {
    return {
      ...base,
      width: 720,
      height: 280,
      text: 'Meter Billing Table',
      props: {
        autoInclude: true,
        showHeader: true,
        columns: 'index,device,tag,meterNo,first,last,usage,rate,amount',
      },
      style: {
        ...base.style,
        fontSize: 10,
        ...reportChromelessFieldStyle(),
      },
    };
  }
  if (type === 'page_number') return { ...base, width: 120, height: 32 };

  return base;
}

function starterTemplate(reportType: string, paperSize = 'A4', orientation = 'landscape'): ReportTemplate {
  const template = emptyTemplate(paperSize, orientation);
  const page = template.pages[0];
  if (!page) return template;

  const make = (type: ReportObjectType, index: number, patch: Partial<ReportObjectDefinition>) => ({
    ...newObject(type, index),
    ...patch,
  });

  const common: ReportObjectDefinition[] = [
    make('text' as ReportObjectType, 1, {
      name: 'report_title',
      x: 40,
      y: 28,
      width: 520,
      height: 42,
      text: reportType === 'alarm'
        ? 'Alarm Report'
        : reportType === 'device_communication'
        ? 'Device Communication Report'
        : reportType === 'carbon'
        ? 'Carbon Footprint Report'
        : reportType === 'tou_cost'
        ? 'TOU Cost Report'
        : reportType === 'demand'
        ? 'Peak Demand Report'
        : reportType === 'meter_billing'
        ? 'Meter Billing Report'
        : reportType === 'cost'
        ? 'Energy Cost Report'
        : 'Energy Report',
      style: { fontSize: 24, color: '#0f172a', background: 'transparent', borderColor: 'transparent', align: 'left', fontWeight: 800 },
    }),
    make('date' as ReportObjectType, 2, {
      name: 'generated_date',
      x: page.width - 260,
      y: 36,
      width: 220,
      height: 28,
      style: { fontSize: 12, color: '#475569', background: 'transparent', borderColor: 'transparent', align: 'right' },
      props: { format: 'YYYY-MM-DD' },
    }),
    make('line' as ReportObjectType, 3, {
      name: 'header_rule',
      x: 40,
      y: 82,
      width: page.width - 80,
      height: 2,
      style: { background: '#0f766e', fill: '#0f766e', borderColor: 'transparent', stroke: 'transparent', strokeWidth: 0 },
    }),
    make('page_number' as ReportObjectType, 99, {
      name: 'page_number',
      x: page.width - 160,
      y: page.height - 46,
      width: 120,
      height: 24,
      text: 'Page [n]',
      style: { fontSize: 10, color: '#64748b', background: 'transparent', borderColor: 'transparent', align: 'right' },
    }),
  ];

  const isAlarm = reportType === 'alarm' || reportType === 'device_communication';
  const body: ReportObjectDefinition[] = isAlarm
    ? [
        make('alarmtable' as ReportObjectType, 4, {
          name: 'alarm_table',
          x: 40,
          y: 110,
          width: page.width - 80,
          height: page.height - 190,
        }),
      ]
    : [
        make('meter_billing_table' as ReportObjectType, 4, {
          name: 'meter_billing_table',
          x: 40,
          y: 112,
          width: page.width - 80,
          height: Math.max(260, page.height - 350),
        }),
        make('energy_summary' as ReportObjectType, 5, {
          name: 'energy_summary',
          x: 40,
          y: page.height - 208,
          width: 260,
          height: 105,
        }),
        make('cost_summary' as ReportObjectType, 6, {
          name: 'cost_summary',
          x: 320,
          y: page.height - 208,
          width: 260,
          height: 105,
        }),
        make('signature' as ReportObjectType, 7, {
          name: 'approved_signature',
          x: page.width - 280,
          y: page.height - 190,
          width: 220,
          height: 90,
          text: 'Approved by',
        }),
      ];

  return {
    ...template,
    pages: [
      {
        ...page,
        objects: [...common, ...body].map((object, index) => ({ ...object, layer: index })),
      },
    ],
  };
}

function cloneTemplate(template: ReportTemplate): ReportTemplate {
  return JSON.parse(JSON.stringify(template)) as ReportTemplate;
}

function nextPageNumber(pages: Array<ReportTemplate['pages'][number]>): number {
  return pages.reduce((max, page, index) => {
    const match = /^page\s+(\d+)$/i.exec(page.name?.trim() ?? '');
    const pageNumber = match ? Number(match[1]) : index + 1;
    return Number.isFinite(pageNumber) ? Math.max(max, pageNumber) : max;
  }, 0) + 1;
}

function makeBlankPage(
  template: ReportTemplate,
  sourcePage?: ReportTemplate['pages'][number],
): ReportTemplate['pages'][number] {
  const pageNumber = nextPageNumber(template.pages ?? []);
  const fallbackPage = template.pages?.[template.pages.length - 1];
  const base = sourcePage ?? fallbackPage;

  return {
    id: `page_${Date.now()}_${pageNumber}`,
    name: `Page ${pageNumber}`,
    width: base?.width ?? paperSizes.A4.height,
    height: base?.height ?? paperSizes.A4.width,
    backgroundColor: base?.backgroundColor ?? '#ffffff',
    objects: [],
  };
}

function resolvePreviewObjectText(
  object: ReportObjectDefinition,
  pageIndex: number,
  pageCount: number,
) {
  if (object.type === 'date') return todayText();
  if (object.type === 'page_number') {
    const template = object.text?.trim();
    if (template) {
      return template
        .replaceAll('[n]', String(pageIndex + 1))
        .replaceAll('[total]', String(pageCount));
    }
    return `Page ${pageIndex + 1} of ${pageCount}`;
  }
  return object.text || object.name;
}

function makeHtmlReport(report: ReportSummary): string {
  const pages = report.template?.pages?.length
    ? report.template.pages
    : emptyTemplate(report.paperSize, report.orientation).pages;
  const pageHtml = pages
    .map((page, pageIndex) => {
      const pageBg = pageBackgroundIsTransparent(page.backgroundColor)
        ? 'transparent'
        : (page.backgroundColor ?? '#fff');
      const objectHtml = page.objects
        .filter((object) => object.visible !== false)
        .sort((a, b) => (a.layer ?? 0) - (b.layer ?? 0))
        .map((object) => {
          const text = resolvePreviewObjectText(object, pageIndex, pages.length);
          return `
        <section class="report-object ${object.type}" style="${reportObjectStyleToCss(object)}">
          <strong>${escapeHtml(text)}</strong>
          ${renderObjectDetailHtml(object)}
        </section>`;
        })
        .join('\n');

      return `
  <main class="page" style="width:${page.width}px; min-height:${page.height}px; background:${pageBg};">
    ${objectHtml}
  </main>`;
    })
    .join('\n');

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${escapeHtml(report.name)}</title>
<style>
  body { margin: 0; padding: 24px; font-family: Arial, sans-serif; color: #0f172a; background: #e5e7eb; }
  .report-stack { display: grid; gap: 24px; }
  .page { position: relative; margin: 0 auto; box-shadow: 0 8px 30px rgba(15, 23, 42, 0.18); overflow: hidden; page-break-after: always; break-after: page; }
  .page:last-child { page-break-after: auto; break-after: auto; }
  .report-object { position: absolute; box-sizing: border-box; overflow: hidden; }
  .report-object small { display: block; margin-top: 6px; color: #64748b; }
  @media print { body { padding: 0; background: #fff; } .report-stack { gap: 0; } .page { box-shadow: none; margin: 0 auto; } }
</style>
</head>
<body>
  <div class="report-stack">
    ${pageHtml}
  </div>
</body>
</html>`;
}

function renderObjectDetailHtml(_object: ReportObjectDefinition) {
  return '';
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function downloadFile(filename: string, mimeType: string, content: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function reportToCsv(report: ReportSummary) {
  const rows = [
    ['Report', report.name],
    ['Type', report.reportType],
    ['Generated', todayText()],
    [],
    ['Object Name', 'Type', 'Text', 'Formula', 'X', 'Y', 'Width', 'Height']
  ];

  for (const page of report.template.pages) {
    for (const object of page.objects) {
      rows.push([
        object.name,
        object.type,
        object.text ?? '',
        object.formula ?? '',
        String(object.x),
        String(object.y),
        String(object.width),
        String(object.height)
      ]);
    }
  }

  return rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\r\n');
}

export function ReportsWorkspace() {
  const { showAlert, showConfirm, showPrompt } = useModal();
  const [activeProject, setActiveProject] = React.useState<{ id: string; name: string } | null>(null);
  const [reports, setReports] = React.useState<ReportSummary[]>([]);
  const [selectedReportId, setSelectedReportId] = React.useState<string>();
  const [selectedObjectId, setSelectedObjectId] = React.useState<string>();
  const [tags, setTags] = React.useState<TagSummary[]>([]);
  const [devices, setDevices] = React.useState<DeviceSummary[]>([]);
  const [bindingDeviceId, setBindingDeviceId] = React.useState<string>('');
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string>();
  const [validationWarnings, setValidationWarnings] = React.useState<ReportValidationIssue[]>([]);
  const [notice, setNotice] = React.useState<string>();
  const [gridEnabled, setGridEnabled] = React.useState(true);
  const [gridSize, setGridSize] = React.useState(DEFAULT_GRID_SIZE);
  const [gridStyle, setGridStyle] = React.useState<EditorGridStyle>('lines');
  const [dragState, setDragState] = React.useState<{ kind: 'move' | 'resize'; handle?: string; id: string; startX: number; startY: number; objectX: number; objectY: number; objectW?: number; objectH?: number } | null>(null);

  const [activeTab, setActiveTab] = React.useState<'designer' | 'scheduler' | 'billing'>('designer');
  const [isCreateModalOpen, setIsCreateModalOpen] = React.useState(false);
  const [newReportName, setNewReportName] = React.useState('');
  const [newReportMode, setNewReportMode] = React.useState<ReportMode>('canvas');
  const [newReportType, setNewReportType] = React.useState('daily_energy');
  const [newReportPaperSize, setNewReportPaperSize] = React.useState('A4');
  const [newReportOrientation, setNewReportOrientation] = React.useState('landscape');
  const [tariffs, setTariffs] = React.useState<TariffSummary[]>([]);
  const [reportTariffId, setReportTariffId] = React.useState('');
  const [generateBusy, setGenerateBusy] = React.useState(false);
  const [reportSearch, setReportSearch] = React.useState('');
  const [propsTab, setPropsTab] = React.useState<'settings' | 'style' | 'data'>('settings');
  const [collapsedToolCategories, setCollapsedToolCategories] = React.useState<Set<ReportToolCategory>>(
    () => defaultCollapsedReportToolCategories(),
  );
  const [selectedPageId, setSelectedPageId] = React.useState<string>('');
  const [activeToolType, setActiveToolType] = React.useState<ReportObjectType | null>(null);
  const [placementPreview, setPlacementPreview] = React.useState<{ x: number; y: number } | null>(null);

  const toggleToolCategory = React.useCallback((category: ReportToolCategory) => {
    setCollapsedToolCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  }, []);

  const cleanUrl = getEngineUrl().replace(/\/$/, '');

  React.useEffect(() => {
    if (!activeProject?.id) {
      setTariffs([]);
      setReportTariffId('');
      return;
    }
    void (async () => {
      const res = await billingApi.listTariffs(activeProject.id);
      if (res.ok) {
        setTariffs(res.data.tariffs);
        setReportTariffId((prev) => {
          if (prev && res.data.tariffs.some((t) => t.id === prev)) return prev;
          return (res.data.tariffs.find((t) => t.isDefault) ?? res.data.tariffs[0])?.id ?? '';
        });
      }
    })();
  }, [activeProject?.id]);

  React.useEffect(() => {
    if (notice) {
      const timer = setTimeout(() => {
        setNotice(undefined);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [notice]);

  const selectedReport = reports.find((report) => report.id === selectedReportId) ?? reports[0];
  const isSpreadsheetReport = selectedReport?.template?.mode === 'spreadsheet';

  const baseTemplate = React.useMemo((): ReportTemplate | null => {
    if (!selectedReport) return null;
    const tmpl = selectedReport.template;
    if (tmpl?.pages?.length) return tmpl;
    const size = paperSizes[selectedReport.paperSize ?? 'A4'] ?? paperSizes.A4;
    const isLandscape = (selectedReport.orientation ?? 'landscape') === 'landscape';
    return {
      version: 1 as const,
      pages: [{
        id: 'page_1',
        name: 'Page 1',
        width: isLandscape ? size.height : size.width,
        height: isLandscape ? size.width : size.height,
        backgroundColor: '#ffffff',
        objects: []
      }]
    };
  }, [selectedReport]);

  const [draftTemplate, setDraftTemplate] = React.useState<ReportTemplate | null>(null);
  const saveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingTemplateRef = React.useRef<ReportTemplate | null>(null);
  const persistGenerationRef = React.useRef(0);
  const lastPersistedTemplateRef = React.useRef<string>('');

  // Reset page selection when switching reports or template
  React.useEffect(() => {
    if (!selectedReport) {
      setDraftTemplate(null);
      setError(undefined);
      setValidationWarnings([]);
      return;
    }
    const tmpl = selectedReport.template?.pages?.length
      ? selectedReport.template
      : baseTemplate;
    setDraftTemplate(tmpl ?? null);
    setSelectedObjectId(undefined);
    setActiveToolType(null);
    setPlacementPreview(null);
    setError(undefined);
    setValidationWarnings([]);
    // Reset page selection — use first page or existing selection
    const pages = tmpl?.pages ?? baseTemplate?.pages ?? [];
    if (pages.length > 0) {
      const current = selectedPageId && pages.some(p => p.id === selectedPageId) ? selectedPageId : pages[0].id;
      setSelectedPageId(current);
    }
  }, [selectedReport?.id, baseTemplate?.pages?.length]);

  React.useEffect(() => () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
  }, []);

  const effectiveTemplate = draftTemplate ?? baseTemplate;
  const pages = effectiveTemplate?.pages ?? [];
  React.useEffect(() => {
    if (!pages.length) {
      if (selectedPageId) setSelectedPageId('');
      return;
    }
    if (!selectedPageId || !pages.some((page) => page.id === selectedPageId)) {
      setSelectedPageId(pages[0].id);
    }
  }, [pages, selectedPageId]);
  const selectedPage = React.useMemo(() => {
    if (selectedPageId && pages.some(p => p.id === selectedPageId)) {
      return pages.find(p => p.id === selectedPageId) ?? pages[0];
    }
    return pages[0];
  }, [pages, selectedPageId, effectiveTemplate?.version]);
  const activePlacementTool = React.useMemo(
    () => (activeToolType ? getReportTool(activeToolType) : undefined),
    [activeToolType],
  );
  const placementPreviewObject = React.useMemo(
    () => (activeToolType && selectedPage ? newObject(activeToolType, selectedPage.objects.length + 1) : null),
    [activeToolType, selectedPage?.id, selectedPage?.objects.length],
  );
  const periodContext = useReportPeriodContext(
    selectedPage?.objects ?? [],
    tags,
    devices,
    {
      defaultDateRange: selectedReport?.defaultDateRange,
      reportType: selectedReport?.reportType,
      tariffId: reportTariffId,
      projectId: activeProject?.id,
    },
  );
  const reportPeriodInput: ReportPeriodContextInput = React.useMemo(() => ({
    defaultDateRange: selectedReport?.defaultDateRange,
    reportType: selectedReport?.reportType,
    tariffId: reportTariffId,
    projectId: activeProject?.id,
  }), [selectedReport?.defaultDateRange, selectedReport?.reportType, reportTariffId, activeProject?.id]);
  const selectedObject = selectedPage?.objects?.find((object) => object.id === selectedObjectId);
  const preferReportOnlyInspector = Boolean(
    selectedObject && REPORT_CUSTOM_ONLY_INSPECTOR_TYPES.has(String(selectedObject.type)),
  );
  const validationSnapshot = React.useMemo(
    () => collectReportValidation(selectedPage, selectedReport),
    [selectedPage, selectedReport],
  );
  const reportForActions = selectedReport && effectiveTemplate
    ? { ...selectedReport, template: effectiveTemplate }
    : selectedReport;

  // If the report has no pages in DB, auto-save the repaired template
  const savedEmptyReports = React.useRef(new Set<string>());
  React.useEffect(() => {
    if (!selectedReport || !baseTemplate) return;
    if ((selectedReport.template?.pages?.length ?? 0) === 0 && !savedEmptyReports.current.has(selectedReport.id)) {
      savedEmptyReports.current.add(selectedReport.id);
      void persistTemplate(baseTemplate, { notify: false });
    }
  }, [selectedReport?.id, baseTemplate]);

  // Sync bindingDeviceId when object selection changes
  React.useEffect(() => {
    if (selectedObject?.sourceTagId || selectedObject?.tagId) {
      const tagId = selectedObject.tagId ?? selectedObject.sourceTagId;
      const tag = tags.find((t) => t.id === tagId);
      if (tag) setBindingDeviceId(tag.deviceId);
    }
  }, [selectedObjectId, tags, selectedObject?.tagId, selectedObject?.sourceTagId]);

  async function loadReports() {
    setLoading(true);
    setError(undefined);
    try {
      const [list, tagList, deviceList, projectList, projectStatus] = await Promise.all([
        window.energylink.reports.list(),
        window.energylink.tags.list().catch(() => [] as TagSummary[]),
        window.energylink.devices.list().catch(() => [] as DeviceSummary[]),
        window.energylink.projects.list().catch(() => []),
        window.energylink.projects.status().catch(() => null)
      ]);
      setReports(list);
      setTags(tagList);
      setDevices(deviceList);

      let pid = projectStatus?.activeProjectId;
      if (!pid && projectList.length > 0) pid = projectList[0].id;

      if (pid) {
        const proj = projectList.find((p) => p.id === pid) ?? projectList[0];
        if (proj) setActiveProject({ id: proj.id, name: proj.name });
        else setActiveProject(null);
      } else {
        setActiveProject(null);
      }

      setSelectedReportId((prev) => prev ?? list[0]?.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    void loadReports();

    function handleProjectChange() {
      void loadReports();
    }

    window.addEventListener('energylink:active-project-changed', handleProjectChange);
    return () => window.removeEventListener('energylink:active-project-changed', handleProjectChange);
  }, []);

  function addPage() {
    if (!selectedReport || !effectiveTemplate) return;
    const nextTemplate = cloneTemplate(effectiveTemplate);
    const blankPage = makeBlankPage(nextTemplate, selectedPage);
    nextTemplate.pages.push(blankPage);
    setSelectedPageId(blankPage.id);
    setSelectedObjectId(undefined);
    setActiveToolType(null);
    setPlacementPreview(null);
    applyTemplate(nextTemplate, 'save');
    setNotice(`Added ${blankPage.name}.`);
  }

  async function deletePage(pageId: string) {
    if (!selectedReport || !effectiveTemplate) return;
    if (effectiveTemplate.pages.length <= 1) {
      setError('Report must keep at least one page.');
      return;
    }
    const targetPageIndex = effectiveTemplate.pages.findIndex((page) => page.id === pageId);
    if (targetPageIndex === -1) return;
    const pageName = effectiveTemplate.pages[targetPageIndex]?.name ?? `Page ${targetPageIndex + 1}`;
    if (!await showConfirm(`Delete ${pageName}?`)) return;
    const nextTemplate = {
      ...effectiveTemplate,
      pages: effectiveTemplate.pages.filter((page) => page.id !== pageId),
    };
    const fallbackPageIndex = Math.min(targetPageIndex, nextTemplate.pages.length - 1);
    setSelectedPageId(nextTemplate.pages[fallbackPageIndex]?.id ?? nextTemplate.pages[0]?.id ?? '');
    setSelectedObjectId(undefined);
    setActiveToolType(null);
    setPlacementPreview(null);
    applyTemplate(nextTemplate, 'save');
    setNotice(`Deleted ${pageName}.`);
  }

  function openCreateModal(defaultMode: ReportMode = 'canvas') {
    setNewReportName('');
    setNewReportMode(defaultMode);
    setNewReportType('daily_energy');
    setNewReportPaperSize('A4');
    setNewReportOrientation('landscape');
    setError(undefined);
    setIsCreateModalOpen(true);
  }

  async function handleCreateReport() {
    const trimmed = newReportName.trim();
    if (!trimmed) { setError('Report name is required.'); return; }
    setIsCreateModalOpen(false);

    try {
      const report = await window.energylink.reports.create({
        name: trimmed,
        reportType: newReportType as any,
        paperSize: newReportPaperSize,
        orientation: newReportOrientation,
        template: newReportMode === 'spreadsheet'
          ? spreadsheetTemplate()
          : starterTemplate(newReportType, newReportPaperSize, newReportOrientation)
      });
      setReports((prev) => [report, ...prev]);
      setSelectedReportId(report.id);
      setSelectedObjectId(undefined);
      setNotice(`Report created: ${report.name}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function createReport(mode: ReportMode = isSpreadsheetReport ? 'spreadsheet' : 'canvas') {
    openCreateModal(mode);
  }

  async function deleteReport() {
    if (!selectedReport) return;
    if (!await showConfirm(`Delete report "${selectedReport.name}"?`)) return;
    try {
      await window.energylink.reports.delete(selectedReport.id);
      await loadReports();
      setSelectedObjectId(undefined);
      setNotice('Report deleted.');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function applyLocalTemplate(template: ReportTemplate) {
    if (!selectedReport) return;
    setDraftTemplate(template);
    setReports((prev) => prev.map((item) => (item.id === selectedReport.id ? { ...item, template } : item)));
  }

  async function persistTemplate(template: ReportTemplate, options?: { notify?: boolean }) {
    if (!selectedReport) return;
    const generation = ++persistGenerationRef.current;
    const serialized = JSON.stringify(template);
    try {
      const updated = await window.energylink.reports.update({ id: selectedReport.id, template });
      if (generation !== persistGenerationRef.current) return;
      lastPersistedTemplateRef.current = serialized;
      setReports((prev) => prev.map((item) => (
        item.id === updated.id ? { ...updated, template } : item
      )));
      setError(undefined);
      if (options?.notify) setNotice(`Saved ${updated.name}`);
    } catch (err) {
      if (generation !== persistGenerationRef.current) return;
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function schedulePersist(template: ReportTemplate) {
    pendingTemplateRef.current = template;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const pending = pendingTemplateRef.current;
      pendingTemplateRef.current = null;
      if (!pending) return;
      if (JSON.stringify(pending) === lastPersistedTemplateRef.current) return;
      void persistTemplate(pending);
    }, 350);
  }

  function applyTemplate(template: ReportTemplate, mode: 'local' | 'save' | 'debounced' = 'debounced') {
    applyLocalTemplate(template);
    if (mode === 'save') void persistTemplate(template, { notify: true });
    else if (mode === 'debounced') schedulePersist(template);
  }

  async function saveTemplate(template: ReportTemplate, options?: { notify?: boolean }) {
    applyLocalTemplate(template);
    await persistTemplate(template, { notify: options?.notify ?? true });
  }

  async function updateReportField(
    field: keyof Pick<ReportSummary, 'name' | 'description' | 'reportType' | 'paperSize' | 'orientation' | 'defaultDateRange' | 'outputFormat'>,
    value: string
  ) {
    if (!selectedReport) return;

    if (field === 'name' && !value.trim()) {
      setError('Report name is required.');
      return;
    }

    try {
      const patch: any = { id: selectedReport.id, [field]: value };

      if (field === 'paperSize' || field === 'orientation') {
        const nextPaperSize = field === 'paperSize' ? value : selectedReport.paperSize;
        const nextOrientation = field === 'orientation' ? value : selectedReport.orientation;
        const sourceTemplate = effectiveTemplate ?? selectedReport.template;
        patch.template = resizeTemplatePage(sourceTemplate, nextPaperSize, nextOrientation);
      }

      const updated = await window.energylink.reports.update(patch);
      setReports((prev) => prev.map((item) => item.id === updated.id ? updated : item));
      if (patch.template) setDraftTemplate(patch.template);
      setNotice('Report property updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function resizeTemplatePage(template: ReportTemplate, paperSize: string, orientation: string): ReportTemplate {
    const size = paperSizes[paperSize] ?? paperSizes.A4;
    const isLandscape = orientation === 'landscape';
    const width = isLandscape ? size.height : size.width;
    const height = isLandscape ? size.width : size.height;

    return {
      ...template,
      pages: template.pages.map((page) => ({ ...page, width, height }))
    };
  }

  async function setDefaultReport() {
    if (!selectedReport) return;
    const updated = await window.energylink.reports.update({ id: selectedReport.id, isDefault: true });
    setReports((prev) => prev.map((item) => item.id === updated.id ? updated : { ...item, isDefault: false }));
    setNotice(`${updated.name} is now the default report.`);
  }

  function selectReportTool(type: ReportObjectType) {
    if (!selectedReport || !effectiveTemplate || !selectedPage) {
      setError('Create or select a report first, then click a tool to add an object.');
      return;
    }
    const tool = getReportTool(type);
    if (activeToolType === type) {
      setActiveToolType(null);
      setPlacementPreview(null);
      setNotice(`Cancelled placing ${tool?.label ?? type}.`);
      return;
    }
    setSelectedObjectId(undefined);
    setError(undefined);
    setActiveToolType(type);
    setPlacementPreview(null);
    setNotice(`Selected ${tool?.label ?? type}. Click on the page to place it.`);
  }

  function resolvePlacementPosition(pageX: number, pageY: number, width: number, height: number) {
    const maxX = Math.max(0, (selectedPage?.width ?? width) - width);
    const maxY = Math.max(0, (selectedPage?.height ?? height) - height);
    const x = snapToGrid(
      Math.max(0, Math.min(pageX - Math.round(width / 2), maxX)),
      gridEnabled,
      gridSize,
    );
    const y = snapToGrid(
      Math.max(0, Math.min(pageY - Math.round(height / 2), maxY)),
      gridEnabled,
      gridSize,
    );
    return { x, y };
  }

  function updatePlacementPreview(pageX: number, pageY: number) {
    if (!placementPreviewObject || !selectedPage) return;
    setPlacementPreview(
      resolvePlacementPosition(pageX, pageY, placementPreviewObject.width, placementPreviewObject.height),
    );
  }

  function placeObjectAt(pageX: number, pageY: number) {
    if (!activeToolType || !selectedReport || !effectiveTemplate || !selectedPage) return;
    const object = newObject(activeToolType, selectedPage.objects.length + 1);
    const nextPosition = resolvePlacementPosition(pageX, pageY, object.width, object.height);
    object.x = nextPosition.x;
    object.y = nextPosition.y;
    const template: ReportTemplate = {
      ...effectiveTemplate,
      pages: effectiveTemplate.pages.map((page) => page.id === selectedPage.id ? { ...page, objects: [...page.objects, object] } : page)
    };
    setSelectedObjectId(object.id);
    const tool = getReportTool(activeToolType);
    setNotice(`Placed ${tool?.label ?? activeToolType}.`);
    setActiveToolType(null);
    setPlacementPreview(null);
    applyTemplate(template, 'save');
  }

  function addObject(type: ReportObjectType) {
    if (!selectedReport || !effectiveTemplate || !selectedPage) {
      setError('Create or select a report first, then click a tool to add an object.');
      return;
    }
    const object = newObject(type, selectedPage.objects.length + 1);
    object.x = snapToGrid(object.x, gridEnabled, gridSize);
    object.y = snapToGrid(object.y, gridEnabled, gridSize);
    const template: ReportTemplate = {
      ...effectiveTemplate,
      pages: effectiveTemplate.pages.map((page) => page.id === selectedPage.id ? { ...page, objects: [...page.objects, object] } : page)
    };
    setSelectedObjectId(object.id);
    setActiveToolType(null);
    setPlacementPreview(null);
    const tool = tools.find((candidate) => candidate.type === type);
    setNotice(`Added ${tool?.label ?? type}.`);
    applyTemplate(template, 'save');
  }

  function updateObject(patch: Partial<ReportObjectDefinition>) {
    if (!selectedReport || !effectiveTemplate || !selectedPage || !selectedObject) return;
    if (selectedObject.locked && Object.keys(patch).some((key) => ['x', 'y', 'width', 'height'].includes(key))) return;

    const template: ReportTemplate = {
      ...effectiveTemplate,
      pages: effectiveTemplate.pages.map((page) => page.id === selectedPage.id ? {
        ...page,
        objects: page.objects.map((object) => object.id === selectedObject.id
          ? applyReportObjectPatch(object, patch)
          : object)
      } : page)
    };
    applyTemplate(template, 'debounced');
  }

  function patchObjectById(id: string, patch: Partial<ReportObjectDefinition>, mode: 'local' | 'debounced' | 'save' = 'debounced') {
    if (!selectedReport || !effectiveTemplate || !selectedPage) return;
    const nextPatch = { ...patch };
    if (gridEnabled) {
      const size = normalizeGridSize(gridSize);
      if (nextPatch.x !== undefined) nextPatch.x = snapToGrid(nextPatch.x, true, size);
      if (nextPatch.y !== undefined) nextPatch.y = snapToGrid(nextPatch.y, true, size);
      if (nextPatch.width !== undefined) nextPatch.width = Math.max(size, snapToGrid(nextPatch.width, true, size));
      if (nextPatch.height !== undefined) nextPatch.height = Math.max(size, snapToGrid(nextPatch.height, true, size));
    }
    const template: ReportTemplate = {
      ...effectiveTemplate,
      pages: effectiveTemplate.pages.map((page) => page.id === selectedPage.id ? {
        ...page,
        objects: page.objects.map((object) => object.id === id
          ? applyReportObjectPatch(object, nextPatch)
          : object)
      } : page)
    };
    applyTemplate(template, mode);
  }

  async function deleteObject() {
    if (!selectedReport || !effectiveTemplate || !selectedPage || !selectedObject) return;
    if (!await showConfirm(`Delete object "${selectedObject.name}"?`)) return;
    const template: ReportTemplate = {
      ...effectiveTemplate,
      pages: effectiveTemplate.pages.map((page) => page.id === selectedPage.id ? {
        ...page,
        objects: page.objects.filter((object) => object.id !== selectedObject.id)
      } : page)
    };
    setSelectedObjectId(undefined);
    applyTemplate(template, 'save');
  }

  function duplicateObject() {
    if (!selectedReport || !effectiveTemplate || !selectedPage || !selectedObject) return;
    const copy: ReportObjectDefinition = {
      ...selectedObject,
      id: `report_object_${Date.now()}`,
      name: `${selectedObject.name}_copy`,
      x: selectedObject.x + 20,
      y: selectedObject.y + 20,
      layer: selectedPage.objects.length + 1
    };
    const template: ReportTemplate = {
      ...effectiveTemplate,
      pages: effectiveTemplate.pages.map((page) => page.id === selectedPage.id ? { ...page, objects: [...page.objects, copy] } : page)
    };
    setSelectedObjectId(copy.id);
    applyTemplate(template, 'save');
  }

  function layerSelected(direction: 'front' | 'back') {
    if (!selectedReport || !selectedPage || !selectedObject) return;
    const nextLayer = direction === 'front'
      ? Math.max(...selectedPage.objects.map((object) => object.layer ?? 0), 0) + 1
      : Math.min(...selectedPage.objects.map((object) => object.layer ?? 0), 0) - 1;
    updateObject({ layer: nextLayer });
  }

  async function validateReport(showMessage = true): Promise<ReportValidationResult> {
    if (isSpreadsheetReport) {
      const template = selectedReport?.template;
      const sheets = template?.spreadsheet?.snapshot?.sheets;
      const bindings = template?.spreadsheet?.bindings ?? [];
      
      const errors: string[] = [];
      const warnings: ReportValidationIssue[] = [];

      // 1. Worksheet validation
      if (!sheets || !Array.isArray(sheets) || sheets.length === 0) {
        errors.push('Spreadsheet report must have at least 1 worksheet snapshot.');
      } else {
        // 2. Bindings validation
        if (bindings.length === 0) {
          warnings.push({
            message: 'Spreadsheet has no bindings defined. Live data will not be resolved.',
            severity: 'warning'
          });
        } else {
          const bindingCells = new Set<string>();
          
          for (let i = 0; i < bindings.length; i++) {
            const b = bindings[i];
            const prefix = `Binding #${i + 1}:`;
            
            if (!b.sheetName?.trim()) {
              errors.push(`${prefix} Missing sheetName.`);
            }
            
            const cell = b.cell?.trim();
            if (!cell) {
              errors.push(`${prefix} Missing cell address.`);
            } else if (!/^[A-Z]+[0-9]+$/.test(cell)) {
              errors.push(`${prefix} Invalid cell address "${cell}". Must be format like A1, B12.`);
            }
            
            const validKinds = ['report_meta', 'tag_metric', 'billing_metric', 'text_template'];
            if (!b.kind) {
              errors.push(`${prefix} Missing binding kind.`);
            } else if (!validKinds.includes(b.kind)) {
              errors.push(`${prefix} Invalid binding kind "${b.kind}". Must be one of: ${validKinds.join(', ')}.`);
            } else {
              if (b.kind === 'tag_metric') {
                if (!b.tagId) {
                  errors.push(`${prefix} Kind "tag_metric" must specify tagId.`);
                } else {
                  const tagExists = tags.some((t) => t.id === b.tagId);
                  if (!tagExists) {
                    errors.push(`${prefix} Tag ID "${b.tagId}" not found in current project tags.`);
                  }
                }
              } else if (b.kind === 'billing_metric') {
                if (!b.metric) {
                  errors.push(`${prefix} Kind "billing_metric" must specify metric.`);
                }
              }
            }
            
            if (b.sheetName && cell) {
              const key = `${b.sheetName.trim()}!${cell.trim()}`;
              if (bindingCells.has(key)) {
                warnings.push({
                  message: `Duplicate binding for cell ${key}. New binding may override previous value.`,
                  severity: 'warning'
                });
              }
              bindingCells.add(key);
            }
          }
        }
      }

      setValidationWarnings(warnings);
      if (errors.length > 0) {
        setError(errors.join('\n'));
        return { ok: false, errors, warnings };
      }
      
      setError(undefined);
      if (showMessage) {
        if (warnings.length > 0) {
          const message = `Validation OK with ${warnings.length} warning(s).\n\n${warnings.slice(0, 8).map(w => w.message).join('\n')}${warnings.length > 8 ? `\n…and ${warnings.length - 8} more` : ''}`;
          setNotice(`Validation OK — ${warnings.length} warning(s)`);
          await showAlert(message);
        } else {
          setNotice('Spreadsheet report is ready. Refresh preview to validate bindings against live data.');
          await showAlert('Spreadsheet report validation successful! All sheets and bindings are valid.');
        }
      }
      return { ok: true, errors: [], warnings };
    }

    const { errors, warnings } = collectTemplateValidation(effectiveTemplate, selectedReport);

    setValidationWarnings(warnings);
    const firstIssue = warnings.find((warning) => warning.objectId);
    if (firstIssue?.pageId) setSelectedPageId(firstIssue.pageId);
    if (firstIssue?.objectId) setSelectedObjectId(firstIssue.objectId);

    if (errors.length > 0) {
      setError(errors.join('\n'));
      return { ok: false, errors, warnings };
    }

    setError(undefined);
    if (showMessage) {
      if (warnings.length > 0) {
        const message = `Validation OK with ${warnings.length} warning(s).\n\n${warnings.slice(0, 8).map((warning) => warning.message).join('\n')}${warnings.length > 8 ? `\n…and ${warnings.length - 8} more` : ''}`;
        setNotice(`Validation OK — ${warnings.length} warning(s)`);
        await showAlert(message);
      } else {
        const objectCount = effectiveTemplate?.pages?.reduce((sum, page) => sum + page.objects.length, 0) ?? 0;
        const pageCount = effectiveTemplate?.pages?.length ?? 0;
        const message = `Validation successful: ${selectedReport!.name} has ${objectCount} object(s) across ${pageCount} page(s)`;
        setNotice(message);
        await showAlert(message);
      }
    }
    return { ok: true, errors: [], warnings };
  }

  function canPreviewReport(): boolean {
    const { errors } = collectTemplateValidation(effectiveTemplate, selectedReport);
    return errors.length === 0 && Boolean(reportForActions);
  }

  async function previewReport() {
    if (isSpreadsheetReport) {
      setNotice('Spreadsheet Report ให้ใช้ปุ่ม Refresh Preview ของ spreadsheet mode');
      return;
    }
    flushPendingTemplateSave();
    if (effectiveTemplate && selectedReport) await persistTemplate(effectiveTemplate);
    if (!canPreviewReport()) {
      const { errors } = collectTemplateValidation(effectiveTemplate, selectedReport);
      if (errors.length) setError(errors.join('\n'));
      return;
    }

    setGenerateBusy(true);
    setError(undefined);
    // Attempt PDF runtime preview from Engine
    const res = await reportsGenerateApi.generate(selectedReport.id, {
      format: 'pdf',
      tariffId: reportTariffId || undefined,
      requestedBy: 'editor-desktop-preview',
    });
    setGenerateBusy(false);

    if (res && !('message' in res) && res.data?.generated) {
      const generated = res.data.generated;
      const downloadUrl = `${cleanUrl}${generated.downloadUrl}`;
      window.open(downloadUrl, '_blank', 'noopener,noreferrer');
      setNotice('เปิด Runtime Preview สำเร็จ (สร้างจากข้อมูลจริงบน Engine)');
    } else {
      setError('กรุณาเปิด Engine ก่อนใช้งาน Runtime Preview / Export (ระบบจะแสดง Design Preview ทดแทน)');
      const win = window.open('', '_blank', 'width=1100,height=800');
      if (!win) {
        setError('Cannot open preview window. Please allow popups for this app.');
        return;
      }
      win.document.write(makeHtmlReport(reportForActions!));
      win.document.close();
    }
  }

  async function generateReportFromEngine(format: ExportFormat) {
    flushPendingTemplateSave();
    if (effectiveTemplate && selectedReport) {
      await persistTemplate(effectiveTemplate);
    }

    const check = await validateReport(false);
    if (!check.ok || !selectedReport) return;
    if (check.warnings.length > 0) {
      setNotice(`Exporting with ${check.warnings.length} warning(s) — bind tags for live data where needed.`);
    }

    setGenerateBusy(true);
    setError(undefined);
    const res = await reportsGenerateApi.generate(selectedReport.id, {
      format,
      tariffId: reportTariffId || undefined,
      requestedBy: 'editor-desktop',
    });
    setGenerateBusy(false);

    if ('message' in res) {
      const hint = res.message.includes('fetch') || res.message.includes('Failed')
        ? `${res.message} — ตรวจสอบว่าเปิด Engine แล้ว (pnpm dev:engine)`
        : res.message;
      setError(hint);
      return;
    }

    const generated = res.data.generated;
    const downloadUrl = `${cleanUrl}${generated.downloadUrl}`;
    window.open(downloadUrl, '_blank', 'noopener,noreferrer');
    setNotice(`Generated ${format.toUpperCase()}: ${generated.fileName} (${generated.period.label})`);
  }

  async function exportReport(format: ExportFormat) {
    await generateReportFromEngine(format);
  }

  function exportTemplateJson() {
    if (!selectedReport) return;
    downloadFile(`${safeName(selectedReport.name)}_template.json`, 'application/json;charset=utf-8', JSON.stringify(selectedReport, null, 2));
  }

  function pageSetup() {
    if (!selectedReport || !selectedPage) { setError('No report selected'); return; }
    const nextOrientation = selectedReport.orientation === 'landscape' ? 'portrait' : 'landscape';
    void updateReportField('orientation', nextOrientation);
  }

  async function printReport() {
    if (isSpreadsheetReport) {
      setNotice('Use Export PDF in spreadsheet mode.');
      return;
    }
    if (!canPreviewReport()) {
      const { errors } = collectTemplateValidation(effectiveTemplate, selectedReport);
      if (errors.length) setError(errors.join('\n'));
      return;
    }
    const win = window.open('', '_blank', 'width=1100,height=800');
    if (!win) { setError('Cannot open print window. Please allow popups for this app.'); return; }
    win.document.write(makeHtmlReport(reportForActions!));
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
  }

  const flushPendingTemplateSave = React.useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const pending = pendingTemplateRef.current ?? draftTemplate;
    pendingTemplateRef.current = null;
    if (!pending || !selectedReport) return;
    if (JSON.stringify(pending) === lastPersistedTemplateRef.current) return;
    void persistTemplate(pending);
  }, [draftTemplate, selectedReport?.id]);

  React.useEffect(() => {
    function onMove(event: PointerEvent) {
      if (!dragState || !selectedPage) return;
      const dx = event.clientX - dragState.startX;
      const dy = event.clientY - dragState.startY;
      const pageObject = selectedPage.objects.find((item) => item.id === dragState.id);
      const maxX = pageObject ? Math.max(0, selectedPage.width - pageObject.width) : selectedPage.width;
      const maxY = pageObject ? Math.max(0, selectedPage.height - pageObject.height) : selectedPage.height;

      if (dragState.kind === 'move') {
        patchObjectById(dragState.id, {
          x: clamp(snapToGrid(dragState.objectX + dx, gridEnabled, gridSize), 0, maxX),
          y: clamp(snapToGrid(dragState.objectY + dy, gridEnabled, gridSize), 0, maxY),
        }, 'local');
      } else if (dragState.kind === 'resize' && dragState.objectW !== undefined && dragState.objectH !== undefined) {
        let { objectX: x, objectY: y, objectW: w, objectH: h } = dragState;
        const hnd = dragState.handle;

        if (hnd?.includes('e')) w = dragState.objectW + dx;
        if (hnd?.includes('s')) h = dragState.objectH + dy;
        if (hnd?.includes('w')) { x = dragState.objectX + dx; w = dragState.objectW - dx; }
        if (hnd?.includes('n')) { y = dragState.objectY + dy; h = dragState.objectH - dy; }

        const minSize = normalizeGridSize(gridSize);
        w = Math.max(minSize, snapToGrid(w, gridEnabled, gridSize));
        h = Math.max(minSize, snapToGrid(h, gridEnabled, gridSize));
        x = snapToGrid(x, gridEnabled, gridSize);
        y = snapToGrid(y, gridEnabled, gridSize);

        patchObjectById(dragState.id, {
          x: clamp(x, 0, maxX),
          y: clamp(y, 0, maxY),
          width: w,
          height: h,
        }, 'local');
      }
    }

    function onUp() {
      if (dragState) flushPendingTemplateSave();
      setDragState(null);
    }

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [dragState, effectiveTemplate, selectedPage, flushPendingTemplateSave, gridEnabled, gridSize]);

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && activeToolType) {
        setActiveToolType(null);
        setPlacementPreview(null);
        setNotice('ยกเลิกการวางวัตถุ');
        return;
      }
      if (!selectedObject) return;
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes((event.target as HTMLElement)?.tagName)) return;

      const step = event.shiftKey ? 20 : 1;
      if (event.key === 'Delete') { event.preventDefault(); deleteObject(); }
      if (event.ctrlKey && event.key.toLowerCase() === 'd') { event.preventDefault(); duplicateObject(); }
      if (event.key === 'ArrowLeft') { event.preventDefault(); updateObject({ x: Math.max(0, selectedObject.x - step) }); }
      if (event.key === 'ArrowRight') { event.preventDefault(); updateObject({ x: selectedObject.x + step }); }
      if (event.key === 'ArrowUp') { event.preventDefault(); updateObject({ y: Math.max(0, selectedObject.y - step) }); }
      if (event.key === 'ArrowDown') { event.preventDefault(); updateObject({ y: selectedObject.y + step }); }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeToolType, selectedObject, selectedReport, selectedPage]);

  React.useEffect(() => {
    async function onCommand(event: Event) {
      const detail = (event as CustomEvent<EditorCommand>).detail;
      if (detail.module !== 'reports') return;
      const item = normalizeCommand(detail.item);
      if (item === 'designer' || item === 'reports list') void loadReports();
      else if (item === 'save') effectiveTemplate && void saveTemplate(effectiveTemplate, { notify: true });
      else if (item === 'validate') await validateReport();
      else if (item === 'preview') await previewReport();
      else if (item === 'page setup') pageSetup();
      else if (item === 'export pdf') await exportReport('pdf');
      else if (item === 'export excel') await exportReport('excel');
      else if (item === 'print') await printReport();
      else if (item === 'new report') await createReport();
      else if (item === 'delete') await deleteReport();
      else if (item === 'set default') void setDefaultReport();
      else if (item === 'export template') exportTemplateJson();
      else if (item === 'duplicate') duplicateObject();
      else if (item === 'bring front') layerSelected('front');
      else if (item === 'send back') layerSelected('back');
      else if (item === 'delete object') await deleteObject();
      else if (item === 'grid 20px' || isGridCommand(item)) {
        const parsedSize = parseGridSizeFromCommand(item);
        if (parsedSize != null) setGridSize(parsedSize);
        setGridEnabled((value) => {
          const next = !value;
          setNotice(`Grid ${normalizeGridSize(parsedSize ?? gridSize)}px ${next ? 'enabled' : 'disabled'}.`);
          return next;
        });
      }
      else if (item === 'align') setNotice('เลือกวัตถุแล้วปรับตำแหน่ง X/Y');
      else if (item === 'lock') selectedObject && updateObject({ locked: !selectedObject.locked });
      else {
        const objectType = resolveReportObjectType(item);
        if (objectType) selectReportTool(objectType);
      }
    }
    window.addEventListener(EDITOR_COMMAND_EVENT, onCommand);
    return () => window.removeEventListener(EDITOR_COMMAND_EVENT, onCommand);
  }, [selectedReport, selectedPage, selectedObject, effectiveTemplate, activeToolType, isSpreadsheetReport]);

  function applyExternalReportUpdate(updated: ReportSummary) {
    setReports((prev) => prev.map((item) => item.id === updated.id ? updated : item));
    if (updated.id === selectedReport?.id) {
      if (updated.template?.mode === 'spreadsheet') setDraftTemplate(null);
      else if (updated.template?.pages?.length) setDraftTemplate(updated.template);
    }
  }

  return (
    <div className="report-designer-shell">
      {/* Tab bar header */}
      <div className="report-tab-bar">
        <button
          className={`report-tab-btn ${activeTab === 'designer' ? 'active' : ''}`}
          onClick={() => setActiveTab('designer')}
        >
          <Icon icon="solar:palette-bold-duotone" width="16" height="16" />
          ออกแบบรายงาน
        </button>
        <button
          className={`report-tab-btn ${activeTab === 'scheduler' ? 'active' : ''}`}
          onClick={() => setActiveTab('scheduler')}
        >
          <Icon icon="solar:calendar-bold-duotone" width="16" height="16" />
          ตารางเวลา
        </button>
        <button
          className={`report-tab-btn ${activeTab === 'billing' ? 'active' : ''}`}
          onClick={() => setActiveTab('billing')}
        >
          <Icon icon="solar:wallet-money-bold-duotone" width="16" height="16" />
          ค่าไฟ
        </button>
        <div className="tab-spacer" />
        {activeProject && activeTab === 'designer' && (
          <div className="tab-actions">
            <button className="btn primary small-btn" onClick={() => void createReport()} style={{ display: 'inline-flex', alignItems: 'center' }}>
              <Icon icon="solar:document-add-bold-duotone" width="14" height="14" style={{ marginRight: 5, color: '#fff', verticalAlign: 'middle' }} />
              สร้างรายงาน
            </button>
            {selectedReport && (
              <button className="btn danger small-btn" onClick={deleteReport} style={{ display: 'inline-flex', alignItems: 'center' }}>
                <Icon icon="solar:trash-bin-trash-bold-duotone" width="14" height="14" style={{ marginRight: 5, color: '#fff', verticalAlign: 'middle' }} />
                ลบรายงาน
              </button>
            )}
          </div>
        )}
      </div>

      {!activeProject ? (
        <div className="dv-no-project-overlay" style={{ marginTop: 20 }}>
          <div className="dv-no-project-card">
            <div className="dv-no-project-icon">
              <Icon icon="solar:folder-error-bold-duotone" width="48" height="48" />
            </div>
            <h2>No Active Project Selected</h2>
            <p>Please select or create an active project in the Project Manager before designing reports.</p>
            <button className="btn primary" onClick={() => window.dispatchEvent(new CustomEvent('energylink:switch-module', { detail: 'file' }))}>
              <Icon icon="solar:document-bold-duotone" width="16" height="16" style={{ marginRight: 6, color: '#fff', verticalAlign: 'middle' }} />
              Go to Project Manager
            </button>
          </div>
        </div>
      ) : activeTab === 'scheduler' ? (
        <div className="scheduler-tab-content">
          {error && <div className="error-box">{error}</div>}
          {notice && <div className="notice">{notice}</div>}
          <ReportSchedulerPanel reports={reports} />
        </div>
      ) : activeTab === 'billing' ? (
        <div className="scheduler-tab-content billing-tab-content">
          <BillingPanel projectId={activeProject.id} />
        </div>
      ) : isSpreadsheetReport && selectedReport ? (
        <>
          {error ? (
            <div className="error-box" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
              <span style={{ whiteSpace: 'pre-wrap' }}>{error}</span>
              <button type="button" className="btn secondary small-btn" onClick={() => setError(undefined)} aria-label="Dismiss">x</button>
            </div>
          ) : null}
          {notice && <div className="notice">{notice}</div>}
          <SpreadsheetReportWorkspace
            report={selectedReport}
            reports={reports}
            loading={loading}
            reportSearch={reportSearch}
            onReportSearchChange={setReportSearch}
            onSelectReport={(id) => { setSelectedReportId(id); setSelectedObjectId(undefined); }}
            onCreateReport={createReport}
            onDeleteReport={deleteReport}
            onReportUpdated={applyExternalReportUpdate}
            onUpdateReportField={updateReportField}
            onExport={exportReport}
            onNotice={(message) => setNotice(message)}
            onError={(message) => setError(message)}
            generateBusy={generateBusy}
            tags={tags}
            tariffs={tariffs}
            reportTariffId={reportTariffId}
            onReportTariffChange={setReportTariffId}
          />
        </>
      ) : (
        <section className="report-main">
          {error ? (
            <div className="error-box" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
              <span style={{ whiteSpace: 'pre-wrap' }}>{error}</span>
              <button type="button" className="btn secondary small-btn" onClick={() => setError(undefined)} aria-label="Dismiss">×</button>
            </div>
          ) : null}
          {validationWarnings.length > 0 ? (
            <div className="notice warn" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
              <div>
                <strong>คำเตือน ({validationWarnings.length})</strong>
                <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                  {validationWarnings.slice(0, 5).map((warning, index) => (
                    <li key={`${warning.objectId ?? 'report'}-${index}`}>
                      {warning.objectId ? (
                        <button
                          type="button"
                          className="link-button"
                          onClick={() => setSelectedObjectId(warning.objectId)}
                          style={{ padding: 0, textAlign: 'left' }}
                        >
                          {warning.message}
                        </button>
                      ) : warning.message}
                    </li>
                  ))}
                  {validationWarnings.length > 5 ? <li>…และอีก {validationWarnings.length - 5} รายการ</li> : null}
                </ul>
              </div>
              <button type="button" className="btn secondary small-btn" onClick={() => setValidationWarnings([])} aria-label="Dismiss">×</button>
            </div>
          ) : null}
          {notice && <div className="notice">{notice}</div>}

          {selectedReport && (
            <div className="report-designer-toolbar">
              <div className="report-designer-toolbar-group">
                <EditorGridControls
                  enabled={gridEnabled}
                  size={gridSize}
                  style={gridStyle}
                  onEnabledChange={setGridEnabled}
                  onSizeChange={setGridSize}
                  onStyleChange={setGridStyle}
                />
                <button type="button" className="btn secondary small-btn" onClick={() => effectiveTemplate && void saveTemplate(effectiveTemplate)}>
                  <Icon icon="solar:diskette-bold-duotone" width="14" height="14" />
                  บันทึก
                </button>
                <button type="button" className="btn secondary small-btn" onClick={() => void validateReport()}>
                  <Icon icon="solar:shield-check-bold-duotone" width="14" height="14" />
                  ตรวจ
                </button>
                <button type="button" className="btn secondary small-btn" onClick={() => void previewReport()}>
                  <Icon icon="solar:eye-bold-duotone" width="14" height="14" />
                  ดู (Design Preview)
                </button>
              </div>
              <div className="report-designer-toolbar-group">
                <button type="button" className="btn primary small-btn" disabled={generateBusy} onClick={() => void exportReport('pdf')}>
                  <Icon icon="solar:file-text-bold-duotone" width="14" height="14" />
                  Export PDF
                </button>
                <button type="button" className="btn secondary small-btn" disabled={generateBusy} onClick={() => void exportReport('excel')}>
                  <Icon icon="solar:document-bold-duotone" width="14" height="14" />
                  Export Excel Data
                </button>
                <button type="button" className="btn secondary small-btn" onClick={() => void printReport()}>
                  <Icon icon="solar:printer-bold-duotone" width="14" height="14" />
                  พิมพ์
                </button>
              </div>
              <div className="report-designer-toolbar-meta">
                <span>{selectedReport.name}</span>
                <span>หน้า {pages.findIndex(p => p.id === selectedPageId) + 1}/{pages.length}</span>
                <span>{selectedPage?.objects.length ?? 0} ชิ้น</span>
              </div>
              {/* Page tabs */}
              {pages.length > 0 && (
                <div style={{ display: 'flex', gap: 4, alignItems: 'center', padding: '4px 0' }}>
                  {pages.map((page, idx) => (
                    <button
                      key={page.id}
                      type="button"
                      className={`btn ${page.id === selectedPageId ? 'primary' : 'secondary'} small-btn`}
                      onClick={() => { setSelectedPageId(page.id); setSelectedObjectId(undefined); }}
                      style={{ fontSize: 11, padding: '3px 8px' }}
                      title={`หน้า ${idx + 1}: ${page.name}`}
                    >
                      <Icon icon="solar:document-bold-duotone" width="12" height="12" style={{ marginRight: 3, verticalAlign: 'middle' }} />
                      {idx + 1}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="btn secondary small-btn"
                    onClick={addPage}
                    title="เพิ่มหน้า"
                    style={{ fontSize: 11, padding: '3px 6px' }}
                  >
                    <Icon icon="solar:add-square-bold-duotone" width="12" height="12" />
                  </button>
                  {pages.length > 1 && selectedPage && (
                    <button
                      type="button"
                      className="btn danger small-btn"
                      onClick={() => deletePage(selectedPage.id)}
                      title="ลบหน้านี้"
                      style={{ fontSize: 11, padding: '3px 6px' }}
                    >
                      <Icon icon="solar:trash-bin-trash-bold-duotone" width="12" height="12" />
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
          
          <div className="report-layout" style={{ display: 'flex', flexDirection: 'row', width: '100%', height: '100%', flex: 1, minHeight: 0, overflow: 'hidden' }}>
            
            <aside className="report-sidebar report-list-panel" style={{ width: 260, flexShrink: 0, display: 'flex', flexDirection: 'column', background: '#f8fafc', borderRight: '1px solid #e2e8f0', overflowY: 'auto' }}>
              {/* Reports list section */}
              <div className="report-sidebar-section">
                <div className="section-title">รายงาน</div>
                <input
                  type="text"
                  placeholder="ค้นหา..."
                  value={reportSearch}
                  onChange={(e) => setReportSearch(e.target.value)}
                  className="report-search-input"
                />
                <div className="report-list-container">
                  {loading ? (
                    <p className="loading-text">กำลังโหลด…</p>
                  ) : reports.length === 0 ? (
                    <p className="loading-text">ยังไม่มีรายงาน</p>
                  ) : (
                    reports.filter(r => r.name.toLowerCase().includes(reportSearch.toLowerCase())).map((report) => (
                      <button
                        key={report.id}
                        className={selectedReport?.id === report.id ? 'report-list-item active' : 'report-list-item'}
                        onClick={() => { setSelectedReportId(report.id); setSelectedObjectId(undefined); }}
                      >
                        <Icon icon="solar:document-text-bold-duotone" width="16" height="16" className="report-icon" />
                        <div className="report-info">
                          <div className="report-name">{report.isDefault ? '★ ' : ''}{report.name}</div>
                          <div style={{ fontSize: 10, opacity: 0.6, marginTop: 1 }}>{report.reportType}</div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Tools section */}
              <div className="report-sidebar-section" style={{ flex: 1, borderBottom: 'none' }}>
                <div className="section-title">เครื่องมือ</div>
                <div className="report-tools-container">
                  {REPORT_TOOL_CATEGORIES.map((cat) => {
                    const meta = REPORT_TOOL_CATEGORY_META[cat];
                    const collapsed = collapsedToolCategories.has(cat);
                    const catTools = tools.filter((t) => t.category === cat);
                    return (
                    <div key={cat} className={`report-tool-category${collapsed ? ' is-collapsed' : ''}`}>
                      <button
                        type="button"
                        className="tool-category-title tool-category-toggle"
                        onClick={() => toggleToolCategory(cat)}
                        aria-expanded={!collapsed}
                      >
                        <span>{meta.title}</span>
                        <Icon icon={collapsed ? 'solar:alt-arrow-right-linear' : 'solar:alt-arrow-down-linear'} width={14} height={14} />
                      </button>
                      {!collapsed ? (
                        <div className="report-tool-grid">
                          {catTools.map((tool) => (
                            <button
                              key={tool.type}
                              type="button"
                              className={`report-tool-btn${activeToolType === tool.type ? ' active' : ''}`}
                              onClick={() => selectReportTool(tool.type)}
                              title={tool.label}
                              disabled={!selectedReport}
                            >
                                <span className="tool-icon">{tool.icon}</span>
                                <span className="tool-label">{tool.label}</span>
                              </button>
                            ))}
                        </div>
                      ) : null}
                    </div>
                    );
                  })}
                </div>
              </div>
            </aside>

            <div className="report-page-wrap" style={{ flex: 1, minWidth: 0, overflow: 'auto', background: '#cfd9e5', padding: 30, display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
              {!selectedReport ? (
                <div className="empty-state">
                  <Icon icon="solar:document-add-bold-duotone" width="48" height="48" style={{ color: '#8b5cf6', opacity: 0.5, display: 'block', margin: '0 auto 12px' }} />
                  <div>กดปุ่ม สร้างรายงาน</div>
                </div>
              ) : !selectedPage ? (
                <div className="empty-state" style={{ fontSize: 13, color: '#64748b' }}>
                  <Icon icon="solar:settings-bold-duotone" width="32" height="32" style={{ color: '#8b5cf6', opacity: 0.4, display: 'block', margin: '0 auto 8px' }} />
                  <div>Preparing report canvas...</div>
                </div>
              ) : (
                <div
                  className="report-page-canvas report-designer-canvas ge-root"
                  style={{
                    position: 'relative',
                    width: selectedPage.width,
                    minHeight: selectedPage.height,
                    cursor: activeToolType ? 'crosshair' : 'default',
                    background: pageBackgroundIsTransparent(selectedPage.backgroundColor)
                      ? 'repeating-conic-gradient(#e2e8f0 0% 25%, #f8fafc 0% 50%) 50% / 20px 20px'
                      : (selectedPage.backgroundColor ?? '#fff'),
                  }}
                  onPointerMove={(event) => {
                    if (!activeToolType) return;
                    const target = event.currentTarget as HTMLDivElement;
                    const rect = target.getBoundingClientRect();
                    updatePlacementPreview(event.clientX - rect.left, event.clientY - rect.top);
                  }}
                  onPointerLeave={() => {
                    if (activeToolType) setPlacementPreview(null);
                  }}
                  onClick={(event) => {
                    if (activeToolType) {
                      const target = event.currentTarget as HTMLDivElement;
                      const rect = target.getBoundingClientRect();
                      placeObjectAt(event.clientX - rect.left, event.clientY - rect.top);
                    } else {
                      setSelectedObjectId(undefined);
                    }
                  }}
                >
                  {gridEnabled ? <EditorGridOverlay size={gridSize} style={gridStyle} /> : null}
                  {activeToolType && activePlacementTool ? (
                    <div
                      style={{
                        position: 'absolute',
                        top: 10,
                        left: 10,
                        zIndex: 3,
                        padding: '6px 10px',
                        borderRadius: 999,
                        background: 'rgba(15, 23, 42, 0.82)',
                        color: '#ffffff',
                        fontSize: 12,
                        fontWeight: 600,
                        pointerEvents: 'none',
                      }}
                    >
                      {activePlacementTool.label} | Click to place | Esc to cancel
                    </div>
                  ) : null}
                  {activeToolType && placementPreview && placementPreviewObject ? (
                    <div
                      style={{
                        position: 'absolute',
                        left: placementPreview.x,
                        top: placementPreview.y,
                        width: placementPreviewObject.width,
                        height: placementPreviewObject.height,
                        zIndex: 2,
                        border: '1px dashed #2563eb',
                        background: 'rgba(37, 99, 235, 0.12)',
                        borderRadius: 6,
                        boxSizing: 'border-box',
                        pointerEvents: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#1d4ed8',
                        fontSize: 12,
                        fontWeight: 700,
                        overflow: 'hidden',
                        textAlign: 'center',
                        padding: 6,
                      }}
                    >
                      {activePlacementTool?.label}
                    </div>
                  ) : null}
                  {selectedPage.objects
                    .slice()
                    .sort((a, b) => (a.layer ?? 0) - (b.layer ?? 0))
                    .map((object) => (
                      <ReportObjectView
                        key={object.id}
                        object={object}
                        selected={selectedObjectId === object.id}
                        onSelect={() => setSelectedObjectId(object.id)}
                        onPointerDown={(event) => {
                          if (object.locked) return;
                          setSelectedObjectId(object.id);
                          setDragState({ kind: 'move', id: object.id, startX: event.clientX, startY: event.clientY, objectX: object.x, objectY: object.y });
                        }}
                        onResizeStart={(handle, event) => {
                          if (object.locked) return;
                          setDragState({ kind: 'resize', handle, id: object.id, startX: event.clientX, startY: event.clientY, objectX: object.x, objectY: object.y, objectW: object.width, objectH: object.height });
                        }}
                        tags={tags}
                        devices={devices}
                        periodContext={periodContext}
                        reportPeriodInput={reportPeriodInput}
                        interactionDisabled={Boolean(activeToolType)}
                      />
                    ))}
                </div>
              )}
            </div>

            <div style={{ position: 'relative', width: 280, flex: '0 0 280px', display: 'flex', flexDirection: 'column', zIndex: 10, borderLeft: '1px solid #e2e8f0' }}>
              <InspectorPanel
                key={selectedObjectId ?? 'report-canvas'}
                className="ge-root"
                objects={selectedPage?.objects || []}
              selected={selectedObject || null}
              tags={tags}
              devices={devices}
              graphics={[]}
              currentGraphicId={null}
              stackCustomInspector
              preferCustomInspector={preferReportOnlyInspector}
              pinnedInspectorHeader={selectedReport && selectedPage ? (
                <>
                  <ReportPageBackgroundSection
                    color={selectedPage.backgroundColor ?? '#ffffff'}
                    onChange={(color) => {
                      if (!effectiveTemplate) return;
                      applyTemplate({
                        ...effectiveTemplate,
                        pages: effectiveTemplate.pages.map((p) => p.id === selectedPage.id ? { ...p, backgroundColor: color } : p),
                      }, 'debounced');
                    }}
                  />
                  {selectedObject ? (
                    <ReportDecorationSection
                      object={selectedObject}
                      onPatch={(patch) => patchObjectById(selectedObject.id, patch)}
                    />
                  ) : null}
                </>
              ) : null}
              canvasBg={pageBackgroundIsTransparent(selectedPage?.backgroundColor) ? '#ffffff' : (selectedPage?.backgroundColor ?? '#ffffff')}
              onCanvasBg={(color) => {
                if (effectiveTemplate && selectedPage) {
                  applyTemplate({
                    ...effectiveTemplate,
                    pages: effectiveTemplate.pages.map((p) => p.id === selectedPage.id ? { ...p, backgroundColor: color } : p)
                  }, 'debounced');
                }
              }}
              onSelect={(id) => setSelectedObjectId(id ?? undefined)}
              onUpdate={(id, patch) => patchObjectById(id, patch)}
              onRemove={(id) => {
                if (!selectedReport || !effectiveTemplate || !selectedPage) return;
                void showConfirm(`Delete object?`).then(confirmed => {
                  if (confirmed) {
                    applyTemplate({
                      ...effectiveTemplate,
                      pages: effectiveTemplate.pages.map(page => page.id === selectedPage.id ? {
                        ...page,
                        objects: page.objects.filter(o => o.id !== id)
                      } : page)
                    }, 'save');
                    if (selectedObjectId === id) setSelectedObjectId(undefined);
                  }
                });
              }}
              onReorder={(id, dir) => {
                if (!selectedReport || !effectiveTemplate || !selectedPage) return;
                const objects = [...selectedPage.objects].sort((a, b) => (a.layer ?? 0) - (b.layer ?? 0));
                const index = objects.findIndex(o => o.id === id);
                if (index === -1) return;
                
                const target = objects[index];
                objects.splice(index, 1);
                
                if (dir === 'front') objects.push(target);
                else objects.unshift(target);
                
                objects.forEach((o, i) => { o.layer = i; });
                applyTemplate({
                  ...effectiveTemplate,
                  pages: effectiveTemplate.pages.map(page => page.id === selectedPage.id ? { ...page, objects } : page)
                }, 'save');
              }}
              renderCanvasProps={() => selectedReport ? (
                <>
                  <div className="ins-sec">
                    <div className="ins-sec-head">
                      <h4>รายงาน</h4>
                    </div>
                    <label className="ins-row"><span>ชื่อ</span><input value={selectedReport.name} onChange={(e) => void updateReportField('name', e.target.value)} /></label>
                    <label className="ins-row"><span>ประเภท</span><select value={selectedReport.reportType} onChange={(e) => void updateReportField('reportType', e.target.value)}><option value="daily_energy">รายวัน (Daily Energy)</option><option value="monthly_energy">รายเดือน (Monthly Energy)</option><option value="device_energy">ตามอุปกรณ์ (Device Energy)</option><option value="cost">ค่าใช้จ่าย (Energy Cost)</option><option value="alarm">แจ้งเตือน (Alarm)</option><option value="meter_billing">บิลค่าไฟ (Meter Billing)</option><option value="tou_cost">ค่าไฟ TOU (TOU Cost)</option><option value="demand">ความต้องการไฟฟ้าสูงสุด (Peak Demand)</option><option value="device_communication">การเชื่อมต่ออุปกรณ์ (Device Comm)</option><option value="carbon">คาร์บอนฟุตพริ้นท์ (Carbon Footprint)</option><option value="custom">กำหนดเอง (Custom)</option></select></label>
                  </div>

                  <div className="ins-sec">
                    <div className="ins-sec-head">
                      <h4>กระดาษ</h4>
                    </div>
                    <div className="ins-grid2">
                      <label className="ins-row"><span>ขนาด</span><select value={selectedReport.paperSize} onChange={(e) => void updateReportField('paperSize', e.target.value)}><option>A4</option><option>A3</option><option>Letter</option></select></label>
                      <label className="ins-row"><span>แนว</span><select value={selectedReport.orientation} onChange={(e) => void updateReportField('orientation', e.target.value)}><option value="landscape">แนวนอน</option><option value="portrait">แนวตั้ง</option></select></label>
                    </div>
                    <label className="ins-row" style={{ marginTop: 8 }}><span>ส่งออก</span><select value={selectedReport.outputFormat} onChange={(e) => void updateReportField('outputFormat', e.target.value)}><option value="pdf">PDF</option><option value="excel">Excel</option><option value="both">ทั้งคู่</option></select></label>
                  </div>

                  <div className="ins-sec">
                    <div className="ins-sec-head">
                      <h4>ข้อมูล</h4>
                    </div>
                    <label className="ins-row">
                      <span>ช่วงเวลา</span>
                      <select value={selectedReport.defaultDateRange} onChange={(e) => void updateReportField('defaultDateRange', e.target.value)}>
                        {REPORT_RANGE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </label>
                    <label className="ins-row" style={{ marginTop: 8 }}>
                      <span>อัตราค่าไฟ</span>
                      <select value={reportTariffId} onChange={(e) => setReportTariffId(e.target.value)} style={{ width: '100%' }}>
                        {tariffs.map((t) => (
                          <option key={t.id} value={t.id}>{t.name}{t.isDefault ? ' ★' : ''}</option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="ins-sec">
                    <div className="ins-sec-head">
                      <h4>พร้อมส่งออก</h4>
                    </div>
                    <div className="ins-empty" style={{ textAlign: 'left', marginBottom: 8 }}>
                      {selectedPage?.objects.length ?? 0} objects · {validationSnapshot.warnings.length} warnings · {periodContext.loading ? 'กำลังโหลดข้อมูล' : 'ข้อมูลพร้อม preview'}
                    </div>
                    {validationSnapshot.warnings.length > 0 ? (
                      <div style={{ display: 'grid', gap: 6 }}>
                        {validationSnapshot.warnings.slice(0, 5).map((warning, index) => (
                          <button
                            key={`${warning.objectId ?? 'report'}-${index}`}
                            type="button"
                            className="link-button"
                            style={{ textAlign: 'left', padding: 0 }}
                            onClick={() => {
                              if (warning.objectId) setSelectedObjectId(warning.objectId);
                              setValidationWarnings(validationSnapshot.warnings);
                            }}
                          >
                            {warning.message}
                          </button>
                        ))}
                        {validationSnapshot.warnings.length > 5 ? (
                          <span style={{ fontSize: 12, color: '#64748b' }}>และอีก {validationSnapshot.warnings.length - 5} รายการ</span>
                        ) : null}
                      </div>
                    ) : (
                      <button type="button" className="btn secondary small-btn" onClick={() => void validateReport()}>
                        <Icon icon="solar:shield-check-bold-duotone" width="14" height="14" />
                        ตรวจอีกครั้ง
                      </button>
                    )}
                  </div>
                </>
              ) : <div className="ins-empty">เลือกรายงาน</div>}
              renderCustomInspector={(selAny) => {
                const sel = selAny as ReportObjectDefinition;
                return (
                  <>
                    <ReportToolSettingsInspector
                      object={sel}
                      tags={tags}
                      devices={devices}
                      onPatch={(patch) => patchObjectById(sel.id, patch)}
                      periodContext={periodContext}
                    />
                    <ReportObjectSupplement
                      object={sel}
                      tags={tags}
                      devices={devices}
                      onPatch={(patch) => patchObjectById(sel.id, patch)}
                    />
                  </>
                );
              }}
              />
            </div>
          </div>
        </section>
      )}

      {/* New Report Modal */}
      {isCreateModalOpen && (
        <div className="rp-modal-overlay">
          <div className="rp-modal">
            <div className="rp-modal-header">
              <h3>สร้างรายงานใหม่</h3>
              <button className="close-btn" onClick={() => setIsCreateModalOpen(false)}>x</button>
            </div>
            <div className="rp-modal-body">
              <label>
                ชื่อ
                <input
                  type="text"
                  placeholder="รายงานค่าไฟ"
                  value={newReportName}
                  onChange={(e) => setNewReportName(e.target.value)}
                  autoFocus
                />
              </label>
              <label>
                ประเภท
                <select value={newReportType} onChange={(e) => setNewReportType(e.target.value)}>
                  <option value="daily_energy">รายวัน</option>
                  <option value="monthly_energy">รายเดือน</option>
                  <option value="device_energy">ตามอุปกรณ์</option>
                  <option value="cost">ค่าใช้จ่าย</option>
                  <option value="alarm">แจ้งเตือน</option>
                </select>
              </label>
              <label>
                Mode
                <select value={newReportMode} onChange={(e) => setNewReportMode(e.target.value as ReportMode)}>
                  <option value="canvas">Canvas report</option>
                  <option value="spreadsheet">Spreadsheet report</option>
                </select>
              </label>
              <div className="modal-row-2">
                <label>
                  ขนาด
                  <select value={newReportPaperSize} onChange={(e) => setNewReportPaperSize(e.target.value)}>
                    <option value="A4">A4</option>
                    <option value="A3">A3</option>
                    <option value="Letter">Letter</option>
                  </select>
                </label>
                <label>
                  แนว
                  <select value={newReportOrientation} onChange={(e) => setNewReportOrientation(e.target.value)}>
                    <option value="landscape">แนวนอน</option>
                    <option value="portrait">แนวตั้ง</option>
                  </select>
                </label>
              </div>
            </div>
            <div className="rp-modal-footer">
              <button className="btn secondary" onClick={() => setIsCreateModalOpen(false)}>ยกเลิก</button>
              <button className="btn primary" onClick={handleCreateReport} disabled={!newReportName.trim()}>สร้าง</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const;

function MeterBillingTableObjectView({
  object,
  tags,
  devices,
  reportPeriodInput,
}: {
  object: ReportObjectDefinition;
  tags: TagSummary[];
  devices: DeviceSummary[];
  reportPeriodInput: ReportPeriodContextInput;
}) {
  const { rows, loading } = useMeterBillingTableData(object, tags, devices, reportPeriodInput);
  return <MeterBillingTablePreview object={object} rows={rows} loading={loading} />;
}

function PeriodFieldObjectView({
  object,
  tags,
  reportPeriodInput,
  periodContext,
  preview,
  style,
  fieldAlign,
}: {
  object: ReportObjectDefinition;
  tags: TagSummary[];
  reportPeriodInput: ReportPeriodContextInput;
  periodContext: ReportPeriodContext;
  preview: ReturnType<typeof useReportObjectPreview>;
  style: Record<string, unknown>;
  fieldAlign: React.CSSProperties['textAlign'];
}) {
  const { display, loading } = useReportObjectFieldData(object, tags, reportPeriodInput, {
    tagSummaries: periodContext.tagSummaries,
    billing: periodContext.billing,
    liveValue: preview.primaryValue?.value != null ? Number(preview.primaryValue.value) : null,
  });

  const text = loading && !display ? '…' : (display || (object.type === 'formulavalue' ? 'สูตร' : 'ค่า'));

  return (
    <div style={{
      flex: 1,
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: fieldAlign === 'center' ? 'center' : fieldAlign === 'right' ? 'flex-end' : 'flex-start',
      fontSize: (style.fontSize as number | undefined) ?? 14,
      fontWeight: object.type === 'formulavalue' ? 600 : 400,
      color: (style.color as string | undefined) || '#0f172a',
      padding: '0 2px',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      opacity: loading ? 0.65 : 1,
    }}>
      {text}
    </div>
  );
}

function ReportObjectView({ object, selected, onSelect, onPointerDown, onResizeStart, tags, devices, periodContext, reportPeriodInput, interactionDisabled = false }: { object: ReportObjectDefinition; selected: boolean; onSelect(): void; onPointerDown(event: React.PointerEvent<HTMLButtonElement | HTMLDivElement>): void; onResizeStart(handle: string, event: React.PointerEvent<HTMLSpanElement>): void; tags: TagSummary[]; devices: DeviceSummary[]; periodContext: ReportPeriodContext; reportPeriodInput: ReportPeriodContextInput; interactionDisabled?: boolean }) {
  const preview = useReportObjectPreview(object, tags, devices);
  if (object.visible === false) return null;
  const style = object.style ?? {};
  const objectTagIds = resolveReportTagIds(object);
  const boundTag = tags.find((t) => t.id === objectTagIds[0]);
  const isDataBound = REPORT_DATA_BOUND_TYPES.has(object.type);
  const widgetDef = getWidgetByObjectType ? getWidgetByObjectType(object.type) : undefined;
  const isPeriodField = object.type === 'value' || object.type === 'formulavalue' || object.type === 'formula';
  const isMeterTable = object.type === 'meter_billing_table';
  const isGraphicWidget = Boolean(widgetDef) && !isPeriodField && !isMeterTable;
  const previewStyle = reportObjectPreviewStyle(object);
  const transparentChrome = object.style?.transparentBg === true
    || String(object.style?.background ?? object.style?.fill ?? '').toLowerCase() === 'transparent';

  const commonStyles: React.CSSProperties = {
    position: 'absolute',
    left: object.x,
    top: object.y,
    width: object.width,
    height: object.height,
    ...(isGraphicWidget
      ? { padding: 0, background: 'transparent', border: 'none', overflow: 'visible' }
      : previewStyle),
    outline: selected ? '2px solid #8b5cf6' : 'none',
    outlineOffset: 2,
    display: 'flex',
    flexDirection: 'column',
    cursor: interactionDisabled ? 'crosshair' : (object.locked ? 'default' : 'move'),
    boxSizing: 'border-box',
    overflow: isGraphicWidget ? 'visible' : 'hidden',
    pointerEvents: interactionDisabled ? 'none' : 'auto',
  };

  const fieldAlign = (style.align === 'center' || style.align === 'right' ? style.align : 'left') as React.CSSProperties['textAlign'];

  const renderWidgetContent = () => {
    if (isMeterTable) {
      return (
        <MeterBillingTableObjectView
          object={object}
          tags={tags}
          devices={devices}
          reportPeriodInput={reportPeriodInput}
        />
      );
    }

    if (isPeriodField) {
      return (
        <PeriodFieldObjectView
          object={object}
          tags={tags}
          reportPeriodInput={reportPeriodInput}
          periodContext={periodContext}
          preview={preview}
          style={style}
          fieldAlign={fieldAlign}
        />
      );
    }

    if (isGraphicWidget) {
      const chartTableMode = preview.viewMode === 'table' && (object.type === 'trend' || object.type === 'echart');
      if (chartTableMode) {
        return (
          <ReportTrendTablePreview
            title={object.text || object.name}
            points={preview.tablePoints}
            unit={preview.primaryValue?.unit ?? undefined}
          />
        );
      }
      return (
        <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', pointerEvents: 'none' }}>
          <RtObject
            obj={{ ...object, x: 0, y: 0 }}
            index={0}
            value={preview.primaryValue}
            values={object.type === 'tagtable' ? preview.values : undefined}
            valuesByTag={preview.valuesByTag}
            trend={preview.trend ?? undefined}
            trendSeries={preview.trendSeries}
            runtimeMode={false}
            animate={false}
          />
        </div>
      );
    }

    switch (object.type) {
      case 'date':
        const formatStr = object.props?.format || 'YYYY-MM-DD';
        const d = new Date();
        const dateStr = formatStr
          .replace('YYYY', d.getFullYear().toString())
          .replace('MMMM', d.toLocaleString('en-US', { month: 'long' }))
          .replace('MMM', d.toLocaleString('en-US', { month: 'short' }))
          .replace('MM', (d.getMonth() + 1).toString().padStart(2, '0'))
          .replace('DD', d.getDate().toString().padStart(2, '0'))
          .replace('Do', d.getDate() + (['th', 'st', 'nd', 'rd'][((d.getDate() % 100) - 20) % 10] || ['th', 'st', 'nd', 'rd'][d.getDate() % 100] || 'th'))
          .replace('HH', d.getHours().toString().padStart(2, '0'))
          .replace('mm', d.getMinutes().toString().padStart(2, '0'));
        return (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: style.align === 'center' ? 'center' : style.align === 'right' ? 'flex-end' : 'flex-start', padding: '4px 8px' }}>
            {dateStr}
          </div>
        );

      case 'formula':
      case 'page_number':
        return (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: style.align === 'center' ? 'center' : style.align === 'right' ? 'flex-end' : 'flex-start', padding: '4px 8px' }}>
            {object.text || object.name}
          </div>
        );
      
      case 'shape':
        return <div style={{ flex: 1 }} />; // Shape relies purely on border/background
      
      case 'image':
        return (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: object.props?.imageUrl ? 'transparent' : '#f1f5f9' }}>
            {object.props?.imageUrl ? (
              <img src={object.props.imageUrl} alt={object.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} draggable={false} />
            ) : (
              <Icon icon="solar:gallery-bold-duotone" width="32" height="32" style={{ color: '#94a3b8' }} />
            )}
          </div>
        );

      case 'kpi_value':
        const hasLiveValue = preview.primaryValue?.value != null;
        return (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: style.align === 'left' ? 'flex-start' : style.align === 'right' ? 'flex-end' : 'center', justifyContent: 'center', padding: '8px' }}>
            <span style={{ fontSize: '0.45em', opacity: 0.7, fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>{boundTag ? boundTag.name : object.name}</span>
            <span style={{ fontWeight: 800, lineHeight: 1, color: hasLiveValue ? 'inherit' : '#94a3b8' }}>{hasLiveValue ? preview.primaryValue!.value : (boundTag ? '—' : object.text || '—')}</span>
            {boundTag?.unit && <span style={{ fontSize: '0.35em', opacity: 0.6, marginTop: 4 }}>{boundTag.unit}</span>}
            {!hasLiveValue && !boundTag && (
              <span style={{ fontSize: 9, color: '#94a3b8', marginTop: 2 }}>ผูก Tag เพื่อแสดงค่า</span>
            )}
          </div>
        );

      case 'signature':
        return (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', padding: '16px' }}>
            <div style={{ width: '80%', borderBottom: `1px dashed ${style.color || '#000'}`, marginBottom: 8 }} />
            <span style={{ fontSize: Math.max(10, (style.fontSize || 14) * 0.8) }}>{object.text || 'Sign Here'}</span>
          </div>
        );

      case 'qrcode':
        return (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: transparentChrome ? 'transparent' : (style.background ?? '#fff'), padding: 8 }}>
            <svg viewBox="0 0 100 100" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" style={{ flex: 1, minHeight: 0 }}>
              <path d="M10,10 h30 v30 h-30 z M15,15 h20 v20 h-20 z" fill={style.color || '#0f172a'} />
              <path d="M60,10 h30 v30 h-30 z M65,15 h20 v20 h-20 z" fill={style.color || '#0f172a'} />
              <path d="M10,60 h30 v30 h-30 z M15,65 h20 v20 h-20 z" fill={style.color || '#0f172a'} />
              <path d="M45,45 h10 v10 h-10 z M60,60 h10 v10 h-10 z M75,75 h15 v15 h-15 z M45,75 h10 v15 h-10 z M75,45 h15 v10 h-15 z M60,85 h10 v5 h-10 z M80,60 h10 v5 h-10 z" fill={style.color || '#0f172a'} />
            </svg>
            {object.props?.qrData && <div style={{ fontSize: 10, marginTop: 4, color: style.color || '#0f172a', wordBreak: 'break-all', textAlign: 'center' }}>{object.props.qrData}</div>}
          </div>
        );

      case 'barcode':
        return (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', padding: 8 }}>
             <svg viewBox="0 0 100 40" width="100%" height="100%" preserveAspectRatio="none">
               <path d="M10,5 v30 M15,5 v30 M22,5 v30 M25,5 v30 M30,5 v30 M38,5 v30 M42,5 v30 M45,5 v30 M52,5 v30 M58,5 v30 M65,5 v30 M70,5 v30 M72,5 v30 M78,5 v30 M85,5 v30 M88,5 v30 M92,5 v30" stroke={style.color || '#0f172a'} strokeWidth="2" />
             </svg>
          </div>
        );

      case 'energy_summary':
      case 'cost_summary': {
        const isCost = object.type === 'cost_summary';
        const periodStr = object.props?.period || 'monthly';
        const scopedTags = listMeterBillingTags(tags, devices, object.props ?? {});
        const scopedSummaries = scopedTags
          .map((tag) => periodContext.tagSummaries.get(tag.id))
          .filter(Boolean);
        const scopedUsage = scopedSummaries.reduce((sum, summary) => sum + (summary?.usageValue ?? 0), 0);
        const scopedRate = periodContext.billing?.energyCostRate
          ?? (periodContext.billing?.totalKwh && periodContext.billing?.energyCost && periodContext.billing.totalKwh > 0
            ? periodContext.billing.energyCost / periodContext.billing.totalKwh
            : null);
        const scopedAmount = scopedRate != null ? scopedUsage * scopedRate : null;
        const scopeMode = object.props?.scopeMode ?? 'project';
        const scopedDevice = devices.find((device) => device.id === (object.props?.scopeDeviceId ?? object.props?.deviceId ?? object.deviceId));
        const scopeName = boundTag
          ? boundTag.name
          : scopeMode === 'project'
            ? 'ทั้งโปรเจกต์'
            : (scopedDevice?.name ?? 'ยังไม่เลือกขอบเขต');
        const bill = periodContext.billing;
        const tagSum = boundTag ? periodContext.tagSummaries.get(boundTag.id) : undefined;
        const totalVal = isCost
          ? (boundTag
            ? (tagSum?.amount != null ? formatReportFormulaResult(tagSum.amount) : '—')
            : (scopedAmount != null ? formatReportFormulaResult(scopedAmount) : '—'))
          : (tagSum?.usageValue != null
            ? formatReportFormulaResult(tagSum.usageValue)
            : (scopedSummaries.length ? formatReportFormulaResult(scopedUsage) : (bill?.totalKwh != null ? formatReportFormulaResult(bill.totalKwh) : '—')));
        const peakVal = isCost
          ? (boundTag
            ? (tagSum?.ratePerUnit != null ? formatReportFormulaResult(tagSum.ratePerUnit) : '—')
            : (scopedRate != null ? formatReportFormulaResult(scopedRate) : '—'))
          : (boundTag && tagSum?.lastValue != null ? formatReportFormulaResult(tagSum.lastValue) : `${scopedTags.length} มิเตอร์`);
        const offVal = isCost
          ? (boundTag ? '—' : (bill?.currency ?? 'THB'))
          : (boundTag && tagSum?.firstValue != null ? formatReportFormulaResult(tagSum.firstValue) : periodStr);
        const totalLabel = isCost ? 'Total Cost' : 'Total Energy';
        const peakLabel = isCost ? 'Rate' : (boundTag ? 'Last' : 'Meters');
        const offLabel = isCost ? 'Currency' : (boundTag ? 'First' : 'Period');
        const totalSuffix = isCost && bill?.currency ? ` ${bill.currency}` : (isCost ? '' : ' kWh');
        return (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 8, background: 'transparent', fontSize: 12, color: style.color || '#64748b' }}>
            <div style={{ fontWeight: 600, textTransform: 'uppercase', marginBottom: 6, opacity: 0.85 }}>
              {isCost ? 'Cost Summary' : 'Energy Summary'} ({periodStr})
            </div>
            <div style={{ fontWeight: 700, marginBottom: 6, color: style.color || '#0f172a' }}>{scopeName}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px dashed #cbd5e1' }}>
              <span>{totalLabel}</span>
              <span style={{ fontWeight: 600, color: '#0f172a' }}>{totalVal}{totalSuffix}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px dashed #cbd5e1' }}>
              <span>{peakLabel}</span>
              <span style={{ fontWeight: 600, color: '#0f172a' }}>{peakVal}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
              <span>{offLabel}</span>
              <span style={{ fontWeight: 600, color: '#0f172a' }}>{offVal}</span>
            </div>
          </div>
        );
      }

      case 'graph':
        return (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 12 }}>
             <div style={{ fontWeight: 600, fontSize: Math.max(10, (style.fontSize || 14) * 0.9), marginBottom: 8 }}>{boundTag ? `${boundTag.name} Trend` : 'ตัวอย่าง Trend Graph'}</div>
             <div style={{ flex: 1, position: 'relative', borderLeft: `1px solid ${style.color || '#94a3b8'}`, borderBottom: `1px solid ${style.color || '#94a3b8'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
               <svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 100 100">
                 <polyline points="0,80 20,60 40,70 60,30 80,40 100,10" fill="none" stroke={style.color || '#0ea5e9'} strokeWidth="2" />
                 <polygon points="0,100 0,80 20,60 40,70 60,30 80,40 100,10 100,100" fill={style.color || '#0ea5e9'} opacity="0.15" />
               </svg>
               <div style={{ position: 'absolute', bottom: 8, right: 8, fontSize: 9, color: '#94a3b8', background: '#f8fafc', padding: '2px 6px', borderRadius: 4 }}>
                 ผูก Tag เพื่อดูข้อมูลจริง
               </div>
             </div>
          </div>
        );


      default:
        return (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <strong>{object.text || object.name}</strong>
          </div>
        );
    }
  };

  return (
    <div
      className={selected ? `report-object ${object.type} selected` : `report-object ${object.type}`}
      style={commonStyles}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onPointerDown={onPointerDown}
    >
      {renderWidgetContent()}
      
      {/* Selection outline and resize handles via standard editor classes */}
      {selected && !object.locked && (
        <div className="ec-select-box" style={{ left: 0, top: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
          {HANDLES.map((h) => (
            <span
              key={h}
              className={`ec-handle ec-handle-${h}`}
              style={{ pointerEvents: 'auto' }}
              onPointerDown={(ev) => {
                ev.stopPropagation();
                ev.preventDefault();
                onResizeStart(h, ev);
              }}
            />
          ))}
        </div>
      )}
      
      {boundTag && isDataBound && !isGraphicWidget && (
        <div style={{ position: 'absolute', top: 4, right: 4, fontSize: '9px', color: '#1d4ed8', background: '#dbeafe', borderRadius: '4px', padding: '2px 4px', pointerEvents: 'none', maxWidth: 'calc(100% - 8px)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          Tag: {boundTag.name}
        </div>
      )}
      
      {object.locked && (
        <div style={{ position: 'absolute', top: 4, right: 4, color: '#ef4444' }}>
          <Icon icon="solar:lock-bold-duotone" width="14" height="14" />
        </div>
      )}
    </div>
  );
}

function ReportSchedulerPanel({ reports }: { reports: ReportSummary[] }) {
  const { showConfirm } = useModal();
  const [schedules, setSchedules] = React.useState<ReportSchedule[]>([]);
  const [runs, setRuns] = React.useState<ReportScheduleRun[]>([]);
  const [message, setMessage] = React.useState('');
  const [selectedReportId, setSelectedReportId] = React.useState('');
  const [frequency, setFrequency] = React.useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [timeOfDay, setTimeOfDay] = React.useState('06:00');

  async function refresh() {
    try {
      const [scheduleRows, runRows] = await Promise.all([reportSchedulerApi.listSchedules(), reportSchedulerApi.listRuns()]);
      setSchedules(scheduleRows);
      setRuns(runRows);
      setSelectedReportId((prev) => prev || reports[0]?.id || scheduleRows[0]?.reportId || '');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  React.useEffect(() => { void refresh(); }, [reports.length]);

  async function createSchedule() {
    const reportId = selectedReportId || reports[0]?.id;
    if (!reportId) { setMessage('Create a report before adding a schedule.'); return; }
    const report = reports.find((item) => item.id === reportId);
    try {
      await reportSchedulerApi.createSchedule({
        reportId,
        name: `${report?.name ?? 'Report'} ${frequency} schedule`,
        status: 'enabled',
        frequency,
        timeOfDay,
        formats: ['pdf'],
        dateRange: 'report_default'
      });
      setMessage('Schedule created.');
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function runNow(id: string) {
    try {
      await reportSchedulerApi.runNow(id);
      setMessage('Schedule executed. Output uses stored HistoryValue and Alarm records only.');
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function toggle(schedule: ReportSchedule) {
    await reportSchedulerApi.updateSchedule(schedule.id, { status: schedule.status === 'enabled' ? 'disabled' : 'enabled' });
    await refresh();
  }

  async function remove(id: string) {
    if (!await showConfirm('Delete this report schedule?')) return;
    await reportSchedulerApi.deleteSchedule(id);
    await refresh();
  }

  return (
    <section className="scheduler-panel">
      <div className="scheduler-head">
        <div>
          <strong>Report Scheduler</strong>
          <span>Auto-generate PDF/Excel from stored HistoryValue and Alarm data.</span>
        </div>
        <button className="btn secondary" onClick={() => void refresh()}>
          <Icon icon="solar:refresh-bold-duotone" width="16" height="16" style={{ marginRight: 6, color: '#3b82f6', verticalAlign: 'middle' }} />
          Refresh
        </button>
      </div>
      {message && <div className="notice">{message}</div>}
      <div className="scheduler-create-row" style={{ display: 'flex', gap: 16, alignItems: 'flex-end', background: '#f4f8fb', padding: '16px', borderRadius: '8px', border: '1px solid #c9dbe2', marginBottom: '16px' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#5b6b7b' }}>Report Target</span>
          <select value={selectedReportId} onChange={(event) => setSelectedReportId(event.target.value)} style={{ padding: '8px', border: '1px solid #c9dbe2', borderRadius: 6, background: '#fff' }}>
            <option value="">Select report</option>
            {reports.map((report) => <option key={report.id} value={report.id}>{report.name}</option>)}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, width: 150 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#5b6b7b' }}>Frequency</span>
          <select value={frequency} onChange={(event) => setFrequency(event.target.value as 'daily' | 'weekly' | 'monthly')} style={{ padding: '8px', border: '1px solid #c9dbe2', borderRadius: 6, background: '#fff' }}>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, width: 120 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#5b6b7b' }}>Time</span>
          <input type="time" value={timeOfDay} onChange={(event) => setTimeOfDay(event.target.value)} style={{ padding: '7px 8px', border: '1px solid #c9dbe2', borderRadius: 6, background: '#fff' }} />
        </label>
        <button className="btn primary" onClick={() => void createSchedule()} style={{ height: 38, padding: '0 16px' }}>
          <Icon icon="solar:calendar-add-bold-duotone" width="16" height="16" style={{ marginRight: 6, color: '#fff', verticalAlign: 'middle' }} />
          Create Schedule
        </button>
      </div>
      <table className="data-table compact">
        <thead><tr><th>Name</th><th>Report</th><th>Status</th><th>Frequency</th><th>Next Run</th><th>Actions</th></tr></thead>
        <tbody>
          {schedules.length === 0 ? <tr><td colSpan={6}>No report schedules.</td></tr> : schedules.map((schedule) => (
            <tr key={schedule.id}>
              <td>{schedule.name}</td>
              <td>{reports.find((report) => report.id === schedule.reportId)?.name ?? schedule.reportId}</td>
              <td><span className={`status-badge ${schedule.status}`}>{schedule.status === 'enabled' ? '* Active' : 'o Disabled'}</span></td>
              <td>{schedule.frequency} {schedule.timeOfDay}</td>
              <td>{schedule.nextRunAt ?? '-'}</td>
              <td>
                <button className="link-button run-btn" onClick={() => void runNow(schedule.id)} style={{ display: 'inline-flex', alignItems: 'center' }}>
                  <Icon icon="solar:play-bold-duotone" width="13" height="13" style={{ marginRight: 3, verticalAlign: 'middle' }} />
                  Run
                </button>
                <button className="link-button toggle-btn" onClick={() => void toggle(schedule)} style={{ display: 'inline-flex', alignItems: 'center' }}>
                  <Icon icon="solar:power-bold-duotone" width="13" height="13" style={{ marginRight: 3, verticalAlign: 'middle' }} />
                  {schedule.status === 'enabled' ? 'Disable' : 'Enable'}
                </button>
                <button className="link-button danger-text" onClick={() => void remove(schedule.id)} style={{ display: 'inline-flex', alignItems: 'center' }}>
                  <Icon icon="solar:trash-bin-trash-bold-duotone" width="13" height="13" style={{ marginRight: 3, verticalAlign: 'middle' }} />
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="run-history">
        <strong>Recent Runs</strong>
        <ul>
          {runs.slice(0, 5).map((run) => {
            const engineUrl = getEngineUrl();
            const cleanUrl = engineUrl.replace(/\/$/, '');
            return (
              <li key={run.id}>
                {run.status === 'success' ? (
                  <span style={{ color: '#10b981', fontWeight: 'bold' }}>OK</span>
                ) : run.status === 'failed' ? (
                  <span style={{ color: '#ef4444', fontWeight: 'bold' }}>X</span>
                ) : (
                  <span style={{ color: '#3b82f6', fontWeight: 'bold' }}>*</span>
                )}
                {' '}
                {run.startedAt} -{' '}
                {run.error ? (
                  <div style={{ display: 'inline-block', color: '#ef4444', background: '#fee2e2', padding: '2px 8px', borderRadius: 4, fontSize: 12, maxWidth: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', verticalAlign: 'middle' }} title={run.error}>
                    <Icon icon="solar:danger-triangle-bold-duotone" width="14" height="14" style={{ marginRight: 4, verticalAlign: 'middle' }} />
                    {run.error.includes('prisma') ? 'Database query failed (Check tag bindings)' : run.error}
                  </div>
                ) : run.generatedFileName ? (
                  <a
                    href={`${cleanUrl}/api/reports/files/${encodeURIComponent(run.generatedFileName)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#087c8b', textDecoration: 'underline', fontWeight: 600 }}
                  >
                    {run.generatedFileName}
                  </a>
                ) : (
                  'No output'
                )}
              </li>
            );
          })}
          {runs.length === 0 && <li>No schedule runs.</li>}
        </ul>
      </div>
    </section>
  );
}
