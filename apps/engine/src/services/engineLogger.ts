import fs from 'node:fs';
import path from 'node:path';
import { getLogsDir } from '@energylink/shared-data';

export type EngineLogLevel = 'debug' | 'info' | 'warn' | 'error';

export function getEngineLogPath() {
  return path.join(getLogsDir(), 'engine.log');
}

export function appendEngineLog(level: EngineLogLevel, message: string, metadata?: Record<string, unknown>) {
  fs.mkdirSync(getLogsDir(), { recursive: true });
  const line = JSON.stringify({
    time: new Date().toISOString(),
    level,
    message,
    metadata: metadata ?? null
  });
  fs.appendFileSync(getEngineLogPath(), line + '\n', 'utf8');
}

export function readRecentEngineLogs(maxLines = 200) {
  const logPath = getEngineLogPath();
  if (!fs.existsSync(logPath)) return [];
  const lines = fs.readFileSync(logPath, 'utf8').split(/\r?\n/).filter(Boolean);
  return lines.slice(-Math.max(1, Math.min(maxLines, 1000))).map((line) => {
    try {
      return JSON.parse(line);
    } catch {
      return { raw: line };
    }
  });
}
