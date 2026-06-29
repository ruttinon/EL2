import fs from 'node:fs';
import path from 'node:path';
import {
  getBackupsDir,
  getConfigDir,
  getDataDir,
  getGraphicsDir,
  getImagesDir,
  getLogsDir,
  getProgramDataRoot,
  getReportsDir
} from '@energylink/shared-data';
import { appendEngineLog } from './engineLogger.js';
import { disconnectPrismaClient } from './database.js';
import { stopRuntimePolling } from './runtimePollingService.js';

export type BackupManifest = {
  id: string;
  createdAt: string;
  programDataRoot: string;
  included: string[];
  files: Array<{ source: string; relativePath: string; sizeBytes: number }>;
  notes: string[];
};

function timestampId() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

function safeCopyFile(source: string, target: string, files: BackupManifest['files'], relativePath: string) {
  if (!fs.existsSync(source)) return;
  const stat = fs.statSync(source);
  if (!stat.isFile()) return;
  ensureDir(path.dirname(target));
  fs.copyFileSync(source, target);
  files.push({ source, relativePath, sizeBytes: stat.size });
}

function copyDirectory(sourceDir: string, targetDir: string, rootRelative: string, files: BackupManifest['files']) {
  if (!fs.existsSync(sourceDir)) return;
  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const sourcePath = path.join(sourceDir, entry.name);
    const relativePath = path.join(rootRelative, entry.name);
    const targetPath = path.join(targetDir, entry.name);
    if (entry.isDirectory()) copyDirectory(sourcePath, targetPath, relativePath, files);
    else if (entry.isFile()) safeCopyFile(sourcePath, targetPath, files, relativePath);
  }
}

export function createBackup() {
  ensureDir(getBackupsDir());
  const id = `backup-${timestampId()}`;
  const backupRoot = path.join(getBackupsDir(), id);
  ensureDir(backupRoot);

  const files: BackupManifest['files'] = [];
  const included = ['config', 'data', 'graphics', 'reports', 'images'];

  copyDirectory(getConfigDir(), path.join(backupRoot, 'config'), 'config', files);
  copyDirectory(getDataDir(), path.join(backupRoot, 'data'), 'data', files);
  copyDirectory(getGraphicsDir(), path.join(backupRoot, 'graphics'), 'graphics', files);
  copyDirectory(getReportsDir(), path.join(backupRoot, 'reports'), 'reports', files);
  copyDirectory(getImagesDir(), path.join(backupRoot, 'images'), 'images', files);

  const manifest: BackupManifest = {
    id,
    createdAt: new Date().toISOString(),
    programDataRoot: getProgramDataRoot(),
    included,
    files,
    notes: [
      'This backup contains real EnergyLink project/runtime files only.',
      'Database files are copied from ProgramData/data. For highest integrity, stop polling before backup in production.',
      'Logs are not included to keep backups smaller. Use the logs folder for diagnostics.'
    ]
  };

  fs.writeFileSync(path.join(backupRoot, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
  appendEngineLog('info', 'Backup created', { id, backupRoot, fileCount: files.length });
  return { id, backupRoot, manifest };
}

export function listBackups() {
  ensureDir(getBackupsDir());
  return fs.readdirSync(getBackupsDir(), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const backupRoot = path.join(getBackupsDir(), entry.name);
      const manifestPath = path.join(backupRoot, 'manifest.json');
      let manifest: BackupManifest | null = null;
      if (fs.existsSync(manifestPath)) {
        try {
          manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as BackupManifest;
        } catch {
          manifest = null;
        }
      }
      return {
        id: entry.name,
        backupRoot,
        createdAt: manifest?.createdAt ?? null,
        fileCount: manifest?.files.length ?? null,
        manifestValid: Boolean(manifest)
      };
    })
    .sort((a, b) => String(b.createdAt ?? b.id).localeCompare(String(a.createdAt ?? a.id)));
}

export function getBackupManifest(id: string) {
  const backupRoot = path.join(getBackupsDir(), id);
  const manifestPath = path.join(backupRoot, 'manifest.json');
  if (!fs.existsSync(manifestPath)) return null;
  return JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as BackupManifest;
}

export function deleteBackup(id: string) {
  const backupRoot = path.join(getBackupsDir(), id);
  if (!backupRoot.startsWith(getBackupsDir())) throw new Error('Invalid backup path');
  if (!fs.existsSync(backupRoot)) return false;
  fs.rmSync(backupRoot, { recursive: true, force: true });
  appendEngineLog('info', 'Backup deleted', { id });
  return true;
}


export type RestorePreview = {
  id: string;
  backupRoot: string;
  manifest: BackupManifest;
  restoreTargets: Array<{ name: string; targetDir: string; sourceDir: string; existsInBackup: boolean }>;
  fileCount: number;
  requiresConfirmation: string;
  warnings: string[];
};

function assertSafeBackupId(id: string) {
  if (!/^backup-[0-9T\-Z]+$/.test(id)) throw new Error('Invalid backup id');
  return id;
}

function assertInside(parent: string, child: string) {
  const relative = path.relative(parent, child);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Invalid path traversal');
}

function copyDirectoryReplace(sourceDir: string, targetDir: string) {
  if (!fs.existsSync(sourceDir)) {
    fs.rmSync(targetDir, { recursive: true, force: true });
    ensureDir(targetDir);
    return;
  }
  assertInside(getProgramDataRoot(), targetDir);
  fs.rmSync(targetDir, { recursive: true, force: true });
  ensureDir(targetDir);
  copyDirectory(sourceDir, targetDir, path.basename(targetDir), []);
}

export function previewRestore(id: string): RestorePreview {
  const safeId = assertSafeBackupId(id);
  const backupRoot = path.join(getBackupsDir(), safeId);
  assertInside(getBackupsDir(), backupRoot);
  const manifest = getBackupManifest(safeId);
  if (!manifest) throw new Error('Backup not found or manifest is invalid');

  const restoreTargets = [
    { name: 'config', targetDir: getConfigDir(), sourceDir: path.join(backupRoot, 'config'), existsInBackup: fs.existsSync(path.join(backupRoot, 'config')) },
    { name: 'data', targetDir: getDataDir(), sourceDir: path.join(backupRoot, 'data'), existsInBackup: fs.existsSync(path.join(backupRoot, 'data')) },
    { name: 'graphics', targetDir: getGraphicsDir(), sourceDir: path.join(backupRoot, 'graphics'), existsInBackup: fs.existsSync(path.join(backupRoot, 'graphics')) },
    { name: 'reports', targetDir: getReportsDir(), sourceDir: path.join(backupRoot, 'reports'), existsInBackup: fs.existsSync(path.join(backupRoot, 'reports')) },
    { name: 'images', targetDir: getImagesDir(), sourceDir: path.join(backupRoot, 'images'), existsInBackup: fs.existsSync(path.join(backupRoot, 'images')) }
  ];

  return {
    id: safeId,
    backupRoot,
    manifest,
    restoreTargets,
    fileCount: manifest.files.length,
    requiresConfirmation: `RESTORE ${safeId}`,
    warnings: [
      'Restore replaces config, data, graphics, reports and images from the selected backup.',
      'Runtime polling is stopped before restore.',
      'A pre-restore backup is created automatically before files are replaced.',
      'Logs and backup folders are not overwritten by restore.'
    ]
  };
}

export async function restoreBackup(id: string, confirmation: string) {
  const preview = previewRestore(id);
  if (confirmation !== preview.requiresConfirmation) {
    throw new Error(`Restore confirmation must exactly equal: ${preview.requiresConfirmation}`);
  }

  appendEngineLog('warn', 'Restore requested', { id: preview.id, fileCount: preview.fileCount });
  stopRuntimePolling('restore_requested');
  await disconnectPrismaClient();

  const preRestoreBackup = createBackup();

  for (const target of preview.restoreTargets) {
    copyDirectoryReplace(target.sourceDir, target.targetDir);
  }

  appendEngineLog('warn', 'Restore completed', {
    id: preview.id,
    preRestoreBackupId: preRestoreBackup.id,
    restoredFolders: preview.restoreTargets.map((target) => target.name)
  });

  return {
    restored: true,
    id: preview.id,
    preRestoreBackupId: preRestoreBackup.id,
    restoredFolders: preview.restoreTargets.map((target) => target.name),
    message: 'Restore completed. Restart the EnergyLink Engine service before returning to production use.'
  };
}

export function getBackupFolders() {
  return {
    backupsDir: getBackupsDir(),
    configDir: getConfigDir(),
    dataDir: getDataDir(),
    logsDir: getLogsDir(),
    graphicsDir: getGraphicsDir(),
    reportsDir: getReportsDir(),
    imagesDir: getImagesDir()
  };
}
