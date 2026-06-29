import { PrismaClient } from '@prisma/client';
import { getDatabaseUrl } from '@energylink/shared-data';
let prisma = null;
function getClient() {
    process.env.DATABASE_URL = getDatabaseUrl();
    prisma ??= new PrismaClient();
    return prisma;
}
const defaultPage = () => ({
    id: 'page_1',
    name: 'Page 1',
    width: 1123,
    height: 794,
    backgroundColor: '#ffffff',
    objects: []
});
const defaultPages = () => [defaultPage()];
const emptyTemplate = () => ({ version: 1, pages: defaultPages() });
function isSpreadsheetTemplate(template) {
    return (template != null &&
        typeof template === 'object' &&
        (template.mode === 'spreadsheet' || Number(template.version ?? 1) >= 2));
}
function normalizeObject(obj, index) {
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
function parseTemplate(templateJson) {
    if (!templateJson)
        return emptyTemplate();
    try {
        const parsed = JSON.parse(templateJson);
        if (!parsed)
            return emptyTemplate();
        if (isSpreadsheetTemplate(parsed)) {
            const hasSheets = Array.isArray(parsed.spreadsheet?.snapshot?.sheets);
            const spreadsheetData = {
                snapshot: {
                    sheets: hasSheets ? parsed.spreadsheet.snapshot.sheets : [{
                            id: 'sheet_1',
                            name: 'Sheet1',
                            rowCount: 20,
                            colCount: 10,
                            usedRange: 'A1:J20',
                            columns: Array.from({ length: 10 }, (_, index) => ({ index: index + 1, width: 14 })),
                            merges: [],
                            cells: [],
                        }]
                },
                bindings: Array.isArray(parsed.spreadsheet?.bindings) ? parsed.spreadsheet.bindings : [],
                export: parsed.spreadsheet?.export || {
                    pdf: { sheetMode: 'all', fitToPage: true, showGridLines: false },
                    excel: { preserveFormulas: true }
                }
            };
            return {
                ...parsed,
                version: Math.max(2, Number(parsed.version ?? 2)),
                mode: 'spreadsheet',
                pages: Array.isArray(parsed.pages) && parsed.pages.length ? parsed.pages : defaultPages(),
                spreadsheet: spreadsheetData
            };
        }
        return {
            version: 1,
            pages: (Array.isArray(parsed.pages) ? parsed.pages : defaultPages()).map((page, pageIndex) => ({
                id: page.id || `page_${pageIndex + 1}`,
                name: page.name || `Page ${pageIndex + 1}`,
                width: Math.max(320, Math.round(Number(page.width) || 1123)),
                height: Math.max(240, Math.round(Number(page.height) || 794)),
                backgroundColor: page.backgroundColor || '#ffffff',
                objects: Array.isArray(page.objects) ? page.objects.map(normalizeObject) : []
            }))
        };
    }
    catch {
        return emptyTemplate();
    }
}
function serializeTemplate(template) {
    const cleanTemplate = template || emptyTemplate();
    if (isSpreadsheetTemplate(cleanTemplate)) {
        if (!cleanTemplate.spreadsheet?.snapshot?.sheets) {
            throw new Error('Spreadsheet report template must contain spreadsheet.snapshot.sheets');
        }
        return JSON.stringify({
            ...cleanTemplate,
            version: Math.max(2, Number(cleanTemplate.version ?? 2)),
            mode: 'spreadsheet',
            pages: Array.isArray(cleanTemplate.pages) && cleanTemplate.pages.length ? cleanTemplate.pages : defaultPages(),
        });
    }
    if (!Array.isArray(cleanTemplate.pages) || cleanTemplate.pages.length === 0) {
        return JSON.stringify({ ...emptyTemplate() });
    }
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
function toReportSummary(report) {
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
async function getActiveProjectId(projectId) {
    if (projectId)
        return projectId;
    const client = getClient();
    const active = await client.appSetting.findUnique({ where: { key: 'activeProjectId' } });
    if (active?.value)
        return active.value;
    const project = await client.project.findFirst({ orderBy: { updatedAt: 'desc' } });
    if (!project)
        throw new Error('No active project. Create or open a project from the File menu first.');
    await client.appSetting.upsert({ where: { key: 'activeProjectId' }, update: { value: project.id }, create: { key: 'activeProjectId', value: project.id } });
    return project.id;
}
function assertReportInput(input) {
    if (!input.name?.trim())
        throw new Error('Report Name is required.');
}
async function clearOtherDefaults(projectId) {
    const client = getClient();
    await client.report.updateMany({ where: { projectId }, data: { isDefault: false } });
}
export async function listReports(projectId) {
    const client = getClient();
    const activeProjectId = await getActiveProjectId(projectId);
    const reports = await client.report.findMany({ where: { projectId: activeProjectId }, orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }] });
    return reports.map(toReportSummary);
}
export async function getReport(id) {
    const client = getClient();
    const report = await client.report.findUnique({ where: { id } });
    return report ? toReportSummary(report) : null;
}
export async function createReport(input) {
    assertReportInput(input);
    const client = getClient();
    const activeProjectId = await getActiveProjectId(input.projectId);
    if (input.isDefault)
        await clearOtherDefaults(activeProjectId);
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
export async function updateReport(input) {
    const client = getClient();
    const existing = await client.report.findUnique({ where: { id: input.id } });
    if (!existing)
        throw new Error('The report to edit was not found.');
    const data = {};
    if (input.name !== undefined) {
        if (!input.name.trim())
            throw new Error('Report Name is required.');
        data.name = input.name.trim();
    }
    if (input.description !== undefined)
        data.description = input.description?.trim() || null;
    if (input.reportType !== undefined)
        data.reportType = input.reportType;
    if (input.paperSize !== undefined)
        data.paperSize = input.paperSize;
    if (input.orientation !== undefined)
        data.orientation = input.orientation;
    if (input.defaultDateRange !== undefined)
        data.defaultDateRange = input.defaultDateRange;
    if (input.outputFormat !== undefined)
        data.outputFormat = input.outputFormat;
    if (input.template !== undefined)
        data.templateJson = serializeTemplate(input.template);
    if (input.isDefault !== undefined) {
        data.isDefault = input.isDefault;
        if (input.isDefault)
            await clearOtherDefaults(existing.projectId);
    }
    const report = await client.report.update({ where: { id: input.id }, data });
    return toReportSummary(report);
}
export async function deleteReport(id) {
    const client = getClient();
    await client.report.delete({ where: { id } });
    return true;
}
export async function getReportDatabaseStatus(projectId) {
    const client = getClient();
    const activeProjectId = await getActiveProjectId(projectId);
    const reports = await client.report.findMany({ where: { projectId: activeProjectId } });
    const defaultReport = reports.find((r) => r.isDefault);
    const objectCount = reports.reduce((sum, report) => {
        const template = parseTemplate(report.templateJson);
        return sum + template.pages.reduce((pageSum, page) => pageSum + page.objects.length, 0);
    }, 0);
    return { activeProjectId, reportCount: reports.length, objectCount, defaultReportId: defaultReport?.id || null };
}
export async function disconnectReportStore() {
    if (prisma)
        await prisma.$disconnect();
    prisma = null;
}
