import { PrismaClient } from '@prisma/client';
import type { CreateReportInput, ReportDatabaseStatus, ReportObjectDefinition, ReportPageDefinition, ReportSummary, ReportTemplate, UpdateReportInput } from '@energylink/shared-types';
import { getDatabaseUrl } from '@energylink/shared-data';

let prisma: PrismaClient | null = null;

const defaultPage = (): ReportPageDefinition => ({
  id: 'page_1',
  name: 'Page 1',
  width: 1123,
  height: 794,
  backgroundColor: '#ffffff',
  objects: []
});

const emptyTemplate = (): ReportTemplate => ({ version: 1, pages: [defaultPage()] });

function getClient() {
  process.env.DATABASE_URL = getDatabaseUrl();
  prisma ??= new PrismaClient();
  return prisma;
}

function normalizeObject(obj: ReportObjectDefinition, index: number): ReportObjectDefinition {
  return {
    ...obj,
    id: obj.id || `report_object_${index + 1}`,
    name: obj.name || `${obj.type || 'object'}_${index + 1}`,
    x: Math.round(Number(obj.x) || 40),
    y: Math.round(Number(obj.y) || 40),
    width: Math.max(1, Math.round(Number(obj.width) || 120)),
    height: Math.max(1, Math.round(Number(obj.height) || 40)),
    visible: obj.visible ?? true,
    locked: obj.locked ?? false,
    layer: obj.layer ?? index
  };
}

function parseTemplate(templateJson: string | null | undefined): ReportTemplate {
  if (!templateJson) return emptyTemplate();
  try {
    const parsed = JSON.parse(templateJson) as ReportTemplate;
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.pages)) return emptyTemplate();
    return {
      version: 1,
      pages: parsed.pages.map((page, pageIndex) => ({
        id: page.id || `page_${pageIndex + 1}`,
        name: page.name || `Page ${pageIndex + 1}`,
        width: Math.max(320, Math.round(Number(page.width) || 1123)),
        height: Math.max(240, Math.round(Number(page.height) || 794)),
        backgroundColor: page.backgroundColor || '#ffffff',
        objects: Array.isArray(page.objects) ? page.objects.map(normalizeObject) : []
      }))
    };
  } catch {
    return emptyTemplate();
  }
}

function serializeTemplate(template?: ReportTemplate): string {
  const cleanTemplate = template || emptyTemplate();
  if (cleanTemplate.version !== 1) throw new Error('Report template version must be 1');
  if (!Array.isArray(cleanTemplate.pages) || cleanTemplate.pages.length === 0) throw new Error('Report template must have at least one page');
  return JSON.stringify({
    version: 1,
    pages: cleanTemplate.pages.map((page, pageIndex) => ({
      id: page.id || `page_${pageIndex + 1}`,
      name: page.name || `Page ${pageIndex + 1}`,
      width: Math.max(320, Math.round(Number(page.width) || 1123)),
      height: Math.max(240, Math.round(Number(page.height) || 794)),
      backgroundColor: page.backgroundColor || '#ffffff',
      objects: Array.isArray(page.objects) ? page.objects.map(normalizeObject) : []
    }))
  });
}

function toReportSummary(report: any): ReportSummary {
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
    isDefault: Boolean(report.isDefault),
    template: parseTemplate(report.templateJson),
    createdAt: report.createdAt instanceof Date ? report.createdAt.toISOString() : String(report.createdAt),
    updatedAt: report.updatedAt instanceof Date ? report.updatedAt.toISOString() : String(report.updatedAt)
  };
}

async function getActiveProjectId(projectId?: string): Promise<string> {
  if (projectId) return projectId;
  const client = getClient();
  const active = await client.appSetting.findUnique({ where: { key: 'activeProjectId' } });
  if (active?.value) return active.value;
  const project = await client.project.findFirst({ orderBy: { updatedAt: 'desc' } });
  if (!project) throw new Error('No active project. Create or open a project from the File menu first.');
  await client.appSetting.upsert({ where: { key: 'activeProjectId' }, update: { value: project.id }, create: { key: 'activeProjectId', value: project.id } });
  return project.id;
}

function assertReportInput(input: CreateReportInput) {
  if (!input.name?.trim()) throw new Error('Report Name is required.');
}

async function clearOtherDefaults(projectId: string) {
  const client = getClient();
  await client.report.updateMany({ where: { projectId }, data: { isDefault: false } });
}

export async function listReports(projectId?: string): Promise<ReportSummary[]> {
  const client = getClient();
  const activeProjectId = await getActiveProjectId(projectId);
  const reports = await client.report.findMany({ where: { projectId: activeProjectId }, orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }] });
  return reports.map(toReportSummary);
}

export async function getReport(id: string): Promise<ReportSummary | null> {
  const client = getClient();
  const report = await client.report.findUnique({ where: { id } });
  return report ? toReportSummary(report) : null;
}

export async function createReport(input: CreateReportInput): Promise<ReportSummary> {
  assertReportInput(input);
  const client = getClient();
  const activeProjectId = await getActiveProjectId(input.projectId);
  if (input.isDefault) await clearOtherDefaults(activeProjectId);
  const report = await client.report.create({
    data: {
      projectId: activeProjectId,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      reportType: input.reportType || 'daily_energy',
      paperSize: input.paperSize || 'A4',
      orientation: input.orientation || 'landscape',
      defaultDateRange: input.defaultDateRange || 'this_month',
      outputFormat: input.outputFormat || 'pdf',
      isDefault: input.isDefault ?? false,
      templateJson: serializeTemplate(input.template || emptyTemplate())
    }
  });
  return toReportSummary(report);
}

export async function updateReport(input: UpdateReportInput): Promise<ReportSummary> {
  const client = getClient();
  const existing = await client.report.findUnique({ where: { id: input.id } });
  if (!existing) throw new Error('The report to edit was not found.');
  const data: any = {};
  if (input.name !== undefined) {
    if (!input.name.trim()) throw new Error('Report Name is required.');
    data.name = input.name.trim();
  }
  if (input.description !== undefined) data.description = input.description?.trim() || null;
  if (input.reportType !== undefined) data.reportType = input.reportType;
  if (input.paperSize !== undefined) data.paperSize = input.paperSize;
  if (input.orientation !== undefined) data.orientation = input.orientation;
  if (input.defaultDateRange !== undefined) data.defaultDateRange = input.defaultDateRange;
  if (input.outputFormat !== undefined) data.outputFormat = input.outputFormat;
  if (input.template !== undefined) data.templateJson = serializeTemplate(input.template);
  if (input.isDefault !== undefined) {
    data.isDefault = input.isDefault;
    if (input.isDefault) await clearOtherDefaults(existing.projectId);
  }
  const report = await client.report.update({ where: { id: input.id }, data });
  return toReportSummary(report);
}

export async function deleteReport(id: string): Promise<boolean> {
  const client = getClient();
  await client.report.delete({ where: { id } });
  return true;
}

export async function getReportDatabaseStatus(projectId?: string): Promise<ReportDatabaseStatus> {
  const client = getClient();
  const activeProjectId = await getActiveProjectId(projectId);
  const reports = await client.report.findMany({ where: { projectId: activeProjectId } });
  const defaultReport = reports.find((r: any) => r.isDefault);
  const objectCount = reports.reduce((sum: number, report: any) => {
    const template = parseTemplate(report.templateJson);
    return sum + template.pages.reduce((pageSum, page) => pageSum + page.objects.length, 0);
  }, 0);
  return { activeProjectId, reportCount: reports.length, objectCount, defaultReportId: defaultReport?.id || null };
}

export async function disconnectReportStore() {
  if (prisma) await prisma.$disconnect();
  prisma = null;
}
