import fs from 'node:fs';
import type { FastifyInstance } from 'fastify';
import { getPrismaClient } from '../services/database.js';
import { appendEngineLog } from '../services/engineLogger.js';
import { generateReport, listGeneratedReportFiles, resolveGeneratedReportFile } from '../services/reportGenerationService.js';
import { buildSpreadsheetTemplateFromUpload, resolveSpreadsheetPreview } from '../services/reportSpreadsheetService.js';

type ReportInput = {
  projectId?: string;
  name?: string;
  description?: string | null;
  reportType?: string;
  paperSize?: string;
  orientation?: string;
  defaultDateRange?: string;
  outputFormat?: string;
  isDefault?: boolean;
  template?: unknown;
  templateJson?: string;
};

type SpreadsheetImportInput = {
  filename?: string;
  dataBase64?: string;
  kind?: 'xlsx' | 'csv';
};

type SpreadsheetPreviewInput = {
  from?: string;
  to?: string;
  tariffId?: string;
};

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function optionalText(value: unknown) {
  const text = cleanText(value);
  return text.length ? text : null;
}

function templateString(input: ReportInput) {
  if (typeof input.templateJson === 'string') return input.templateJson;
  if (input.template !== undefined) return JSON.stringify(input.template);
  return '{"version":1,"pages":[{"id":"page_1","width":1123,"height":794,"objects":[]}]}';
}

function validateReportInput(input: ReportInput, partial = false) {
  const errors: string[] = [];
  if (!partial || input.projectId !== undefined) {
    if (!cleanText(input.projectId)) errors.push('Project is required.');
  }
  if (!partial || input.name !== undefined) {
    const name = cleanText(input.name);
    if (!name) errors.push('Report name is required.');
    if (name.length > 120) errors.push('Report name must be 120 characters or less.');
  }
  if (input.orientation !== undefined && !['portrait', 'landscape'].includes(cleanText(input.orientation))) errors.push('Orientation must be portrait or landscape.');
  if (input.templateJson !== undefined) {
    try { JSON.parse(input.templateJson); } catch { errors.push('Report templateJson must be valid JSON.'); }
  }
  return { valid: errors.length === 0, errors };
}

function reportCreateData(input: ReportInput) {
  return {
    projectId: cleanText(input.projectId),
    name: cleanText(input.name),
    description: optionalText(input.description),
    reportType: cleanText(input.reportType) || 'daily_energy',
    paperSize: cleanText(input.paperSize) || 'A4',
    orientation: cleanText(input.orientation) || 'landscape',
    defaultDateRange: cleanText(input.defaultDateRange) || 'this_month',
    outputFormat: cleanText(input.outputFormat) || 'pdf',
    isDefault: Boolean(input.isDefault),
    templateJson: templateString(input)
  };
}

function reportUpdateData(input: ReportInput) {
  const data: Record<string, unknown> = {};
  if (input.projectId !== undefined) data.projectId = cleanText(input.projectId);
  if (input.name !== undefined) data.name = cleanText(input.name);
  if (input.description !== undefined) data.description = optionalText(input.description);
  if (input.reportType !== undefined) data.reportType = cleanText(input.reportType) || 'daily_energy';
  if (input.paperSize !== undefined) data.paperSize = cleanText(input.paperSize) || 'A4';
  if (input.orientation !== undefined) data.orientation = cleanText(input.orientation) || 'landscape';
  if (input.defaultDateRange !== undefined) data.defaultDateRange = cleanText(input.defaultDateRange) || 'this_month';
  if (input.outputFormat !== undefined) data.outputFormat = cleanText(input.outputFormat) || 'pdf';
  if (input.isDefault !== undefined) data.isDefault = Boolean(input.isDefault);
  if (input.template !== undefined || input.templateJson !== undefined) data.templateJson = templateString(input);
  return data;
}


function parseTemplate(templateJson: string | null | undefined) {
  if (!templateJson) return { version: 1, pages: [] };
  try {
    const parsed = JSON.parse(templateJson);
    if (!parsed || typeof parsed !== 'object') return { version: 1, pages: [] };
    return parsed;
  } catch (error) {
    return {
      version: 1,
      pages: [],
      parseError: error instanceof Error ? error.message : String(error)
    };
  }
}

function toSummary(report: any) {
  return {
    id: report.id,
    projectId: report.projectId,
    name: report.name,
    description: report.description,
    reportType: report.reportType,
    paperSize: report.paperSize,
    orientation: report.orientation,
    defaultDateRange: report.defaultDateRange,
    outputFormat: report.outputFormat,
    isDefault: report.isDefault,
    updatedAt: report.updatedAt
  };
}

function toRuntime(report: any) {
  return {
    ...toSummary(report),
    template: parseTemplate(report.templateJson)
  };
}

export async function registerReportsRoutes(app: FastifyInstance) {
  app.get('/api/reports', async () => {
    const prisma = getPrismaClient();
    const reports = await prisma.report.findMany({ orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }] });
    return { reports: reports.map(toRuntime) };
  });


  app.post('/api/reports', async (request, reply) => {
    const input = (request.body ?? {}) as ReportInput;
    const validation = validateReportInput(input);
    if (!validation.valid) return reply.code(400).send({ message: 'Report validation failed.', errors: validation.errors });
    const prisma = getPrismaClient();
    try {
      const data = reportCreateData(input);
      if (data.isDefault) await prisma.report.updateMany({ where: { projectId: data.projectId }, data: { isDefault: false } });
      const report = await prisma.report.create({ data: data as any });
      appendEngineLog('info', 'Report created', { reportId: report.id, name: report.name });
      return reply.code(201).send({ report: toRuntime(report) });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return reply.code(409).send({ message });
    }
  });

  app.put('/api/reports/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const input = (request.body ?? {}) as ReportInput;
    const validation = validateReportInput(input, true);
    if (!validation.valid) return reply.code(400).send({ message: 'Report validation failed.', errors: validation.errors });
    const prisma = getPrismaClient();
    try {
      const existing = await prisma.report.findUnique({ where: { id } });
      if (!existing) return reply.code(404).send({ message: `Report not found: ${id}` });
      const data = reportUpdateData(input);
      if (data.isDefault === true) await prisma.report.updateMany({ where: { projectId: existing.projectId }, data: { isDefault: false } });
      const report = await prisma.report.update({ where: { id }, data: data as any });
      appendEngineLog('info', 'Report updated', { reportId: report.id, name: report.name });
      return { report: toRuntime(report) };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return reply.code(409).send({ message });
    }
  });

  app.post('/api/reports/:id/set-default', async (request, reply) => {
    const { id } = request.params as { id: string };
    const prisma = getPrismaClient();
    const existing = await prisma.report.findUnique({ where: { id } });
    if (!existing) return reply.code(404).send({ message: `Report not found: ${id}` });
    await prisma.report.updateMany({ where: { projectId: existing.projectId }, data: { isDefault: false } });
    const report = await prisma.report.update({ where: { id }, data: { isDefault: true } });
    appendEngineLog('info', 'Default report selected', { reportId: report.id, name: report.name });
    return { report: toRuntime(report) };
  });

  app.delete('/api/reports/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const prisma = getPrismaClient();
    try {
      const report = await prisma.report.delete({ where: { id } });
      appendEngineLog('info', 'Report deleted', { reportId: id, name: report.name });
      return { ok: true, reportId: id };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return reply.code(404).send({ message });
    }
  });

  app.get('/api/reports/default', async (_, reply) => {
    const prisma = getPrismaClient();
    const report = await prisma.report.findFirst({ orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }] });
    if (!report) {
      reply.code(404);
      return { message: 'No report has been created in the database.' };
    }
    appendEngineLog('info', 'Report runtime template requested', { reportId: report.id, name: report.name });
    return {
      report: toRuntime(report),
      runtime: {
        generation: 'available',
        historicalValues: 'uses_real_history_values_only',
        runtimeSource: 'not_present',
        note: 'Phase 13 can generate PDF or Excel files from real HistoryValue and Alarm records only. No generated report data is used.'
      }
    };
  });



  app.post('/api/reports/:id/generate', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as { format?: string; from?: string; to?: string; tariffId?: string; requestedBy?: string };
    try {
      const result = await generateReport({
        reportId: id,
        format: body.format,
        from: body.from,
        to: body.to,
        tariffId: body.tariffId,
        requestedBy: body.requestedBy
      });
      return { generated: result };
    } catch (error) {
      reply.code(400);
      const message = error instanceof Error ? error.message : String(error);
      appendEngineLog('error', 'Report generation failed', { reportId: id, message });
      return { message };
    }
  });

  app.post('/api/reports/:id/import-spreadsheet', { bodyLimit: 20 * 1024 * 1024 }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as SpreadsheetImportInput;
    const fileName = cleanText(body.filename);
    const kind = body.kind === 'csv' ? 'csv' : 'xlsx';
    if (!fileName) return reply.code(400).send({ message: 'filename is required.' });
    if (!body.dataBase64) return reply.code(400).send({ message: 'dataBase64 is required.' });

    const prisma = getPrismaClient();
    const report = await prisma.report.findUnique({ where: { id } });
    if (!report) return reply.code(404).send({ message: `Report not found: ${id}` });

    try {
      const buffer = Buffer.from(body.dataBase64, 'base64');
      const template = await buildSpreadsheetTemplateFromUpload({
        reportId: report.id,
        existingTemplate: parseTemplate(report.templateJson),
        filename: fileName,
        buffer,
        kind,
      });
      const updated = await prisma.report.update({
        where: { id: report.id },
        data: { templateJson: JSON.stringify(template) },
      });
      const preview = await resolveSpreadsheetPreview(updated);
      appendEngineLog('info', 'Spreadsheet report template imported', { reportId: updated.id, name: updated.name, filename: fileName, kind });
      return { report: toRuntime(updated), preview };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      appendEngineLog('error', 'Spreadsheet report import failed', { reportId: id, message, filename: fileName });
      return reply.code(400).send({ message });
    }
  });

  app.post('/api/reports/:id/resolve-spreadsheet-preview', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as SpreadsheetPreviewInput;
    const prisma = getPrismaClient();
    const report = await prisma.report.findUnique({ where: { id } });
    if (!report) return reply.code(404).send({ message: `Report not found: ${id}` });

    try {
      const preview = await resolveSpreadsheetPreview(report, body);
      return { preview };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      appendEngineLog('error', 'Spreadsheet preview resolve failed', { reportId: id, message });
      return reply.code(400).send({ message });
    }
  });

  app.get('/api/reports/generated', async () => {
    return {
      files: listGeneratedReportFiles(),
      runtimeSource: 'not_present',
      generatedData: false
    };
  });

  app.get('/api/reports/files/:fileName', async (request, reply) => {
    const { fileName } = request.params as { fileName: string };
    const resolved = resolveGeneratedReportFile(fileName);
    if (!resolved) {
      reply.code(404);
      return { message: `Generated report file not found: ${fileName}` };
    }
    const contentType = resolved.fileName.endsWith('.xlsx')
      ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      : 'application/pdf';
    reply.header('Content-Type', contentType);
    reply.header('Content-Disposition', `attachment; filename="${resolved.fileName}"`);
    return reply.send(fs.createReadStream(resolved.filePath));
  });

  app.get('/api/reports/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const prisma = getPrismaClient();
    const report = await prisma.report.findUnique({ where: { id } });
    if (!report) {
      reply.code(404);
      return { message: `Report not found: ${id}` };
    }
    appendEngineLog('info', 'Report runtime template requested', { reportId: report.id, name: report.name });
    return {
      report: toRuntime(report),
      runtime: {
        generation: 'available',
        historicalValues: 'uses_real_history_values_only',
        runtimeSource: 'not_present',
        note: 'Phase 13 can generate PDF or Excel files from real HistoryValue and Alarm records only. No generated report data is used.'
      }
    };
  });
}
