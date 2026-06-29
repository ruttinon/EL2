import os from 'node:os';
import path from 'node:path';

export const APP_NAME = 'EnergyLink Management';

export function getProgramDataRoot(): string {
    if (process.env.ENERGYLINK_PROGRAM_DATA)
        return process.env.ENERGYLINK_PROGRAM_DATA;
    if (process.env.ENERGYLINK_PROGRAMDATA)
        return process.env.ENERGYLINK_PROGRAMDATA;
    if (process.platform === 'win32') {
        return path.join(process.env.ProgramData ?? 'C:\\ProgramData', APP_NAME);
    }
    return path.join(os.homedir(), '.energylink-management');
}

export function getConfigDir(): string { return path.join(getProgramDataRoot(), 'config'); }
export function getDataDir(): string { return path.join(getProgramDataRoot(), 'data'); }
export function getLogsDir(): string { return path.join(getProgramDataRoot(), 'logs'); }
export function getGraphicsDir(): string { return path.join(getProgramDataRoot(), 'graphics'); }
export function getReportsDir(): string { return path.join(getProgramDataRoot(), 'reports'); }
export function getImagesDir(): string { return path.join(getProgramDataRoot(), 'images'); }
export function getDriversDir(): string { return path.join(getProgramDataRoot(), 'drivers'); }
export function getBackupsDir(): string { return path.join(getProgramDataRoot(), 'backups'); }
export function getTemplatesDir(): string { return path.join(getProgramDataRoot(), 'templates'); }
export function getLibraryTemplatesDir(): string { return path.join(getTemplatesDir(), 'library'); }
export function getUserTemplatesDir(): string { return path.join(getTemplatesDir(), 'user'); }
export function getDatabasePath(): string { return path.join(getDataDir(), 'energylink.db'); }
export function getDatabaseUrl(): string { return `file:${getDatabasePath().replace(/\\/g, '/')}`; }
