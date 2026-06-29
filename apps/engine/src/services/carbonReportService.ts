import fs from 'node:fs';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import { getReportsDir } from '@energylink/shared-data';
import { getPrismaClient } from './database.js';
import { appendEngineLog } from './engineLogger.js';
import { buildCarbonBreakdown, buildCarbonSummary, resolveProjectId } from './carbonService.js';
import type { CarbonBreakdownBy } from '@energylink/shared-types';

type ReportFormat = 'pdf' | 'excel';
type CarbonPeriod = 'live' | 'today' | '7d' | '30d';

export type GenerateCarbonReportOptions = {
  projectId?: string;
  period?: CarbonPeriod;
  format?: string;
  from?: string;
  to?: string;
  requestedBy?: string;
};

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 80) || 'carbon_report';
}

function asFormat(format?: string): ReportFormat {
  const normalized = String(format ?? 'pdf').toLowerCase();
  if (normalized === 'xlsx' || normalized === 'excel') return 'excel';
  return 'pdf';
}

function strategyLabel(strategy: string) {
  if (strategy === 'site_main') return 'Main meter (site total)';
  if (strategy === 'include_in_carbon') return 'Included sub-meters';
  return 'All kWh tags (fallback)';
}

function byLabel(by: CarbonBreakdownBy) {
  if (by === 'device') return 'Device';
  if (by === 'source') return 'Energy source';
  return 'Load category';
}

async function loadReportPayload(projectId: string | undefined, period: CarbonPeriod, from?: string, to?: string) {
  const resolvedId = await resolveProjectId(projectId);
  if (!resolvedId) throw new Error('No project found for carbon report.');

  const prisma = getPrismaClient();
  const project = await prisma.project.findUnique({ where: { id: resolvedId } });
  if (!project) throw new Error(`Project not found: ${resolvedId}`);

  const query = { period, from, to };
  const summary = await buildCarbonSummary(resolvedId, query);
  if (!summary) throw new Error('Unable to build carbon summary.');

  const breakdowns = await Promise.all(
    (['loadCategory', 'device', 'source'] as CarbonBreakdownBy[]).map(async by => {
      const data = await buildCarbonBreakdown(resolvedId, by, query);
      return { by, data };
    }),
  );

  return { project, summary, breakdowns, resolvedId };
}

function writePdf(
  filePath: string,
  payload: Awaited<ReturnType<typeof loadReportPayload>>,
) {
  const { project, summary, breakdowns } = payload;
  const generatedAt = new Date();

  return new Promise<void>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48, size: 'A4' });
    const stream = fs.createWriteStream(filePath);
    stream.on('finish', () => resolve());
    stream.on('error', reject);
    doc.on('error', reject);
    doc.pipe(stream);

    doc.fontSize(20).text('Carbon Emissions Report', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(11).fillColor('#444444');
    doc.text(`Project: ${project.name}`);
    doc.text(`Period: ${summary.period}${summary.from ? ` (${summary.from} → ${summary.to})` : ''}`);
    doc.text(`Generated: ${generatedAt.toLocaleString()}`);
    doc.text(`Data source: ${summary.dataSource}`);
    doc.text(`Strategy: ${strategyLabel(summary.strategy)}`);
    doc.moveDown();

    doc.fillColor('#000000').fontSize(13).text('Summary', { underline: true });
    doc.moveDown(0.4);
    doc.fontSize(11);
    const rows: Array<[string, string]> = [
      ['Facility type', project.facilityType],
      ['Emission factor', `${summary.emissionFactorKgPerKwh} kg CO₂e / kWh`],
      ['Net metering', summary.netMetering ? 'Yes' : 'No'],
      ['Qualified energy', `${summary.kWhQualified.toFixed(2)} kWh`],
      ['Carbon emitted', `${summary.carbonKg.toFixed(2)} kg CO₂e`],
      ['Import', `${summary.importKwh.toFixed(2)} kWh`],
      ['Export', `${summary.exportKwh.toFixed(2)} kWh`],
      ['Net', `${summary.netKwh.toFixed(2)} kWh`],
    ];
    if (project.floorAreaM2 && project.floorAreaM2 > 0) {
      rows.push(['Floor area', `${project.floorAreaM2} m²`]);
      rows.push(['Intensity', `${(summary.carbonKg / project.floorAreaM2).toFixed(3)} kg CO₂e / m²`]);
    }
    if (project.energyCostRate > 0) {
      rows.push(['Energy cost rate', `${project.energyCostRate} ${project.currency}/kWh`]);
      rows.push(['Estimated cost', `${(summary.kWhQualified * project.energyCostRate).toFixed(2)} ${project.currency}`]);
    }
    for (const [label, value] of rows) {
      doc.text(`${label}: ${value}`);
    }

    if (summary.configIssues?.length) {
      doc.moveDown();
      doc.fontSize(13).text('Configuration notes', { underline: true });
      doc.moveDown(0.3);
      doc.fontSize(10);
      for (const issue of summary.configIssues) {
        doc.text(`• [${issue.severity}] ${issue.message}`);
      }
    }

    for (const { by, data } of breakdowns) {
      if (!data?.items.length) continue;
      doc.addPage();
      doc.fontSize(13).fillColor('#000000').text(`Breakdown — ${byLabel(by)}`, { underline: true });
      doc.moveDown(0.4);
      doc.fontSize(10);
      doc.text(`${'Label'.padEnd(28)} kWh`.padStart(12) + '  kg CO₂e'.padStart(12) + '  Share %'.padStart(10));
      doc.moveDown(0.2);
      for (const item of data.items.slice(0, 40)) {
        const line =
          `${item.label.slice(0, 28).padEnd(28)}` +
          `${item.kWh.toFixed(1).padStart(12)}` +
          `${item.carbonKg.toFixed(1).padStart(12)}` +
          `${item.sharePct.toFixed(1).padStart(10)}`;
        doc.text(line);
      }
      doc.moveDown(0.5);
      doc.text(`Total: ${data.totalKwh.toFixed(2)} kWh · ${data.totalCarbonKg.toFixed(2)} kg CO₂e`);
    }

    doc.end();
  });
}

async function writeExcel(
  filePath: string,
  payload: Awaited<ReturnType<typeof loadReportPayload>>,
) {
  const { project, summary, breakdowns } = payload;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'EnergyLink Management';
  workbook.created = new Date();

  const summarySheet = workbook.addWorksheet('Summary');
  summarySheet.addRows([
    ['Carbon Emissions Report'],
    ['Project', project.name],
    ['Period', summary.period],
    ['From', summary.from ?? ''],
    ['To', summary.to ?? ''],
    ['Data source', summary.dataSource],
    ['Strategy', strategyLabel(summary.strategy)],
    ['Facility type', project.facilityType],
    ['Emission factor (kg/kWh)', summary.emissionFactorKgPerKwh],
    ['Net metering', summary.netMetering ? 'Yes' : 'No'],
    ['Qualified kWh', summary.kWhQualified],
    ['Carbon kg CO₂e', summary.carbonKg],
    ['Import kWh', summary.importKwh],
    ['Export kWh', summary.exportKwh],
    ['Net kWh', summary.netKwh],
    ['Floor area m²', project.floorAreaM2 ?? ''],
    ['Energy cost rate', project.energyCostRate],
    ['Currency', project.currency],
    ['Estimated cost', project.energyCostRate > 0 ? summary.kWhQualified * project.energyCostRate : ''],
  ]);

  if (summary.configIssues?.length) {
    const issuesSheet = workbook.addWorksheet('Config Issues');
    issuesSheet.columns = [
      { header: 'Severity', key: 'severity', width: 12 },
      { header: 'Code', key: 'code', width: 24 },
      { header: 'Message', key: 'message', width: 48 },
      { header: 'Message (TH)', key: 'messageTh', width: 48 },
    ];
    for (const issue of summary.configIssues) {
      issuesSheet.addRow(issue);
    }
  }

  for (const { by, data } of breakdowns) {
    if (!data) continue;
    const sheet = workbook.addWorksheet(byLabel(by).slice(0, 31));
    sheet.columns = [
      { header: 'Key', key: 'key', width: 20 },
      { header: 'Label', key: 'label', width: 28 },
      { header: 'kWh', key: 'kWh', width: 14 },
      { header: 'kg CO₂e', key: 'carbonKg', width: 14 },
      { header: 'Share %', key: 'sharePct', width: 12 },
    ];
    for (const item of data.items) {
      sheet.addRow(item);
    }
    sheet.addRow({});
    sheet.addRow({ label: 'TOTAL', kWh: data.totalKwh, carbonKg: data.totalCarbonKg });
  }

  await workbook.xlsx.writeFile(filePath);
}

export async function generateCarbonReport(options: GenerateCarbonReportOptions) {
  const period = options.period ?? '30d';
  const format = asFormat(options.format);
  const payload = await loadReportPayload(options.projectId, period, options.from, options.to);

  const reportsDir = getReportsDir();
  fs.mkdirSync(reportsDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const extension = format === 'excel' ? 'xlsx' : 'pdf';
  const fileName = `carbon_${sanitizeFileName(payload.project.name)}_${period}_${timestamp}.${extension}`;
  const filePath = path.join(reportsDir, fileName);

  if (format === 'excel') await writeExcel(filePath, payload);
  else await writePdf(filePath, payload);

  const stat = fs.statSync(filePath);
  appendEngineLog('info', 'Carbon report generated', {
    projectId: payload.resolvedId,
    period,
    format,
    fileName,
    requestedBy: options.requestedBy ?? 'unknown',
  });

  return {
    projectId: payload.resolvedId,
    projectName: payload.project.name,
    format,
    fileName,
    filePath,
    downloadUrl: `/api/reports/files/${encodeURIComponent(fileName)}`,
    sizeBytes: stat.size,
    generatedAt: new Date().toISOString(),
    period: {
      label: period,
      from: payload.summary.from,
      to: payload.summary.to,
    },
    summary: {
      kWhQualified: payload.summary.kWhQualified,
      carbonKg: payload.summary.carbonKg,
      emissionFactorKgPerKwh: payload.summary.emissionFactorKgPerKwh,
    },
  };
}
