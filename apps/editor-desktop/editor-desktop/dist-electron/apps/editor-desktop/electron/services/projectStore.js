import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { getConfigDir, getDataDir, getDatabasePath, getDatabaseUrl, getGraphicsDir, getImagesDir, getLogsDir, getProgramDataRoot, getReportsDir, getDriversDir } from '@energylink/shared-data';
let prisma = null;
function ensureProgramDataFolders() {
    const dirs = [getProgramDataRoot(), getConfigDir(), getDataDir(), getLogsDir(), getGraphicsDir(), getReportsDir(), getImagesDir(), getDriversDir()];
    for (const dir of dirs)
        fs.mkdirSync(dir, { recursive: true });
    const engineConfig = path.join(getConfigDir(), 'engine.json');
    if (!fs.existsSync(engineConfig)) {
        fs.writeFileSync(engineConfig, JSON.stringify({
            engineName: 'EnergyLink Local Engine',
            apiPort: 8081,
            pollingIntervalMs: 1000,
            databasePath: getDatabasePath(),
            dataPath: getDataDir(),
            logsPath: getLogsDir(),
            graphicsPath: getGraphicsDir(),
            reportsPath: getReportsDir(),
            imagesPath: getImagesDir(),
            driversFolder: getDriversDir(),
            autoStart: true
        }, null, 2));
    }
}
function getClient() {
    ensureProgramDataFolders();
    process.env.DATABASE_URL = getDatabaseUrl();
    prisma ??= new PrismaClient();
    return prisma;
}
function toSummary(project) {
    return {
        id: project.id,
        name: project.name,
        customerName: project.customerName,
        location: project.location,
        timezone: project.timezone,
        currency: project.currency,
        energyCostRate: project.energyCostRate,
        facilityType: project.facilityType ?? 'mixed',
        emissionFactorKgPerKwh: project.emissionFactorKgPerKwh ?? 0.45,
        netMetering: Boolean(project.netMetering),
        floorAreaM2: project.floorAreaM2 ?? null,
        status: project.status,
        createdAt: project.createdAt instanceof Date ? project.createdAt.toISOString() : String(project.createdAt),
        updatedAt: project.updatedAt instanceof Date ? project.updatedAt.toISOString() : String(project.updatedAt)
    };
}
export async function listProjects() {
    const client = getClient();
    const projects = await client.project.findMany({ orderBy: { updatedAt: 'desc' } });
    return projects.map(toSummary);
}
export async function createProject(input) {
    const client = getClient();
    const project = await client.project.create({
        data: {
            name: input.name.trim(),
            customerName: input.customerName?.trim() || null,
            location: input.location?.trim() || null,
            timezone: input.timezone || 'Asia/Bangkok',
            currency: input.currency || 'THB',
            energyCostRate: Number(input.energyCostRate ?? 0),
            facilityType: input.facilityType?.trim() || 'mixed',
            emissionFactorKgPerKwh: Number(input.emissionFactorKgPerKwh ?? 0.45),
            netMetering: Boolean(input.netMetering),
            floorAreaM2: input.floorAreaM2 === null || input.floorAreaM2 === undefined || input.floorAreaM2 === ''
                ? null
                : Number(input.floorAreaM2),
            status: 'draft',
            settings: {
                create: [
                    { key: 'createdBy', value: 'EnergyLink Editor' },
                    { key: 'phase', value: 'Phase 2 - Project + SQLite + Prisma' }
                ]
            }
        }
    });
    await client.appSetting.upsert({ where: { key: 'activeProjectId' }, update: { value: project.id }, create: { key: 'activeProjectId', value: project.id } });
    return toSummary(project);
}
export async function updateProject(input) {
    const client = getClient();
    const { id, ...rest } = input;
    const project = await client.project.update({ where: { id }, data: rest });
    return toSummary(project);
}
export async function deleteProject(id) {
    const client = getClient();
    await client.project.delete({ where: { id } });
    const active = await client.appSetting.findUnique({ where: { key: 'activeProjectId' } });
    if (active?.value === id) {
        await client.appSetting.upsert({ where: { key: 'activeProjectId' }, update: { value: '' }, create: { key: 'activeProjectId', value: '' } });
    }
    return true;
}
export async function setActiveProject(id) {
    const client = getClient();
    const project = await client.project.findUniqueOrThrow({ where: { id } });
    await client.appSetting.upsert({ where: { key: 'activeProjectId' }, update: { value: id }, create: { key: 'activeProjectId', value: id } });
    return toSummary(project);
}
export async function getProjectDatabaseStatus() {
    const client = getClient();
    const [projectCount, active] = await Promise.all([
        client.project.count(),
        client.appSetting.findUnique({ where: { key: 'activeProjectId' } })
    ]);
    return {
        databasePath: getDatabasePath(),
        connected: true,
        activeProjectId: active?.value || undefined,
        projectCount
    };
}
export async function disconnectProjectStore() {
    if (prisma)
        await prisma.$disconnect();
    prisma = null;
}
