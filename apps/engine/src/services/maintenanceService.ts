import fs from 'node:fs/promises';
import path from 'node:path';
import { readEngineConfig, getLogsDir, getBackupsDir } from '@energylink/shared-data';
import { getPrismaClient } from './database.js';
import { appendEngineLog } from './engineLogger.js';
import { ensureRuntimeFolders } from './folders.js';

type JobType = 'history_retention' | 'log_retention' | 'backup_retention' | 'database_vacuum';

type PreviewItem = {
  jobType: JobType;
  retentionDays?: number;
  cutoff?: string;
  rows?: number;
  files?: number;
  folders?: number;
  note?: string;
};

const ALL_JOBS: JobType[] = ['history_retention', 'log_retention', 'backup_retention', 'database_vacuum'];

function cutoffDate(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - Math.max(1, Math.floor(days)));
  return d;
}

async function pathExists(target: string) {
  try { await fs.access(target); return true; } catch { return false; }
}

async function listFilesOlderThan(dir: string, cutoff: Date, options: { skipNames?: string[] } = {}) {
  const out: Array<{ path: string; name: string; mtime: Date; size: number }> = [];
  if (!(await pathExists(dir))) return out;
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (options.skipNames?.includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    const stat = await fs.stat(full);
    if (stat.mtime < cutoff) out.push({ path: full, name: entry.name, mtime: stat.mtime, size: stat.size });
  }
  return out;
}

async function listBackupFoldersOlderThan(dir: string, cutoff: Date) {
  const out: Array<{ path: string; name: string; createdAt: Date | null }> = [];
  if (!(await pathExists(dir))) return out;
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const full = path.join(dir, entry.name);
    let createdAt: Date | null = null;
    const manifestPath = path.join(full, 'manifest.json');
    try {
      const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8')) as { createdAt?: string };
      if (manifest.createdAt) createdAt = new Date(manifest.createdAt);
    } catch {}
    if (!createdAt || Number.isNaN(createdAt.getTime())) createdAt = (await fs.stat(full)).mtime;
    if (createdAt < cutoff) out.push({ path: full, name: entry.name, createdAt });
  }
  return out;
}

export async function getMaintenancePreview() {
  ensureRuntimeFolders();
  const config = readEngineConfig();
  const prisma = getPrismaClient();
  const historyCutoff = cutoffDate(config.historyRetentionDays);
  const logCutoff = cutoffDate(config.logRetentionDays);
  const backupCutoff = cutoffDate(config.backupRetentionDays);
  const rawHistoryCount = await prisma.$queryRawUnsafe<Array<{ count: bigint | number }>>(
    'SELECT COUNT(*) as count FROM "HistoryValue" WHERE "readAt" < ?',
    historyCutoff.getTime()
  );
  const oldHistoryRows = Number(rawHistoryCount[0]?.count ?? 0);
  const oldLogs = await listFilesOlderThan(config.logFolder || getLogsDir(), logCutoff, { skipNames: ['engine.log'] });
  const oldBackups = await listBackupFoldersOlderThan(getBackupsDir(), backupCutoff);
  const latestRuns = await prisma.maintenanceRun.findMany({ orderBy: { startedAt: 'desc' }, take: 20 });
  const items: PreviewItem[] = [
    { jobType: 'history_retention', retentionDays: config.historyRetentionDays, cutoff: historyCutoff.toISOString(), rows: oldHistoryRows },
    { jobType: 'log_retention', retentionDays: config.logRetentionDays, cutoff: logCutoff.toISOString(), files: oldLogs.length, note: 'engine.log is retained; rotated or archived log files are eligible.' },
    { jobType: 'backup_retention', retentionDays: config.backupRetentionDays, cutoff: backupCutoff.toISOString(), folders: oldBackups.length },
    { jobType: 'database_vacuum', note: 'Runs SQLite VACUUM after retention cleanup when requested.' }
  ];
  return { config, items, latestRuns: latestRuns.map(toRunDto) };
}

function normalizeJobs(input?: unknown): JobType[] {
  if (!Array.isArray(input) || input.length === 0) return ALL_JOBS;
  const requested = input.map(String).filter((x): x is JobType => ALL_JOBS.includes(x as JobType));
  return requested.length ? requested : ALL_JOBS;
}

function toRunDto(run: any) {
  return {
    ...run,
    startedAt: run.startedAt?.toISOString?.() ?? run.startedAt,
    finishedAt: run.finishedAt ? run.finishedAt.toISOString() : null,
    details: safeJson(run.detailsJson)
  };
}

function safeJson(value: string) {
  try { return JSON.parse(value); } catch { return {}; }
}

async function runRecordedJob(jobType: JobType, action: () => Promise<{ deletedRows?: number; deletedFiles?: number; details?: Record<string, unknown> }>) {
  const prisma = getPrismaClient();
  const run = await prisma.maintenanceRun.create({ data: { jobType, status: 'running' } });
  try {
    const result = await action();
    const updated = await prisma.maintenanceRun.update({
      where: { id: run.id },
      data: {
        status: 'success',
        finishedAt: new Date(),
        deletedRows: result.deletedRows ?? 0,
        deletedFiles: result.deletedFiles ?? 0,
        detailsJson: JSON.stringify(result.details ?? {})
      }
    });
    appendEngineLog('info', 'Maintenance job completed', { jobType, runId: run.id, deletedRows: updated.deletedRows, deletedFiles: updated.deletedFiles });
    return toRunDto(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const updated = await prisma.maintenanceRun.update({ where: { id: run.id }, data: { status: 'failed', finishedAt: new Date(), error: message } });
    appendEngineLog('error', 'Maintenance job failed', { jobType, runId: run.id, message });
    return toRunDto(updated);
  }
}

export async function runMaintenance(input: { jobs?: unknown; requestedBy?: string }) {
  ensureRuntimeFolders();
  const config = readEngineConfig();
  const prisma = getPrismaClient();
  const jobs = normalizeJobs(input.jobs);
  const results = [];
  appendEngineLog('info', 'Maintenance run requested', { jobs, requestedBy: input.requestedBy ?? 'unknown' });

  if (jobs.includes('history_retention')) {
    const cutoff = cutoffDate(config.historyRetentionDays);
    results.push(await runRecordedJob('history_retention', async () => {
      const deletedRows = await prisma.$executeRawUnsafe(
        'DELETE FROM "HistoryValue" WHERE "readAt" < ?',
        cutoff.getTime()
      );
      return { deletedRows, details: { cutoff: cutoff.toISOString(), retentionDays: config.historyRetentionDays } };
    }));
  }

  if (jobs.includes('log_retention')) {
    const cutoff = cutoffDate(config.logRetentionDays);
    results.push(await runRecordedJob('log_retention', async () => {
      const files = await listFilesOlderThan(config.logFolder || getLogsDir(), cutoff, { skipNames: ['engine.log'] });
      let deletedFiles = 0;
      const deletedNames: string[] = [];
      for (const file of files) {
        await fs.unlink(file.path);
        deletedFiles += 1;
        deletedNames.push(file.name);
      }
      return { deletedFiles, details: { cutoff: cutoff.toISOString(), retentionDays: config.logRetentionDays, deletedNames } };
    }));
  }

  if (jobs.includes('backup_retention')) {
    const cutoff = cutoffDate(config.backupRetentionDays);
    results.push(await runRecordedJob('backup_retention', async () => {
      const backups = await listBackupFoldersOlderThan(getBackupsDir(), cutoff);
      let deletedFiles = 0;
      const deletedNames: string[] = [];
      for (const backup of backups) {
        await fs.rm(backup.path, { recursive: true, force: true });
        deletedFiles += 1;
        deletedNames.push(backup.name);
      }
      return { deletedFiles, details: { cutoff: cutoff.toISOString(), retentionDays: config.backupRetentionDays, deletedNames } };
    }));
  }

  if (jobs.includes('database_vacuum')) {
    results.push(await runRecordedJob('database_vacuum', async () => {
      await prisma.$executeRawUnsafe('VACUUM');
      return { details: { command: 'VACUUM' } };
    }));
  }

  return { jobs, results };
}

export async function listMaintenanceRuns(limit = 100) {
  const prisma = getPrismaClient();
  const runs = await prisma.maintenanceRun.findMany({ orderBy: { startedAt: 'desc' }, take: Math.max(1, Math.min(300, limit)) });
  return runs.map(toRunDto);
}
