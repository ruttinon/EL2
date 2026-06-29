import type { FastifyInstance } from 'fastify';
import {
  getEngineConfigPath,
  readEngineConfig,
  validateEngineConfig,
  writeEngineConfig,
  normalizeEngineConfig,
  type EngineConfig
} from '@energylink/shared-data';
import { appendEngineLog } from '../services/engineLogger.js';
import { ensureRuntimeFolders } from '../services/folders.js';

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function changesBetween(current: Record<string, unknown>, next: Record<string, unknown>) {
  return Object.keys(next).filter((key) => JSON.stringify(current[key]) !== JSON.stringify(next[key]));
}

function restartRequiredFor(changedKeys: string[]) {
  const restartKeys = new Set(['apiHost', 'port', 'databasePath', 'dataFolder', 'logFolder', 'graphicsFolder', 'reportsFolder', 'imagesFolder', 'logLevel', 'serviceMode']);
  return changedKeys.some((key) => restartKeys.has(key));
}

export async function registerSettingsRoutes(app: FastifyInstance) {
  app.get('/api/settings/runtime', async (request, reply) => {
    try {
      const config = readEngineConfig();
      return {
        config,
        validation: validateEngineConfig(config),
        configPath: getEngineConfigPath(),
        folders: ensureRuntimeFolders(),
        runtimeSource: 'not_present'
      };
    } catch (error) {
      reply.code(403);
      return { error: errorMessage(error) };
    }
  });

  app.post('/api/settings/runtime/validate', async (request, reply) => {
    try {
      const incoming = normalizeEngineConfig({ ...readEngineConfig(), ...(request.body as Record<string, unknown>) } as Partial<EngineConfig>);
      return { config: incoming, validation: validateEngineConfig(incoming), runtimeSource: 'not_present' };
    } catch (error) {
      reply.code(400);
      return { error: errorMessage(error) };
    }
  });

  app.put('/api/settings/runtime', async (request, reply) => {
    try {
      const current = readEngineConfig();
      const next = normalizeEngineConfig({ ...current, ...(request.body as Record<string, unknown>) } as Partial<EngineConfig>);
      const validation = validateEngineConfig(next);
      if (!validation.valid) return reply.code(400).send({ error: validation.errors.join(' '), validation });
      writeEngineConfig(next);
      const changedKeys = changesBetween(current as unknown as Record<string, unknown>, next as unknown as Record<string, unknown>);
      const restartRequired = restartRequiredFor(changedKeys);
      appendEngineLog('info', 'Runtime configuration updated', { actor: 'local-system', changedKeys, restartRequired });
      return {
        config: next,
        validation,
        changedKeys,
        restartRequired,
        message: restartRequired ? 'Settings saved. Engine service restart is required for some changes.' : 'Settings saved.',
        runtimeSource: 'not_present'
      };
    } catch (error) {
      reply.code(400);
      return { error: errorMessage(error) };
    }
  });
}
