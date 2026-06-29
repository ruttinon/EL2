import os from 'node:os';
import path from 'node:path';
export const APP_NAME = 'EnergyLink Management';
export function getProgramDataRoot() {
    if (process.env.ENERGYLINK_PROGRAM_DATA)
        return process.env.ENERGYLINK_PROGRAM_DATA;
    if (process.env.ENERGYLINK_PROGRAMDATA)
        return process.env.ENERGYLINK_PROGRAMDATA;
    if (process.platform === 'win32') {
        return path.join(process.env.ProgramData ?? 'C:\\ProgramData', APP_NAME);
    }
    return path.join(os.homedir(), '.energylink-management');
}
export function getConfigDir() { return path.join(getProgramDataRoot(), 'config'); }
export function getDataDir() { return path.join(getProgramDataRoot(), 'data'); }
export function getLogsDir() { return path.join(getProgramDataRoot(), 'logs'); }
export function getGraphicsDir() { return path.join(getProgramDataRoot(), 'graphics'); }
export function getReportsDir() { return path.join(getProgramDataRoot(), 'reports'); }
export function getImagesDir() { return path.join(getProgramDataRoot(), 'images'); }
export function getDriversDir() { return path.join(getProgramDataRoot(), 'drivers'); }
export function getBackupsDir() { return path.join(getProgramDataRoot(), 'backups'); }
export function getTemplatesDir() { return path.join(getProgramDataRoot(), 'templates'); }
export function getLibraryTemplatesDir() { return path.join(getTemplatesDir(), 'library'); }
export function getUserTemplatesDir() { return path.join(getTemplatesDir(), 'user'); }
export function getDatabasePath() { return path.join(getDataDir(), 'energylink.db'); }
export function getDatabaseUrl() { return `file:${getDatabasePath().replace(/\\/g, '/')}`; }
