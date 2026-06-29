import fs from 'node:fs';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import { getReportsDir } from '@energylink/shared-data';
import { getPrismaClient } from './database.js';
import { appendEngineLog } from './engineLogger.js';
import { buildBillingSummary, type BillingSummaryPayload } from './energyBillingService.js';
import {
  enrichTagSummariesWithBilling,
  formatReportFormulaResult,
  resolveReportDateRange,
  tagSummaryFromHistoryRows,
} from '@energylink/shared-types';

type SpreadsheetFormat = 'pdf' | 'excel';

type DateRange = {
  from: Date;
  to: Date;
  label: string;
};

type SpreadsheetCellStyle = {
  bold?: boolean;
  italic?: boolean;
  align?: 'left' | 'center' | 'right';
  background?: string;
  color?: string;
};

type SpreadsheetCellSnapshot = {
  address: string;
  row: number;
  col: number;
  display: string;
  raw?: string | number | boolean | null;
  style?: SpreadsheetCellStyle;
};

type SpreadsheetSheetSnapshot = {
  id: string;
  name: string;
  rowCount: number;
  colCount: number;
  usedRange: string;
  columns: Array<{ index: number; width: number }>;
  merges: string[];
  cells: SpreadsheetCellSnapshot[];
};

type SpreadsheetSnapshot = {
  sheets: SpreadsheetSheetSnapshot[];
};

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

type SpreadsheetTemplateRoot = {
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
    snapshot?: SpreadsheetSnapshot;
    bindings?: SpreadsheetBinding[];
    export?: Record<string, unknown>;
  };
};

type SpreadsheetPreviewResult = {
  mode: 'spreadsheet';
  range: {
    from: string;
    to: string;
    label: string;
  };
  source: {
    historyCount: number;
    alarmCount: number;
  };
  sheets: SpreadsheetSheetSnapshot[];
  warnings: string[];
};

type BuildTemplateInput = {
  reportId: string;
  existingTemplate?: unknown;
  filename: string;
  buffer: Buffer;
  kind: 'xlsx' | 'csv';
};

type PreviewOptions = {
  from?: string;
  to?: string;
  tariffId?: string;
};

type GenerateSpreadsheetOptions = {
  format?: string;
  from?: string;
  to?: string;
  tariffId?: string;
  requestedBy?: string;
};

type TagSummary = ReturnType<typeof tagSummaryFromHistoryRows> & {
  deviceName: string;
  minValue: number | null;
  maxValue: number | null;
};

type SpreadsheetRuntimeData = {
  projectName: string;
  range: DateRange;
  billing: BillingSummaryPayload | null;
  tagSummaries: TagSummary[];
  historyCount: number;
  alarmCount: number;
};

type ResolvedBindingValue = {
  raw: string | number | boolean | null;
  display: string;
};

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 80) || 'report';
}

function asSupportedFormat(format?: string): SpreadsheetFormat {
  const normalized = String(format ?? 'pdf').toLowerCase();
  if (normalized === 'xlsx' || normalized === 'excel') return 'excel';
  return 'pdf';
}

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

function blankSnapshot(rows = 20, cols = 10): SpreadsheetSnapshot {
  return {
    sheets: [{
      id: 'sheet_1',
      name: 'Sheet1',
      rowCount: rows,
      colCount: cols,
      usedRange: `A1:${columnLetters(cols)}${rows}`,
      columns: Array.from({ length: cols }, (_, index) => ({ index: index + 1, width: 14 })),
      merges: [],
      cells: [],
    }],
  };
}

function parseTemplate(input: unknown): SpreadsheetTemplateRoot {
  if (!input) return {};
  if (typeof input === 'string') {
    try {
      const parsed = JSON.parse(input);
      return parsed && typeof parsed === 'object' ? parsed as SpreadsheetTemplateRoot : {};
    } catch {
      return {};
    }
  }
  return typeof input === 'object' ? input as SpreadsheetTemplateRoot : {};
}

function spreadsheetRoot(template: SpreadsheetTemplateRoot | null | undefined) {
  return template?.spreadsheet ?? {};
}

function spreadsheetSnapshot(template: SpreadsheetTemplateRoot | null | undefined): SpreadsheetSnapshot {
  return spreadsheetRoot(template).snapshot?.sheets?.length
    ? (spreadsheetRoot(template).snapshot as SpreadsheetSnapshot)
    : blankSnapshot();
}

function spreadsheetBindings(template: SpreadsheetTemplateRoot | null | undefined): SpreadsheetBinding[] {
  return Array.isArray(spreadsheetRoot(template).bindings)
    ? spreadsheetRoot(template).bindings as SpreadsheetBinding[]
    : [];
}

function reportTemplateDir(reportId: string) {
  const dir = path.join(getReportsDir(), 'templates', sanitizeFileName(reportId));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function sourceWorkbookPath(reportId: string) {
  return path.join(reportTemplateDir(reportId), 'source.xlsx');
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

function parseCellAddress(address: string) {
  const match = /^([A-Z]+)(\d+)$/i.exec(String(address).trim());
  if (!match) return null;
  const [, letters, rowText] = match;
  let col = 0;
  for (const ch of letters.toUpperCase()) {
    col = (col * 26) + (ch.charCodeAt(0) - 64);
  }
  return { row: Number(rowText), col };
}

function cellAddress(row: number, col: number) {
  return `${columnLetters(col)}${row}`;
}

function argbToCss(argb?: string | null) {
  if (!argb || argb.length < 6) return undefined;
  const hex = argb.length === 8 ? argb.slice(2) : argb.slice(-6);
  return `#${hex}`.toLowerCase();
}

function coerceCellDisplay(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (typeof obj.text === 'string') return obj.text;
    if (typeof obj.result === 'number' || typeof obj.result === 'string') return String(obj.result);
    if (typeof obj.formula === 'string') return `=${obj.formula}`;
    if (Array.isArray(obj.richText)) {
      return obj.richText
        .map((part) => (part && typeof part === 'object' && typeof (part as Record<string, unknown>).text === 'string')
          ? String((part as Record<string, unknown>).text)
          : '')
        .join('');
    }
    if (typeof obj.hyperlink === 'string' && typeof obj.text === 'string') return obj.text;
  }
  return String(value);
}

function primitiveCellValue(value: unknown): string | number | boolean | null {
  if (value == null) return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (value instanceof Date) return value.toISOString();
  return coerceCellDisplay(value);
}

function extractCellStyle(cell: ExcelJS.Cell): SpreadsheetCellStyle | undefined {
  const style: SpreadsheetCellStyle = {};
  if (cell.font?.bold) style.bold = true;
  if (cell.font?.italic) style.italic = true;
  if (cell.alignment?.horizontal && ['left', 'center', 'right'].includes(cell.alignment.horizontal)) {
    style.align = cell.alignment.horizontal as SpreadsheetCellStyle['align'];
  }
  const bg = argbToCss((cell.fill as ExcelJS.FillPattern | undefined)?.fgColor?.argb ?? null);
  if (bg) style.background = bg;
  const color = argbToCss(cell.font?.color?.argb ?? null);
  if (color) style.color = color;
  return Object.keys(style).length ? style : undefined;
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index] ?? '';
    const next = text[index + 1] ?? '';

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && char === ',') {
      row.push(cell);
      cell = '';
      continue;
    }

    if (!inQuotes && (char === '\n' || char === '\r')) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      continue;
    }

    cell += char;
  }

  row.push(cell);
  rows.push(row);
  return rows.filter((entry, index, all) => index < all.length - 1 || entry.length > 1 || entry[0] !== '');
}

async function workbookFromImport(kind: 'xlsx' | 'csv', buffer: Buffer) {
  const workbook = new ExcelJS.Workbook();
  if (kind === 'csv') {
    const rows = parseCsv(buffer.toString('utf8'));
    const sheet = workbook.addWorksheet('Sheet1');
    rows.forEach((row) => sheet.addRow(row));
    return workbook;
  }
  await workbook.xlsx.load(buffer as any);
  if (!workbook.worksheets.length) workbook.addWorksheet('Sheet1');
  return workbook;
}

function buildSnapshotFromWorkbook(workbook: ExcelJS.Workbook): SpreadsheetSnapshot {
  const sheets = workbook.worksheets.map((worksheet, sheetIndex) => {
    let maxRow = 0;
    let maxCol = 0;
    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      maxRow = Math.max(maxRow, rowNumber);
      row.eachCell({ includeEmpty: false }, (_cell, colNumber) => {
        maxCol = Math.max(maxCol, colNumber);
      });
    });

    maxRow = Math.max(maxRow, worksheet.rowCount, 20);
    maxCol = Math.max(maxCol, worksheet.columnCount, 10);

    const cells: SpreadsheetCellSnapshot[] = [];
    for (let row = 1; row <= maxRow; row += 1) {
      for (let col = 1; col <= maxCol; col += 1) {
        const cell = worksheet.getRow(row).getCell(col);
        if (cell.value == null || cell.value === '') continue;
        cells.push({
          address: cellAddress(row, col),
          row,
          col,
          display: coerceCellDisplay(cell.value),
          raw: primitiveCellValue(cell.value),
          style: extractCellStyle(cell),
        });
      }
    }

    const columns = Array.from({ length: maxCol }, (_, index) => ({
      index: index + 1,
      width: typeof worksheet.getColumn(index + 1).width === 'number' ? Number(worksheet.getColumn(index + 1).width) : 14,
    }));

    const merges = Array.isArray((worksheet.model as { merges?: string[] } | undefined)?.merges)
      ? [ ...((worksheet.model as { merges?: string[] }).merges ?? []) ]
      : [];

    return {
      id: `sheet_${sheetIndex + 1}`,
      name: worksheet.name || `Sheet${sheetIndex + 1}`,
      rowCount: maxRow,
      colCount: maxCol,
      usedRange: `A1:${columnLetters(maxCol)}${maxRow}`,
      columns,
      merges,
      cells,
    } satisfies SpreadsheetSheetSnapshot;
  });

  return { sheets: sheets.length ? sheets : blankSnapshot().sheets };
}

function createWorkbookFromSnapshot(snapshot: SpreadsheetSnapshot) {
  const workbook = new ExcelJS.Workbook();
  for (const sheet of snapshot.sheets) {
    const worksheet = workbook.addWorksheet(sheet.name || `Sheet${workbook.worksheets.length + 1}`);
    for (const column of sheet.columns ?? []) {
      worksheet.getColumn(column.index).width = column.width;
    }
    for (const merge of sheet.merges ?? []) {
      try {
        worksheet.mergeCells(merge);
      } catch {
        // Ignore malformed merges from imported snapshots.
      }
    }
    for (const cell of sheet.cells ?? []) {
      const target = worksheet.getCell(cell.address);
      target.value = cell.raw ?? cell.display;
      if (cell.style?.bold || cell.style?.italic || cell.style?.color) {
        target.font = {
          bold: cell.style.bold,
          italic: cell.style.italic,
          color: cell.style.color ? { argb: `FF${cell.style.color.replace('#', '').toUpperCase()}` } : undefined,
        };
      }
      if (cell.style?.align) {
        target.alignment = { horizontal: cell.style.align };
      }
      if (cell.style?.background) {
        target.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: `FF${cell.style.background.replace('#', '').toUpperCase()}` },
        };
      }
    }
  }
  if (!workbook.worksheets.length) workbook.addWorksheet('Sheet1');
  return workbook;
}

function resolveSourceWorkbookFile(reportId: string, template: SpreadsheetTemplateRoot) {
  const relativePath = template.spreadsheet?.source?.relativePath;
  if (!relativePath) return null;
  const normalizedSegments = relativePath.split(/[\\/]+/).filter(Boolean);
  const absolute = path.resolve(getReportsDir(), ...normalizedSegments);
  const root = path.resolve(getReportsDir());
  if (!absolute.startsWith(root)) return null;
  if (!fs.existsSync(absolute)) return null;
  return absolute;
}

async function loadWorkbookForTemplate(reportId: string, template: SpreadsheetTemplateRoot) {
  const filePath = resolveSourceWorkbookFile(reportId, template);
  if (filePath) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    if (!workbook.worksheets.length) workbook.addWorksheet('Sheet1');
    return workbook;
  }
  return createWorkbookFromSnapshot(spreadsheetSnapshot(template));
}

function summarizeHistoryRows(
  historyValues: Array<{
    tagId: string;
    value: number | null;
    readAt: Date;
    tag?: { name?: string; unit?: string | null } | null;
    device?: { name?: string } | null;
  }>,
  billing: BillingSummaryPayload | null,
) {
  const grouped = new Map<string, typeof historyValues>();
  for (const row of historyValues) {
    if (!grouped.has(row.tagId)) grouped.set(row.tagId, []);
    grouped.get(row.tagId)!.push(row);
  }

  return enrichTagSummariesWithBilling(
    Array.from(grouped.values()).map((rows) => {
      const base = tagSummaryFromHistoryRows(rows[0].tagId, rows.map((row) => ({
        value: row.value,
        readAt: row.readAt,
      })), {
        tagName: rows[0]?.tag?.name ?? rows[0].tagId,
        unit: rows[0]?.tag?.unit ?? null,
      });
      const numericRows = rows.filter((row) => typeof row.value === 'number' && Number.isFinite(row.value));
      const values = numericRows.map((row) => row.value as number);
      return {
        ...base,
        deviceName: rows[0]?.device?.name ?? '',
        minValue: values.length ? Math.min(...values) : null,
        maxValue: values.length ? Math.max(...values) : null,
      };
    }),
    billing,
  ) as TagSummary[];
}

async function buildRuntimeData(report: any, range: DateRange, tariffId?: string): Promise<SpreadsheetRuntimeData> {
  const prisma = getPrismaClient();
  const [project, historyValues, alarmCount, billing] = await Promise.all([
    prisma.project.findUnique({ where: { id: report.projectId }, select: { name: true } }),
    prisma.historyValue.findMany({
      where: {
        projectId: report.projectId,
        readAt: { gte: range.from, lte: range.to },
      },
      include: { tag: true, device: true },
      orderBy: { readAt: 'asc' },
    }),
    prisma.alarm.count({
      where: {
        projectId: report.projectId,
        startedAt: { gte: range.from, lte: range.to },
      },
    }),
    buildBillingSummary(report.projectId, {
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      tariffId,
    }).catch(() => null),
  ]);

  return {
    projectName: project?.name ?? report.projectId,
    range,
    billing,
    tagSummaries: summarizeHistoryRows(historyValues, billing),
    historyCount: historyValues.length,
    alarmCount,
  };
}

function parseDateRange(report: any, from?: string, to?: string): DateRange {
  const resolved = resolveReportDateRange({
    reportDefaultRange: report.defaultDateRange,
    reportType: report.reportType,
    customFrom: from,
    customTo: to,
  });
  return { from: resolved.from, to: resolved.to, label: resolved.label };
}

function clampDecimalPlaces(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(6, Math.trunc(parsed))) : 2;
}

function formatMetricValue(value: number | null, binding: SpreadsheetBinding) {
  if (value == null || !Number.isFinite(value)) {
    return {
      raw: binding.fallbackText ?? '',
      display: binding.fallbackText ?? '',
    } satisfies ResolvedBindingValue;
  }

  const decimalPlaces = clampDecimalPlaces(binding.format?.decimalPlaces);
  const prefix = String(binding.format?.prefix ?? '');
  const suffix = String(binding.format?.suffix ?? '');
  const formatted = `${prefix}${formatReportFormulaResult(value, decimalPlaces)}${suffix}`;
  const raw = prefix || suffix || binding.format?.asText ? formatted : Number(value.toFixed(decimalPlaces));
  return {
    raw,
    display: formatted,
  } satisfies ResolvedBindingValue;
}

function renderTextTemplate(input: string, report: any, data: SpreadsheetRuntimeData) {
  const replacements: Record<string, string> = {
    '{{report.name}}': String(report.name ?? ''),
    '{{report.type}}': String(report.reportType ?? ''),
    '{{project.name}}': String(data.projectName ?? ''),
    '{{period.label}}': data.range.label,
    '{{period.from}}': data.range.from.toISOString(),
    '{{period.to}}': data.range.to.toISOString(),
    '{{billing.totalKwh}}': data.billing?.totalKwh != null ? formatReportFormulaResult(data.billing.totalKwh, 2) : '',
    '{{billing.energyCost}}': data.billing?.energyCost != null ? formatReportFormulaResult(data.billing.energyCost, 2) : '',
    '{{billing.demandCost}}': data.billing?.demandCost != null ? formatReportFormulaResult(data.billing.demandCost, 2) : '',
    '{{billing.grandTotal}}': data.billing?.grandTotal != null ? formatReportFormulaResult(data.billing.grandTotal, 2) : '',
    '{{billing.currency}}': String(data.billing?.currency ?? ''),
  };
  let output = input;
  for (const [token, value] of Object.entries(replacements)) {
    output = output.replaceAll(token, value);
  }
  return output;
}

function resolveBindingValue(binding: SpreadsheetBinding, report: any, data: SpreadsheetRuntimeData): ResolvedBindingValue {
  if (binding.kind === 'report_meta') {
    const field = String(binding.config?.field ?? 'reportName');
    switch (field) {
      case 'projectName':
        return { raw: data.projectName, display: data.projectName };
      case 'generatedAt': {
        const value = new Date().toISOString();
        return { raw: value, display: value };
      }
      case 'periodStart': {
        const value = data.range.from.toISOString();
        return { raw: value, display: value };
      }
      case 'periodEnd': {
        const value = data.range.to.toISOString();
        return { raw: value, display: value };
      }
      case 'periodLabel':
        return { raw: data.range.label, display: data.range.label };
      case 'reportType':
        return { raw: String(report.reportType ?? ''), display: String(report.reportType ?? '') };
      default:
        return { raw: String(report.name ?? ''), display: String(report.name ?? '') };
    }
  }

  if (binding.kind === 'billing_metric') {
    const metric = String(binding.config?.metric ?? 'grandTotal');
    const value = metric === 'totalKwh'
      ? data.billing?.totalKwh ?? null
      : metric === 'energyCost'
        ? data.billing?.energyCost ?? null
        : metric === 'demandCost'
          ? data.billing?.demandCost ?? null
          : metric === 'vat'
            ? data.billing?.vat ?? null
            : data.billing?.grandTotal ?? null;
    return formatMetricValue(value, binding);
  }

  if (binding.kind === 'text_template') {
    const text = renderTextTemplate(String(binding.config?.text ?? ''), report, data);
    return { raw: text, display: text };
  }

  const tagId = String(binding.config?.tagId ?? '');
  const metric = String(binding.config?.metric ?? 'last').toLowerCase();
  const tag = data.tagSummaries.find((item) => item.tagId === tagId);

  const value = metric === 'first'
    ? tag?.firstValue ?? null
    : metric === 'usage'
      ? tag?.usageValue ?? null
      : metric === 'avg' || metric === 'average'
        ? tag?.averageValue ?? null
        : metric === 'min'
          ? tag?.minValue ?? null
          : metric === 'max'
            ? tag?.maxValue ?? null
            : tag?.lastValue ?? null;

  return formatMetricValue(value, binding);
}

function cloneSnapshot(snapshot: SpreadsheetSnapshot): SpreadsheetSnapshot {
  return JSON.parse(JSON.stringify(snapshot)) as SpreadsheetSnapshot;
}

function ensureSheetCell(sheet: SpreadsheetSheetSnapshot, address: string) {
  const parsed = parseCellAddress(address);
  if (!parsed) return null;
  sheet.rowCount = Math.max(sheet.rowCount, parsed.row);
  sheet.colCount = Math.max(sheet.colCount, parsed.col);
  sheet.usedRange = `A1:${columnLetters(sheet.colCount)}${sheet.rowCount}`;
  let cell = sheet.cells.find((entry) => entry.address.toUpperCase() === address.toUpperCase());
  if (!cell) {
    cell = {
      address: address.toUpperCase(),
      row: parsed.row,
      col: parsed.col,
      display: '',
      raw: '',
    };
    sheet.cells.push(cell);
  }
  return cell;
}

function applyBindingsToSnapshot(snapshot: SpreadsheetSnapshot, bindings: SpreadsheetBinding[], report: any, data: SpreadsheetRuntimeData) {
  const cloned = cloneSnapshot(snapshot);
  const warnings: string[] = [];

  for (const binding of bindings) {
    const sheet = cloned.sheets.find((entry) => entry.name === binding.sheetName);
    if (!sheet) {
      warnings.push(`Sheet not found for binding ${binding.id}: ${binding.sheetName}`);
      continue;
    }
    const target = ensureSheetCell(sheet, String(binding.cell ?? '').toUpperCase());
    if (!target) {
      warnings.push(`Invalid cell address for binding ${binding.id}: ${binding.cell}`);
      continue;
    }
    const resolved = resolveBindingValue(binding, report, data);
    target.display = resolved.display;
    target.raw = resolved.raw;
  }

  cloned.sheets.forEach((sheet) => {
    sheet.cells.sort((a, b) => a.row - b.row || a.col - b.col);
  });

  return { snapshot: cloned, warnings };
}

function applyBindingsToWorkbook(workbook: ExcelJS.Workbook, bindings: SpreadsheetBinding[], report: any, data: SpreadsheetRuntimeData) {
  const warnings: string[] = [];
  for (const binding of bindings) {
    const worksheet = workbook.getWorksheet(binding.sheetName);
    if (!worksheet) {
      warnings.push(`Sheet not found for binding ${binding.id}: ${binding.sheetName}`);
      continue;
    }
    const parsed = parseCellAddress(String(binding.cell ?? '').toUpperCase());
    if (!parsed) {
      warnings.push(`Invalid cell address for binding ${binding.id}: ${binding.cell}`);
      continue;
    }
    const target = worksheet.getCell(parsed.row, parsed.col);
    const resolved = resolveBindingValue(binding, report, data);
    target.value = resolved.raw;
  }
  return warnings;
}

function writeWorkbookPdf(filePath: string, report: any, workbook: ExcelJS.Workbook) {
  return new Promise<void>((resolve, reject) => {
    const isLandscape = report.orientation !== 'portrait';
    const doc = new PDFDocument({
      size: 'A4',
      layout: isLandscape ? 'landscape' : 'portrait',
      margin: 24,
    });

    const stream = fs.createWriteStream(filePath);
    stream.on('finish', () => resolve());
    stream.on('error', reject);
    doc.on('error', reject);
    doc.pipe(stream);

    const pageWidth = isLandscape ? 841.89 : 595.28;
    const pageHeight = isLandscape ? 595.28 : 841.89;
    const margin = 24;
    const availableWidth = pageWidth - (margin * 2);
    const availableHeight = pageHeight - (margin * 2);

    workbook.worksheets.forEach((worksheet, sheetIndex) => {
      if (sheetIndex > 0) {
        doc.addPage({ size: 'A4', layout: isLandscape ? 'landscape' : 'portrait', margin });
      }

      let maxRow = 0;
      let maxCol = 0;
      worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        maxRow = Math.max(maxRow, rowNumber);
        row.eachCell({ includeEmpty: false }, (_cell, colNumber) => {
          maxCol = Math.max(maxCol, colNumber);
        });
      });
      maxRow = Math.max(maxRow, worksheet.rowCount, 1);
      maxCol = Math.max(maxCol, worksheet.columnCount, 1);

      doc.fontSize(15).fillColor('#0f172a').text(`${report.name} - ${worksheet.name}`, margin, margin);
      let y = margin + 24;

      const columnWidths = Array.from({ length: maxCol }, (_, index) => {
        const width = typeof worksheet.getColumn(index + 1).width === 'number' ? Number(worksheet.getColumn(index + 1).width) : 12;
        return Math.max(8, Math.min(24, width));
      });
      const widthUnits = columnWidths.reduce((sum, width) => sum + width, 0) || maxCol;
      const actualWidths = columnWidths.map((width) => (width / widthUnits) * availableWidth);
      const rowHeight = 20;

      for (let row = 1; row <= maxRow; row += 1) {
        if (y + rowHeight > margin + availableHeight) {
          doc.addPage({ size: 'A4', layout: isLandscape ? 'landscape' : 'portrait', margin });
          y = margin;
        }

        let x = margin;
        for (let col = 1; col <= maxCol; col += 1) {
          const cell = worksheet.getCell(row, col);
          const display = coerceCellDisplay(cell.value);
          const width = actualWidths[col - 1] ?? (availableWidth / maxCol);
          doc.rect(x, y, width, rowHeight).lineWidth(0.3).stroke('#cbd5e1');
          if (display) {
            doc.fontSize(8).fillColor('#0f172a').text(display, x + 3, y + 5, {
              width: width - 6,
              height: rowHeight - 6,
              ellipsis: true,
            });
          }
          x += width;
        }
        y += rowHeight;
      }
    });

    doc.end();
  });
}

export async function buildSpreadsheetTemplateFromUpload(input: BuildTemplateInput) {
  const workbook = await workbookFromImport(input.kind, input.buffer);
  const workbookPath = sourceWorkbookPath(input.reportId);
  await workbook.xlsx.writeFile(workbookPath);

  const existing = parseTemplate(input.existingTemplate);
  const snapshot = buildSnapshotFromWorkbook(workbook);
  const relativePath = ['templates', sanitizeFileName(input.reportId), 'source.xlsx'].join('/');

  return {
    ...existing,
    version: Math.max(Number(existing.version ?? 1), 2),
    mode: 'spreadsheet',
    pages: Array.isArray(existing.pages) && existing.pages.length ? existing.pages : defaultPages(),
    spreadsheet: {
      ...existing.spreadsheet,
      source: {
        kind: 'xlsx',
        relativePath,
        originalFileName: input.filename,
        uploadedAt: new Date().toISOString(),
      },
      snapshot,
      bindings: spreadsheetBindings(existing),
      export: existing.spreadsheet?.export ?? {
        pdf: { sheetMode: 'all', fitToPage: true, showGridLines: false },
        excel: { preserveFormulas: true },
      },
    },
  } satisfies SpreadsheetTemplateRoot;
}

export async function resolveSpreadsheetPreview(report: any, options: PreviewOptions = {}): Promise<SpreadsheetPreviewResult> {
  const template = parseTemplate(report.templateJson);
  const range = parseDateRange(report, options.from, options.to);
  const data = await buildRuntimeData(report, range, options.tariffId);
  const snapshot = spreadsheetSnapshot(template);
  const bindings = spreadsheetBindings(template);
  const resolved = applyBindingsToSnapshot(snapshot, bindings, report, data);

  return {
    mode: 'spreadsheet',
    range: {
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      label: range.label,
    },
    source: {
      historyCount: data.historyCount,
      alarmCount: data.alarmCount,
    },
    sheets: resolved.snapshot.sheets,
    warnings: resolved.warnings,
  };
}

export async function generateSpreadsheetReport(report: any, options: GenerateSpreadsheetOptions) {
  const template = parseTemplate(report.templateJson);
  const format = asSupportedFormat(options.format ?? report.outputFormat);
  const range = parseDateRange(report, options.from, options.to);
  const data = await buildRuntimeData(report, range, options.tariffId);
  const workbook = await loadWorkbookForTemplate(report.id, template);
  const warnings = applyBindingsToWorkbook(workbook, spreadsheetBindings(template), report, data);

  const reportsDir = getReportsDir();
  fs.mkdirSync(reportsDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const extension = format === 'excel' ? 'xlsx' : 'pdf';
  const fileName = `${sanitizeFileName(report.name)}_${timestamp}.${extension}`;
  const filePath = path.join(reportsDir, fileName);

  if (format === 'excel') {
    await workbook.xlsx.writeFile(filePath);
  } else {
    await writeWorkbookPdf(filePath, report, workbook);
  }

  appendEngineLog('info', 'Spreadsheet report generated', {
    reportId: report.id,
    reportName: report.name,
    format,
    fileName,
    warningCount: warnings.length,
    requestedBy: options.requestedBy ?? 'unknown',
  });

  const stat = fs.statSync(filePath);
  return {
    reportId: report.id,
    reportName: report.name,
    format,
    fileName,
    filePath,
    downloadUrl: `/api/reports/files/${encodeURIComponent(fileName)}`,
    sizeBytes: stat.size,
    generatedAt: new Date().toISOString(),
    period: { from: range.from.toISOString(), to: range.to.toISOString(), label: range.label },
    warnings,
    source: {
      historyCount: data.historyCount,
      alarmCount: data.alarmCount,
      runtimeSource: 'not_present',
      generatedData: false,
    },
  };
}
