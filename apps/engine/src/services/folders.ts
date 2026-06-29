import fs from 'node:fs';
import path from 'node:path';
import {
  getConfigDir,
  getDataDir,
  getGraphicsDir,
  getImagesDir,
  getDriversDir,
  getBackupsDir,
  getLogsDir,
  getProgramDataRoot,
  getReportsDir,
  getDatabasePath,
  readEngineConfig,
  writeEngineConfig,
  createDefaultEngineConfig
} from '@energylink/shared-data';

export function ensureRuntimeFolders() {
  const dirs = [
    getProgramDataRoot(),
    getConfigDir(),
    getDataDir(),
    getLogsDir(),
    getGraphicsDir(),
    getReportsDir(),
    getImagesDir(),
    getDriversDir(),
    getBackupsDir()
  ];

  for (const dir of dirs) fs.mkdirSync(dir, { recursive: true });

  const config = readEngineConfig();
  writeEngineConfig({ ...createDefaultEngineConfig(), ...config });

  const logPath = path.join(getLogsDir(), 'engine.log');
  if (!fs.existsSync(logPath)) fs.writeFileSync(logPath, '', 'utf8');

  return {
    programDataRoot: getProgramDataRoot(),
    configDir: getConfigDir(),
    dataDir: getDataDir(),
    logsDir: getLogsDir(),
    graphicsDir: getGraphicsDir(),
    reportsDir: getReportsDir(),
    imagesDir: getImagesDir(),
    driversDir: getDriversDir(),
    backupsDir: getBackupsDir(),
    databasePath: getDatabasePath(),
    logPath
  };
}
