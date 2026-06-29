import type { FastifyInstance } from 'fastify';
import fs from 'node:fs';
import { getDatabasePath, getEngineConfigPath, readEngineConfig, writeEngineConfig } from '@energylink/shared-data';
import { getEngineState } from '../services/engineState.js';
import { readRecentEngineLogs } from '../services/engineLogger.js';
import { ensureRuntimeFolders } from '../services/folders.js';

export async function registerStatusRoutes(app: FastifyInstance) {
  app.get('/api/status', async () => {
    const folders = ensureRuntimeFolders();
    return {
      app: 'EnergyLink Engine Service',
      ...getEngineState(),
      configPath: getEngineConfigPath(),
      databasePath: getDatabasePath(),
      databaseExists: fs.existsSync(getDatabasePath()),
      folders
    };
  });

  app.get('/api/health', async () => ({ ok: true, ...getEngineState() }));

  app.get('/api/time', async () => {
    const now = new Date();
    return { iso: now.toISOString(), unixMs: now.getTime() };
  });

  app.get('/api/engine/config', async () => readEngineConfig());

  app.put('/api/engine/config', async (request) => {
    const current = readEngineConfig();
    const incoming = request.body as Partial<ReturnType<typeof readEngineConfig>>;
    const next = { ...current, ...incoming };
    writeEngineConfig(next);
    return next;
  });

  app.get('/api/engine/folders', async () => ensureRuntimeFolders());

  app.get('/api/engine/logs', async (request) => {
    const query = request.query as { lines?: string };
    const lines = query.lines ? Number(query.lines) : 200;
    return { logs: readRecentEngineLogs(Number.isFinite(lines) ? lines : 200) };
  });
}
