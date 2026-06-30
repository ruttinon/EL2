import fs from 'node:fs';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import ExcelJS from 'exceljs';
import { getReportsDir } from '@energylink/shared-data';
import { getPrismaClient } from './database.js';
import { appendEngineLog } from './engineLogger.js';
import { buildBillingSummary, type BillingSummaryPayload } from './energyBillingService.js';
import {
  billingToFormulaContext,
  buildMeterBillingRows,
  enrichTagSummariesWithBilling,
  evaluateReportFormulaExpression,
  formatMeterCell,
  formatReportFormulaResult,
  listMeterBillingTags,
  meterBillingColumnLabel,
  parseMeterBillingColumns,
  resolveReportScopeDeviceIds,
  resolveFieldMetricValue,
  resolveReportDateRange,
  tagSummaryFromHistoryRows,
  type ReportFieldMetric,
  type ReportTagPeriodSummary,
} from '@energylink/shared-types';
import { generateSpreadsheetReport } from './reportSpreadsheetService.js';

type ReportFormat = 'pdf' | 'excel';

type GenerateReportOptions = {
  reportId: string;
  format?: string;
  from?: string;
  to?: string;
  tariffId?: string;
  requestedBy?: string;
};

type DateRange = {
  from: Date;
  to: Date;
  label: string;
};

type TagSummary = ReportTagPeriodSummary & {
  tagName: string;
  deviceName: string;
  minValue: number | null;
  maxValue: number | null;
  firstAt: Date | null;
  lastAt: Date | null;
};

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 80) || 'report';
}

function asSupportedFormat(format?: string): ReportFormat {
  const normalized = String(format ?? 'pdf').toLowerCase();
  if (normalized === 'xlsx' || normalized === 'excel') return 'excel';
  return 'pdf';
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

function parseTemplate(templateJson: string | null | undefined) {
  if (!templateJson) return { version: 1, pages: [] };
  try {
    return JSON.parse(templateJson);
  } catch {
    return { version: 1, pages: [] };
  }
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function evaluateReportFormula(
  formula: string,
  tagIds: string[],
  tagSummaries: TagSummary[],
  billing: BillingSummaryPayload | null,
): string {
  const billingCtx = billing ? billingToFormulaContext(billing as BillingSummaryPayload & Record<string, unknown>) : null;
  const result = evaluateReportFormulaExpression(formula, tagIds, tagSummaries, billingCtx);
  if (result != null) return formatReportFormulaResult(result);
  if (!formula.trim()) return '';
  return formula.trim();
}

type ObjectPeriodSlice = {
  tagSummaries: TagSummary[];
  billing: BillingSummaryPayload | null;
};

type ObjectPeriodCache = Map<string, ObjectPeriodSlice>;

function objectPeriodCacheKey(from: Date, to: Date) {
  return `${from.getTime()}_${to.getTime()}`;
}

function collectExportObjectTagIds(obj: any): string[] {
  const ids = new Set<string>();
  if (obj.tagId) ids.add(obj.tagId);
  if (obj.sourceTagId) ids.add(obj.sourceTagId);
  if (Array.isArray(obj.tagIds)) {
    for (const id of obj.tagIds) if (id) ids.add(id);
  }
  return Array.from(ids);
}

function resolveObjectExportRange(obj: any, report: any, reportRange: DateRange): DateRange {
  const objectPeriod = obj.props?.period ?? obj.props?.reportPeriod;
  if (!objectPeriod) return reportRange;
  const resolved = resolveReportDateRange({
    reportDefaultRange: report.defaultDateRange,
    reportType: report.reportType,
    objectPeriod,
  });
  return { from: resolved.from, to: resolved.to, label: resolved.label };
}

function summarizeHistoryRows(
  historyValues: Array<{
    tagId: string;
    value: number | null;
    readAt: Date;
    deviceId: string;
    tag?: { name?: string; unit?: string | null } | null;
    device?: { name?: string } | null;
  }>,
  billing: BillingSummaryPayload | null,
): TagSummary[] {
  const grouped = new Map<string, typeof historyValues>();
  for (const row of historyValues) {
    if (!grouped.has(row.tagId)) grouped.set(row.tagId, []);
    grouped.get(row.tagId)!.push(row);
  }

  const tagSummaries: TagSummary[] = Array.from(grouped.values()).map((rows) => {
    const base = tagSummaryFromHistoryRows(rows[0].tagId, rows.map((row) => ({
      value: row.value,
      readAt: row.readAt,
    })), {
      tagName: rows[0]?.tag?.name ?? rows[0].tagId,
      unit: rows[0]?.tag?.unit ?? null,
    });
    const numericRows = rows.filter((row) => typeof row.value === 'number' && Number.isFinite(row.value));
    const values = numericRows.map((row) => row.value as number);
    const first = numericRows.at(0);
    const last = numericRows.at(-1);
    return {
      ...base,
      tagName: rows[0].tag?.name ?? rows[0].tagId,
      deviceName: rows[0].device?.name ?? rows[0].deviceId,
      minValue: values.length ? Math.min(...values) : null,
      maxValue: values.length ? Math.max(...values) : null,
      firstAt: first?.readAt ?? null,
      lastAt: last?.readAt ?? null,
    };
  });

  const billingCtx = billing ? billingToFormulaContext(billing as BillingSummaryPayload & Record<string, unknown>) : null;
  return enrichTagSummariesWithBilling(tagSummaries, billingCtx) as TagSummary[];
}

async function buildPeriodScopedData(
  report: any,
  range: DateRange,
  tariffId: string | undefined,
  tagIds: string[],
): Promise<ObjectPeriodSlice> {
  const prisma = getPrismaClient();
  const tagFilter = tagIds.length ? { tagId: { in: tagIds } } : {};

  const [historyValues, billing] = await Promise.all([
    prisma.historyValue.findMany({
      where: {
        projectId: report.projectId,
        readAt: { gte: range.from, lte: range.to },
        ...tagFilter,
      },
      include: { tag: true, device: true },
      orderBy: { readAt: 'asc' },
    }),
    buildBillingSummary(report.projectId, {
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      tariffId,
    }).catch(() => null),
  ]);

  return {
    tagSummaries: summarizeHistoryRows(historyValues, billing),
    billing,
  };
}

async function prefetchObjectPeriodCaches(
  report: any,
  data: Awaited<ReturnType<typeof buildReportData>>,
  tariffId?: string,
): Promise<ObjectPeriodCache> {
  const cache: ObjectPeriodCache = new Map();
  const byRange = new Map<string, { range: DateRange; tagIds: Set<string> }>();

  for (const page of data.template?.pages ?? []) {
    for (const obj of page.objects ?? []) {
      const objectType = normalizeReportObjectType(obj.type);
      const objectPeriod = obj.props?.period ?? obj.props?.reportPeriod;
      if (!objectPeriod) continue;

      const range = resolveObjectExportRange(obj, report, data.range);
      const key = objectPeriodCacheKey(range.from, range.to);
      if (!byRange.has(key)) {
        byRange.set(key, { range, tagIds: new Set() });
      }
      const entry = byRange.get(key)!;

      if (objectType === 'meter_billing_table' || objectType === 'energy_summary' || objectType === 'cost_summary') {
        for (const tag of listMeterBillingTags(data.tags, data.devices, obj.props ?? {})) {
          entry.tagIds.add(tag.id);
        }
      } else if (objectType === 'value' || objectType === 'formula_value' || objectType === 'formula') {
        for (const id of collectExportObjectTagIds(obj)) entry.tagIds.add(id);
      }
    }
  }

  await Promise.all(Array.from(byRange.entries()).map(async ([key, { range, tagIds }]) => {
    cache.set(key, await buildPeriodScopedData(report, range, tariffId, Array.from(tagIds)));
  }));

  return cache;
}

function objectDataSlice(
  obj: any,
  report: any,
  data: Awaited<ReturnType<typeof buildReportData>>,
  cache: ObjectPeriodCache,
): ObjectPeriodSlice {
  const objectPeriod = obj.props?.period ?? obj.props?.reportPeriod;
  if (!objectPeriod) {
    return { tagSummaries: data.tagSummaries, billing: data.billing };
  }
  const range = resolveObjectExportRange(obj, report, data.range);
  const key = objectPeriodCacheKey(range.from, range.to);
  return cache.get(key) ?? { tagSummaries: data.tagSummaries, billing: data.billing };
}

function sanitizeExcelSheetName(name: string) {
  const cleaned = name.replace(/[\\/*?:[\]]+/g, ' ').trim().slice(0, 28) || 'Meter Table';
  return cleaned;
}

async function buildReportData(report: any, range: DateRange, tariffId?: string) {
  const prisma = getPrismaClient();

  const [historyValues, alarms, billing, tagRecords, deviceRecords] = await Promise.all([
    prisma.historyValue.findMany({
      where: {
        projectId: report.projectId,
        readAt: { gte: range.from, lte: range.to }
      },
      include: { tag: true, device: true },
      orderBy: { readAt: 'asc' }
    }),
    prisma.alarm.findMany({
      where: {
        projectId: report.projectId,
        startedAt: { gte: range.from, lte: range.to }
      },
      include: { tag: true, device: true },
      orderBy: { startedAt: 'asc' }
    }),
    buildBillingSummary(report.projectId, {
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      tariffId,
    }).catch(() => null),
    prisma.tag.findMany({
      where: { projectId: report.projectId },
      select: {
        id: true,
        name: true,
        deviceId: true,
        unit: true,
        description: true,
        energyTagRole: true,
      },
    }),
    prisma.device.findMany({
      where: { projectId: report.projectId },
      select: { id: true, name: true, type: true, parentDeviceId: true },
    }),
  ]);

  const enrichedTags = summarizeHistoryRows(historyValues, billing);

  return {
    projectId: report.projectId,
    range,
    template: parseTemplate(report.templateJson),
    historyCount: historyValues.length,
    alarmCount: alarms.length,
    billing,
    tagSummaries: enrichedTags,
    tags: tagRecords,
    devices: deviceRecords,
    historyValues,
    alarms: alarms.map((alarm) => ({
      id: alarm.id,
      deviceName: alarm.device?.name ?? alarm.deviceId,
      tagName: alarm.tag?.name ?? alarm.tagId,
      alarmType: alarm.alarmType,
      severity: alarm.severity,
      status: alarm.status,
      acknowledged: alarm.acknowledged,
      message: alarm.message,
      limitValue: alarm.limitValue,
      triggerValue: alarm.triggerValue,
      startedAt: alarm.startedAt,
      endedAt: alarm.endedAt,
      ackAt: alarm.ackAt,
      ackUser: alarm.ackUser
    }))
  };
}

function formatValue(value: number | null | undefined, digits = 2) {
  if (value == null || !Number.isFinite(value)) return '--';
  return value.toFixed(digits);
}

function formatDate(value: Date | null | undefined) {
  if (!value) return '--';
  return value.toISOString();
}

function normalizeReportObjectType(type: unknown): string {
  const raw = String(type ?? '').toLowerCase();
  if (raw === 'tagtable') return 'table';
  if (raw === 'alarmtable') return 'alarm_table';
  if (raw === 'trend' || raw === 'echart') return 'graph';
  if (raw === 'kpi_value' || raw === 'kpicard') return 'value';
  if (raw === 'formulavalue') return 'formula_value';
  if (raw === 'rectangle') return 'shape';
  return raw;
}

function objectTagIds(obj: any): string[] {
  const ids = new Set<string>();
  if (obj.tagId) ids.add(String(obj.tagId));
  if (obj.sourceTagId) ids.add(String(obj.sourceTagId));
  if (Array.isArray(obj.tagIds)) {
    for (const id of obj.tagIds) if (id) ids.add(String(id));
  }
  return Array.from(ids);
}

function resolveReportImageSource(obj: any): string | Buffer | null {
  if (!obj) return null;
  const src = obj.imageDataUrl || obj.props?.imageDataUrl || obj.style?.imageDataUrl || obj.props?.src || obj.src;
  if (!src) return null;

  if (typeof src === 'string') {
    if (src.startsWith('data:image/')) {
      try {
        const parts = src.split(',');
        if (parts.length > 1) {
          return Buffer.from(parts[1], 'base64');
        }
      } catch (err) {
        console.error('Failed to parse base64 image data URL:', err);
      }
    } else {
      // Local path check
      try {
        if (fs.existsSync(src)) {
          const stat = fs.statSync(src);
          if (stat.isFile()) {
            return src;
          }
        }
      } catch {
        // Ignore
      }
    }
  }
  return null;
}

function drawSimpleQr(doc: InstanceType<typeof PDFDocument>, x: number, y: number, w: number, h: number, color: string) {
  const size = Math.min(w, h) - 8;
  if (size <= 0) return;
  const ox = x + (w - size) / 2;
  const oy = y + (h - size) / 2;
  const cell = size / 10;
  const squares = [
    [0, 0, 3, 3], [1, 1, 1, 1], [7, 0, 3, 3], [8, 1, 1, 1], [0, 7, 3, 3], [1, 8, 1, 1],
    [4, 4, 1, 1], [6, 5, 1, 1], [8, 7, 2, 2], [4, 8, 1, 2], [7, 4, 2, 1], [6, 9, 1, 1],
  ];
  doc.save().fillColor(color);
  for (const [cx, cy, cw, ch] of squares) {
    doc.rect(ox + cx * cell, oy + cy * cell, cw * cell, ch * cell).fill();
  }
  doc.restore();
}

function appendDefaultBillingSection(
  doc: InstanceType<typeof PDFDocument>,
  report: any,
  data: Awaited<ReturnType<typeof buildReportData>>,
) {
  const bill = data.billing;
  if (!bill) {
    doc.fontSize(10).text('No billing data available for this period.');
    return;
  }

  doc.fontSize(14).text('Energy Billing Summary');
  doc.moveDown(0.4);
  doc.fontSize(10);
  doc.text(`Tariff: ${bill.tariffName} (${bill.tariffMode})`);
  if (bill.warnings && bill.warnings.length > 0) {
    doc.save().fillColor('#dc2626').fontSize(9);
    for (const w of bill.warnings) {
      doc.text(`⚠️ Warning: ${w}`);
    }
    doc.restore().fontSize(10);
  }
  doc.text(`Total kWh: ${formatValue(bill.totalKwh)} | Import: ${formatValue(bill.importKwh)} | Export: ${formatValue(bill.exportKwh)}`);
  doc.text(`Energy: ${formatValue(bill.energyCost)} ${bill.currency} | Demand (${formatValue(bill.peakDemandKw)} kW): ${formatValue(bill.demandCost)} ${bill.currency}`);
  doc.text(`Subtotal: ${formatValue(bill.subtotal)} | VAT: ${formatValue(bill.vat)} | Grand Total: ${formatValue(bill.grandTotal)} ${bill.currency}`);
  doc.moveDown(0.5);

  if (report.reportType === 'device_energy' || report.reportType === 'cost') {
    doc.fontSize(12).text('Per-Device Bills');
    doc.moveDown(0.3);
    doc.fontSize(8);
    doc.text('Device | Role | kWh | Share % | Cost');
    doc.moveDown(0.2);
    for (const device of bill.devices) {
      doc.text(`${device.deviceName} | ${device.role} | ${formatValue(device.kwh)} | ${formatValue(device.sharePct, 1)}% | ${formatValue(device.subtotal)} ${bill.currency}`);
    }
    doc.moveDown(0.5);
  }

  if (bill.touBreakdown.length || bill.tierBreakdown.length) {
    doc.fontSize(12).text(bill.touBreakdown.length ? 'TOU Breakdown' : 'Tier Breakdown');
    doc.moveDown(0.3);
    doc.fontSize(8);
    for (const row of (bill.touBreakdown.length ? bill.touBreakdown : bill.tierBreakdown)) {
      doc.text(`${row.label} | ${formatValue(row.kwh)} kWh @ ${row.ratePerKwh} = ${formatValue(row.cost)} ${bill.currency}`);
    }
  }
}

function writePdf(
  filePath: string,
  report: any,
  data: Awaited<ReturnType<typeof buildReportData>>,
  periodCache: ObjectPeriodCache,
  traceList?: any[],
) {
  return new Promise<void>(async (resolve, reject) => {
    const isLandscape = report.orientation !== 'portrait';
    const pdfWidth = isLandscape ? 841.89 : 595.28;
    const pdfHeight = isLandscape ? 595.28 : 841.89;
    const page = data.template?.pages?.[0];
    const hasTemplate = Array.isArray(data.template?.pages) && data.template.pages.length > 0 && page && Array.isArray(page.objects) && page.objects.length > 0;

    const doc = new PDFDocument({
      margin: hasTemplate ? 0 : 36,
      size: 'A4',
      layout: isLandscape ? 'landscape' : 'portrait'
    });

    const stream = fs.createWriteStream(filePath);
    stream.on('finish', () => resolve());
    stream.on('error', reject);
    doc.on('error', reject);
    doc.pipe(stream);

    if (!hasTemplate) {
      doc.fontSize(18).text(report.name, { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(10).text(`Report type: ${report.reportType}`);
      doc.text(`Period: ${data.range.from.toISOString()} - ${data.range.to.toISOString()}`);
      doc.text('Source: EnergyLink Engine SQLite data. No generated runtime data is used.');
      doc.moveDown();
      if (report.reportType === 'cost' || report.reportType === 'device_energy' || report.reportType === 'monthly_energy' || report.reportType === 'daily_energy') {
        appendDefaultBillingSection(doc, report, data);
        doc.moveDown();
      }

      doc.fontSize(14).text('Energy / Tag Summary');
      doc.moveDown(0.5);
      if (data.tagSummaries.length === 0) {
        doc.fontSize(10).text('No real HistoryValue records were found for this period.');
      } else {
        doc.fontSize(8);
        doc.text('Device | Tag | Count | First | Last | Min | Max | Average | Usage | Unit');
        doc.moveDown(0.2);
        for (const item of data.tagSummaries) {
          doc.text(`${item.deviceName} | ${item.tagName} | ${item.count} | ${formatValue(item.firstValue)} | ${formatValue(item.lastValue)} | ${formatValue(item.minValue)} | ${formatValue(item.maxValue)} | ${formatValue(item.averageValue)} | ${formatValue(item.usageValue)} | ${item.unit ?? ''}`);
        }
      }

      doc.moveDown();
      doc.fontSize(14).text('Alarm Summary');
      doc.moveDown(0.5);
      if (data.alarms.length === 0) {
        doc.fontSize(10).text('No real Alarm records were found for this period.');
      } else {
        doc.fontSize(8);
        doc.text('Started | Device | Tag | Type | Severity | Status | Trigger | Limit | Message');
        doc.moveDown(0.2);
        for (const alarm of data.alarms) {
          doc.text(`${formatDate(alarm.startedAt)} | ${alarm.deviceName} | ${alarm.tagName} | ${alarm.alarmType} | ${alarm.severity} | ${alarm.status} | ${formatValue(alarm.triggerValue)} | ${formatValue(alarm.limitValue)} | ${alarm.message}`);
        }
      }

      doc.moveDown();
      doc.fontSize(9).text(`Template pages: 0`);
      doc.text(`Generated at: ${new Date().toISOString()}`);
      doc.end();
      return;
    }

    // Render template pages
    for (let pIdx = 0; pIdx < data.template.pages.length; pIdx++) {
      if (pIdx > 0) {
        doc.addPage({ margin: 0, size: 'A4', layout: isLandscape ? 'landscape' : 'portrait' });
      }
      const currentPage = data.template.pages[pIdx];
      const designWidth = currentPage.width ?? (isLandscape ? 1123 : 794);
      const designHeight = currentPage.height ?? (isLandscape ? 794 : 1123);
      const sx = pdfWidth / designWidth;
      const sy = pdfHeight / designHeight;

      // Page background
      if (currentPage.backgroundColor) {
        doc.rect(0, 0, pdfWidth, pdfHeight).fill(currentPage.backgroundColor);
      }

      const sortedObjects = [...currentPage.objects].sort((a, b) => (a.layer ?? 0) - (b.layer ?? 0));
      for (const obj of sortedObjects) {
        if (obj.visible === false) continue;
        const objectType = normalizeReportObjectType(obj.type);
        const ox = obj.x * sx;
        const oy = obj.y * sy;
        const ow = obj.width * sx;
        const oh = obj.height * sy;

        const style = obj.style || {};
        const bg = style.background || '#ffffff';
        const border = style.borderColor || '#94a3b8';
        const textCol = style.color || '#0f172a';
        const align = style.align || 'left';
        const fontSize = (style.fontSize || 14) * sy;

        doc.save();

        // Rect/fill background
        if (bg !== 'transparent') {
          doc.rect(ox, oy, ow, oh).fill(bg);
        }

        // Stroke border
        if (border && border !== 'transparent') {
          doc.rect(ox, oy, ow, oh).lineWidth(0.5).stroke(border);
        }
        
        doc.restore();

        doc.fillColor(textCol).fontSize(fontSize);

        if (objectType === 'text') {
          doc.text(obj.text || obj.name, ox + 4, oy + 4, { width: ow - 8, height: oh - 8, align });
        } else if (objectType === 'date') {
          const dateText = new Date().toLocaleString();
          doc.text(dateText, ox + 4, oy + 4, { width: ow - 8, height: oh - 8, align });
        } else if (objectType === 'page_number') {
          const pageText = `Page ${pIdx + 1} of ${data.template.pages.length}`;
          doc.text(pageText, ox + 4, oy + 4, { width: ow - 8, height: oh - 8, align });
        } else if (objectType === 'shape' || objectType === 'line') {
          // Shape and line are rendered by their chrome above.
        } else if (objectType === 'signature') {
          const lineY = oy + oh - Math.max(14, fontSize * 1.4);
          doc.save().strokeColor(textCol).dash(3, { space: 3 }).moveTo(ox + 12, lineY).lineTo(ox + ow - 12, lineY).stroke().undash().restore();
          doc.fillColor(textCol).fontSize(Math.max(7, fontSize * 0.8));
          doc.text(obj.text || 'Sign Here', ox + 4, lineY + 5, { width: ow - 8, align: 'center' });
        } else if (objectType === 'qrcode') {
          const qrText = obj.props?.qrData || obj.props?.value || obj.text || report.name || report.projectId || 'EnergyLink';
          try {
            const qrBuffer = await QRCode.toBuffer(qrText, { type: 'png', width: 256, margin: 1 });
            doc.image(qrBuffer, ox, oy, { width: ow, height: oh });
          } catch (err) {
            console.error('Failed to generate QR Code:', err);
            drawSimpleQr(doc, ox, oy, ow, oh, textCol);
            if (obj.props?.qrData) {
              doc.fontSize(Math.max(6, fontSize * 0.55)).text(String(obj.props.qrData), ox + 4, oy + oh - fontSize, { width: ow - 8, align: 'center' });
            }
          }
        } else if (objectType === 'formula') {
          const slice = objectDataSlice(obj, report, data, periodCache);
          const tagIds = objectTagIds(obj);
          const formulaText = evaluateReportFormula(
            obj.formula || obj.text || '',
            tagIds,
            slice.tagSummaries,
            slice.billing,
          );
          doc.text(formulaText, ox + 4, oy + 4, { width: ow - 8, height: oh - 8, align });
        } else if (objectType === 'formula_value') {
          const slice = objectDataSlice(obj, report, data, periodCache);
          const tagIds = objectTagIds(obj);
          const formulaText = evaluateReportFormula(
            obj.formula || obj.style?.formula || '',
            tagIds,
            slice.tagSummaries,
            slice.billing,
          );
          const unit = String(obj.style?.unit ?? '').trim();
          const display = unit && formulaText !== '—' ? `${formulaText} ${unit}` : formulaText;
          doc.text(display, ox + 4, oy + 4, { width: ow - 8, height: oh - 8, align });
        } else if (objectType === 'value') {
          const slice = objectDataSlice(obj, report, data, periodCache);
          const tagId = obj.tagId ?? obj.sourceTagId;
          const tagSum = tagId ? slice.tagSummaries.find((t) => t.tagId === tagId) : undefined;
          const metric = String(obj.props?.fieldMetric ?? obj.props?.valueMode ?? 'last') as ReportFieldMetric;
          const dp = typeof style.decimalPlaces === 'number' ? style.decimalPlaces : 2;
          const value = resolveFieldMetricValue(metric, tagSum, null);

          const cb = obj.props?.calculationBinding ?? {};
          const ctRatio = Number(cb.ctRatio ?? obj.props?.ctRatio ?? 1);
          const ptRatio = Number(cb.ptRatio ?? obj.props?.ptRatio ?? 1);
          const multiplier = Number(cb.multiplier ?? obj.props?.multiplier ?? 1);
          const scale = Number(cb.scale ?? obj.props?.scale ?? 1);
          const offset = Number(cb.offset ?? obj.props?.offset ?? 0);

          let finalValue = value;
          if (value != null) {
            finalValue = value * ctRatio * ptRatio * multiplier * scale + offset;
          }

          if (traceList) {
            traceList.push({
              objectId: obj.id,
              objectName: obj.name ?? obj.text ?? 'Value object',
              tagId,
              rawValue: value,
              ctRatio,
              ptRatio,
              multiplier,
              scale,
              offset,
              finalValue,
            });
          }

          let display = formatReportFormulaResult(finalValue, dp);
          const unit = String(obj.style?.unit ?? tagSum?.unit ?? '').trim();
          if (unit && display !== '—') display = `${display} ${unit}`;
          if (String(obj.type).toLowerCase() === 'kpicard') {
            doc.fontSize(Math.max(7, fontSize * 0.65)).fillColor('#64748b');
            doc.text(obj.text || obj.name || tagSum?.tagName || 'KPI', ox + 6, oy + 5, { width: ow - 12, align });
            doc.fillColor(textCol).fontSize(fontSize * 1.5);
            doc.text(display, ox + 6, oy + Math.max(18, fontSize * 1.15), { width: ow - 12, height: oh - 20, align });
          } else {
            doc.text(display, ox + 4, oy + 4, { width: ow - 8, height: oh - 8, align });
          }
        } else if (objectType === 'energy_summary' || objectType === 'cost_summary') {
          const bill = data.billing;
          const tagSum = data.tagSummaries.find(t => t.tagId === obj.sourceTagId);
          const isCost = objectType === 'cost_summary';
          const slice = objectDataSlice(obj, report, data, periodCache);
          const billingCtx = slice.billing
            ? billingToFormulaContext(slice.billing as BillingSummaryPayload & Record<string, unknown>)
            : null;
          const summaryMap = new Map(slice.tagSummaries.map((t) => [t.tagId, t]));
          const scopedRows = buildMeterBillingRows(data.tags, data.devices, summaryMap, obj.props ?? {}, billingCtx);
          const scopedUsage = scopedRows.reduce((sum, row) => sum + (row.usageValue ?? 0), 0);
          const scopedAmount = scopedRows.reduce((sum, row) => sum + (row.amount ?? 0), 0);
          const scopeDeviceId = obj.props?.scopeDeviceId ?? obj.props?.deviceId ?? obj.deviceId;
          const scopeDevice = scopeDeviceId ? data.devices.find((device) => device.id === scopeDeviceId) : undefined;
          const scopeLabel = scopeDevice?.name ?? 'Project';

          if (scopedRows.length > 0 && !obj.sourceTagId) {
            const val = isCost ? scopedAmount : scopedUsage;
            const prefix = isCost ? 'Total: ' : 'Usage: ';
            const suffix = isCost ? ` ${bill?.currency ?? 'THB'}` : ' kWh';
            doc.text(`${prefix}${formatValue(val)}${suffix}`, ox + 4, oy + 4, { width: ow - 8, align });
            doc.fontSize(fontSize * 0.75);
            doc.text(
              isCost
                ? `${scopeLabel} | ${scopedRows.length} meter(s)`
                : `${scopeLabel} | ${scopedRows.length} meter(s)`,
              ox + 4, oy + fontSize + 6, { width: ow - 8, align },
            );
          } else if (bill && (isCost || !obj.sourceTagId)) {
            const val = isCost ? bill.grandTotal : bill.totalKwh;
            const prefix = isCost ? 'Total: ' : 'Usage: ';
            const suffix = isCost ? ` ${bill.currency}` : ' kWh';
            doc.text(`${prefix}${formatValue(val)}${suffix}`, ox + 4, oy + 4, { width: ow - 8, align });
          } else if (tagSum) {
            const rate = bill?.energyCostRate ?? data.billing?.energyCostRate ?? 0;
            const val = isCost
              ? (tagSum.usageValue != null ? tagSum.usageValue * rate : (tagSum.averageValue || 0) * rate)
              : (tagSum.usageValue ?? tagSum.averageValue ?? 0);
            const prefix = isCost ? 'Cost: ' : 'Usage: ';
            const suffix = isCost ? ` ${bill?.currency ?? 'THB'}` : ` ${tagSum.unit || 'kWh'}`;
            doc.text(`${prefix}${formatValue(val)}${suffix}`, ox + 4, oy + 4, { width: ow - 8, align });
          } else {
            doc.text('No billing/tag binding', ox + 4, oy + 4, { width: ow - 8, align });
          }
        } else if (objectType === 'table') {
          const ids = objectTagIds(obj);
          const scopedDeviceIds = new Set(resolveReportScopeDeviceIds(data.devices, obj.props ?? {}));
          const deviceId = obj.props?.scopeDeviceId ?? obj.props?.deviceId ?? obj.deviceId ?? obj.binding?.deviceId;
          const historyRows = data.historyValues
            .filter(h => (ids.length ? ids.includes(h.tagId) : true)
              && (scopedDeviceIds.size > 0 ? scopedDeviceIds.has(h.deviceId) : (!deviceId || h.deviceId === deviceId)))
            .slice(-20);
          if (historyRows.length === 0) {
            doc.text('No tag history data', ox + 4, oy + 4, { width: ow - 8, align });
          } else {
            doc.fontSize(fontSize * 0.7);
            let currentY = oy + 4;
            doc.text('Time | Tag | Value | Unit', ox + 4, currentY, { width: ow - 8 });
            currentY += fontSize + 2;
            doc.save().lineWidth(0.5).moveTo(ox + 4, currentY).lineTo(ox + ow - 4, currentY).stroke().restore();
            currentY += 2;
            for (const row of historyRows) {
              if (currentY + fontSize > oy + oh) break;
              const timeStr = new Date(row.readAt).toLocaleTimeString();
              doc.text(`${timeStr} | ${row.tag?.name ?? row.tagId} | ${formatValue(row.value)} | ${row.tag?.unit || ''}`, ox + 4, currentY, { width: ow - 8, lineBreak: false });
              currentY += fontSize + 1;
            }
          }
        } else if (objectType === 'alarm_table') {
          const alarms = data.alarms.slice(0, 8);
          if (alarms.length === 0) {
            doc.text('No active alarms', ox + 4, oy + 4, { width: ow - 8, align });
          } else {
            doc.fontSize(fontSize * 0.7);
            let currentY = oy + 4;
            doc.text('Time | Device | Type | Msg', ox + 4, currentY, { width: ow - 8 });
            currentY += fontSize + 2;
            doc.save().lineWidth(0.5).moveTo(ox + 4, currentY).lineTo(ox + ow - 4, currentY).stroke().restore();
            currentY += 2;
            for (const alarm of alarms) {
              if (currentY + fontSize > oy + oh) break;
              const timeStr = new Date(alarm.startedAt).toLocaleTimeString();
              doc.text(`${timeStr} | ${alarm.deviceName} | ${alarm.alarmType} | ${alarm.message}`, ox + 4, currentY, { width: ow - 8, lineBreak: false });
              currentY += fontSize + 1;
            }
          }
        } else if (objectType === 'graph') {
          const ids = objectTagIds(obj);
          const scopedDeviceIds = new Set(resolveReportScopeDeviceIds(data.devices, obj.props ?? {}));
          const deviceId = obj.props?.scopeDeviceId ?? obj.props?.deviceId ?? obj.deviceId ?? obj.binding?.deviceId;
          const historyRows = data.historyValues.filter(h => (ids.length ? ids.includes(h.tagId) : true)
            && (scopedDeviceIds.size > 0 ? scopedDeviceIds.has(h.deviceId) : (!deviceId || h.deviceId === deviceId)));
          const values = historyRows.map(h => h.value).filter((v): v is number => typeof v === 'number');
          if (values.length < 2) {
            doc.text('Insufficient data', ox + 4, oy + 4, { width: ow - 8, align });
          } else {
            const minVal = Math.min(...values);
            const maxVal = Math.max(...values);
            const range = maxVal - minVal || 1;
            
            doc.save();
            doc.strokeColor('#087c8b').lineWidth(1.5);
            for (let i = 0; i < values.length; i++) {
              const vx = ox + 6 + (i / (values.length - 1)) * (ow - 12);
              const vy = oy + oh - 6 - ((values[i] - minVal) / range) * (oh - 12);
              if (i === 0) doc.moveTo(vx, vy);
              else doc.lineTo(vx, vy);
            }
            doc.stroke();
            doc.restore();

            doc.fontSize(fontSize * 0.6).fillColor('#64748b');
            doc.text(`Max: ${formatValue(maxVal)}`, ox + 4, oy + 2);
            doc.text(`Min: ${formatValue(minVal)}`, ox + 4, oy + oh - fontSize * 0.8);
          }
        } else if (objectType === 'meter_billing_table') {
          const slice = objectDataSlice(obj, report, data, periodCache);
          const billingCtx = slice.billing
            ? billingToFormulaContext(slice.billing as BillingSummaryPayload & Record<string, unknown>)
            : null;
          const summaryMap = new Map(slice.tagSummaries.map((t) => [t.tagId, t]));
          const rows = buildMeterBillingRows(
            data.tags,
            data.devices,
            summaryMap,
            obj.props ?? {},
            billingCtx,
          );
          const columns = parseMeterBillingColumns(obj.props?.columns);
          const dp = typeof style.decimalPlaces === 'number' ? style.decimalPlaces : 2;
          const cellFont = fontSize * 0.62;
          const rowH = cellFont + 3;
          let currentY = oy + 3;
          const tableWidth = ow - 8;
          const colW = columns.length ? tableWidth / columns.length : tableWidth;

          if (obj.props?.showHeader !== false && columns.length > 0) {
            doc.fontSize(cellFont).font('Helvetica-Bold');
            columns.forEach((col, i) => {
              doc.text(
                meterBillingColumnLabel(col, 'th'),
                ox + 4 + i * colW,
                currentY,
                { width: colW - 2, align: 'left', lineBreak: false },
              );
            });
            currentY += rowH;
            doc.save().lineWidth(0.4).moveTo(ox + 4, currentY).lineTo(ox + ow - 4, currentY).stroke().restore();
            currentY += 2;
          }

          doc.font('Helvetica').fontSize(cellFont);
          for (const row of rows) {
            if (currentY + rowH > oy + oh - 2) break;
            columns.forEach((col, i) => {
              const align = ['index', 'first', 'last', 'usage', 'rate', 'amount'].includes(col) ? 'right' : 'left';
              doc.text(
                formatMeterCell(col, row, dp),
                ox + 4 + i * colW,
                currentY,
                { width: colW - 2, align, lineBreak: false },
              );
            });
            currentY += rowH;
          }
        } else if (objectType === 'image') {
          try {
            const imageSrc = resolveReportImageSource(obj);
            if (imageSrc) {
              doc.image(imageSrc, ox, oy, { fit: [ow, oh], align: 'center', valign: 'center' });
            } else {
              // Draw a placeholder frame
              doc.save()
                 .lineWidth(1)
                 .rect(ox, oy, ow, oh)
                 .dash(4, { space: 2 })
                 .strokeColor('#cbd5e1')
                 .stroke()
                 .restore();
              doc.fillColor('#94a3b8')
                 .fontSize(fontSize * 0.65 || 9)
                 .text('Image not available', ox + 4, oy + (oh - 10) / 2, { width: ow - 8, align: 'center' });
            }
          } catch (err) {
            console.error('Failed to render image in report PDF generation:', err);
            doc.fillColor('#ef4444')
               .fontSize(fontSize * 0.65 || 9)
               .text('Image error', ox + 4, oy + (oh - 10) / 2, { width: ow - 8, align: 'center' });
          }
        }
      }
    }

    doc.end();
  });
}

async function writeExcel(
  filePath: string,
  report: any,
  data: Awaited<ReturnType<typeof buildReportData>>,
  periodCache: ObjectPeriodCache,
  traceList?: any[],
) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'EnergyLink Management';
  workbook.created = new Date();

  const summary = workbook.addWorksheet('Summary');
  summary.addRows([
    ['Report Name', report.name],
    ['Report Type', report.reportType],
    ['Period From', data.range.from.toISOString()],
    ['Period To', data.range.to.toISOString()],
    ['History Records', data.historyCount],
    ['Alarm Records', data.alarmCount],
    ['Data Source', 'EnergyLink Engine SQLite data. No generated runtime data is used.']
  ]);

  if (data.billing) {
    const b = data.billing;
    summary.addRows([
      [],
      ['--- Energy Billing ---'],
      ['Tariff', b.tariffName],
      ['Mode', b.tariffMode],
    ]);

    if (b.warnings && b.warnings.length > 0) {
      for (const w of b.warnings) {
        summary.addRow([`⚠️ Warning`, w]);
      }
    }

    summary.addRows([
      ['Total kWh', b.totalKwh],
      ['Energy Cost', b.energyCost],
      ['Demand Cost', b.demandCost],
      ['Subtotal', b.subtotal],
      ['VAT', b.vat],
      ['Grand Total', `${b.grandTotal} ${b.currency}`],
    ]);
  }

  const tags = workbook.addWorksheet('Tag Summary');
  tags.columns = [
    { header: 'Device', key: 'deviceName', width: 24 },
    { header: 'Tag', key: 'tagName', width: 24 },
    { header: 'Count', key: 'count', width: 12 },
    { header: 'First Value', key: 'firstValue', width: 16 },
    { header: 'Last Value', key: 'lastValue', width: 16 },
    { header: 'Min', key: 'minValue', width: 16 },
    { header: 'Max', key: 'maxValue', width: 16 },
    { header: 'Average', key: 'averageValue', width: 16 },
    { header: 'Usage', key: 'usageValue', width: 16 },
    { header: 'Unit', key: 'unit', width: 12 },
    { header: 'First At', key: 'firstAt', width: 26 },
    { header: 'Last At', key: 'lastAt', width: 26 }
  ];
  for (const item of data.tagSummaries) {
    tags.addRow({ ...item, firstAt: formatDate(item.firstAt), lastAt: formatDate(item.lastAt) });
  }

  const alarms = workbook.addWorksheet('Alarms');
  alarms.columns = [
    { header: 'Started At', key: 'startedAt', width: 26 },
    { header: 'Device', key: 'deviceName', width: 24 },
    { header: 'Tag', key: 'tagName', width: 24 },
    { header: 'Type', key: 'alarmType', width: 12 },
    { header: 'Severity', key: 'severity', width: 12 },
    { header: 'Status', key: 'status', width: 12 },
    { header: 'Acknowledged', key: 'acknowledged', width: 14 },
    { header: 'Trigger Value', key: 'triggerValue', width: 16 },
    { header: 'Limit Value', key: 'limitValue', width: 16 },
    { header: 'Message', key: 'message', width: 40 }
  ];
  for (const alarm of data.alarms) {
    alarms.addRow({ ...alarm, startedAt: formatDate(alarm.startedAt) });
  }

  if (data.billing) {
    const billSheet = workbook.addWorksheet('Billing');
    billSheet.columns = [
      { header: 'Item', key: 'label', width: 32 },
      { header: 'Qty', key: 'quantity', width: 12 },
      { header: 'Unit', key: 'unit', width: 10 },
      { header: 'Rate', key: 'unitPrice', width: 12 },
      { header: 'Amount', key: 'amount', width: 14 },
    ];
    for (const line of data.billing.lineItems) {
      billSheet.addRow(line);
    }
    billSheet.addRow([]);
    billSheet.addRow({ label: 'Grand Total', amount: data.billing.grandTotal });

    const devices = workbook.addWorksheet('Device Bills');
    devices.columns = [
      { header: 'Device', key: 'deviceName', width: 24 },
      { header: 'Role', key: 'role', width: 14 },
      { header: 'Category', key: 'loadCategory', width: 16 },
      { header: 'kWh', key: 'kwh', width: 12 },
      { header: 'Share %', key: 'sharePct', width: 10 },
      { header: 'Energy Cost', key: 'energyCost', width: 14 },
      { header: 'Demand kW', key: 'demandKw', width: 12 },
      { header: 'Demand Cost', key: 'demandCost', width: 14 },
      { header: 'Subtotal', key: 'subtotal', width: 14 },
    ];
    for (const d of data.billing.devices) {
      devices.addRow(d);
    }

    if (data.billing.touBreakdown.length) {
      const tou = workbook.addWorksheet('TOU Breakdown');
      tou.columns = [
        { header: 'Band', key: 'label', width: 28 },
        { header: 'kWh', key: 'kwh', width: 12 },
        { header: 'Rate', key: 'ratePerKwh', width: 12 },
        { header: 'Cost', key: 'cost', width: 14 },
      ];
      for (const row of data.billing.touBreakdown) {
        tou.addRow(row);
      }
    }

    if (data.billing.tierBreakdown.length) {
      const tiers = workbook.addWorksheet('Tier Breakdown');
      tiers.columns = [
        { header: 'Tier', key: 'label', width: 28 },
        { header: 'kWh', key: 'kwh', width: 12 },
        { header: 'Rate', key: 'ratePerKwh', width: 12 },
        { header: 'Cost', key: 'cost', width: 14 },
      ];
      for (const row of data.billing.tierBreakdown) {
        tiers.addRow(row);
      }
    }
  }

  const meterTables: Array<{ obj: any; pageName: string }> = [];
  for (const page of data.template?.pages ?? []) {
    for (const obj of page.objects ?? []) {
      if (obj.type === 'meter_billing_table') {
        meterTables.push({ obj, pageName: page.name ?? page.id ?? 'Page' });
      }
    }
  }

  const usedSheetNames = new Set<string>(['Summary', 'Tag Summary', 'Alarms', 'Billing', 'Device Bills', 'TOU Breakdown', 'Tier Breakdown']);
  for (const { obj, pageName } of meterTables) {
    const slice = objectDataSlice(obj, report, data, periodCache);
    const billingCtx = slice.billing
      ? billingToFormulaContext(slice.billing as BillingSummaryPayload & Record<string, unknown>)
      : null;
    const summaryMap = new Map(slice.tagSummaries.map((t) => [t.tagId, t]));
    const rows = buildMeterBillingRows(data.tags, data.devices, summaryMap, obj.props ?? {}, billingCtx);
    const columns = parseMeterBillingColumns(obj.props?.columns);
    const dp = typeof obj.style?.decimalPlaces === 'number' ? obj.style.decimalPlaces : 2;

    let baseName = sanitizeExcelSheetName(`${pageName} ${obj.name || 'Meter'}`);
    let sheetName = baseName;
    let suffix = 2;
    while (usedSheetNames.has(sheetName)) {
      sheetName = sanitizeExcelSheetName(`${baseName} ${suffix}`);
      suffix += 1;
    }
    usedSheetNames.add(sheetName);

    const sheet = workbook.addWorksheet(sheetName);
    sheet.columns = columns.map((col) => ({
      header: meterBillingColumnLabel(col, 'th'),
      key: col,
      width: col === 'device' || col === 'tag' ? 22 : 14,
    }));
    for (const row of rows) {
      const record: Record<string, string> = {};
      for (const col of columns) {
        record[col] = formatMeterCell(col, row, dp);
      }
      sheet.addRow(record);
    }
  }

  await workbook.xlsx.writeFile(filePath);
}

export async function generateReport(options: GenerateReportOptions) {
  const prisma = getPrismaClient();
  const report = await prisma.report.findUnique({ where: { id: options.reportId } });
  if (!report) throw new Error(`Report not found: ${options.reportId}`);

  const template = parseTemplate(report.templateJson);
  if (template?.mode === 'spreadsheet') {
    return generateSpreadsheetReport(report, options);
  }

  const format = asSupportedFormat(options.format ?? report.outputFormat);
  const range = parseDateRange(report, options.from, options.to);
  const data = await buildReportData(report, range, options.tariffId);
  const periodCache = await prefetchObjectPeriodCaches(report, data, options.tariffId);

  const reportsDir = getReportsDir();
  fs.mkdirSync(reportsDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const extension = format === 'excel' ? 'xlsx' : 'pdf';
  const fileName = `${sanitizeFileName(report.name)}_${timestamp}.${extension}`;
  const filePath = path.join(reportsDir, fileName);

  const traceList: any[] = [];

  if (format === 'excel') await writeExcel(filePath, report, data, periodCache, traceList);
  else writePdf(filePath, report, data, periodCache, traceList);

  appendEngineLog('info', 'Report generated from real stored data', {
    reportId: report.id,
    reportName: report.name,
    format,
    fileName,
    historyCount: data.historyCount,
    alarmCount: data.alarmCount,
    requestedBy: options.requestedBy ?? 'unknown'
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
    calculationTrace: traceList,
    source: {
      historyCount: data.historyCount,
      alarmCount: data.alarmCount,
      runtimeSource: 'not_present',
      generatedData: false
    }
  };
}

export function listGeneratedReportFiles() {
  const reportsDir = getReportsDir();
  fs.mkdirSync(reportsDir, { recursive: true });
  return fs.readdirSync(reportsDir)
    .filter((name) => name.endsWith('.pdf') || name.endsWith('.xlsx'))
    .map((name) => {
      const filePath = path.join(reportsDir, name);
      const stat = fs.statSync(filePath);
      return {
        fileName: name,
        sizeBytes: stat.size,
        createdAt: stat.birthtime.toISOString(),
        updatedAt: stat.mtime.toISOString(),
        downloadUrl: `/api/reports/files/${encodeURIComponent(name)}`
      };
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function resolveGeneratedReportFile(fileName: string) {
  const safeName = path.basename(fileName);
  const filePath = path.join(getReportsDir(), safeName);
  if (!fs.existsSync(filePath)) return null;
  return { fileName: safeName, filePath };
}
