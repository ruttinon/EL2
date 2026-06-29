import type { FastifyInstance } from 'fastify';
import { createBackup, deleteBackup, getBackupFolders, getBackupManifest, listBackups, previewRestore, restoreBackup } from '../services/backupService.js';

type RestoreBody = { confirmation?: string };

export async function registerBackupRoutes(app: FastifyInstance) {
  app.get('/api/backups', async () => ({ backups: listBackups(), folders: getBackupFolders() }));

  app.post('/api/backups', async (_request, reply) => {
    const result = createBackup();
    return reply.code(201).send(result);
  });

  app.get('/api/backups/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const manifest = getBackupManifest(id);
    if (!manifest) return reply.code(404).send({ error: 'Backup not found' });
    return { manifest };
  });

  app.get('/api/backups/:id/restore-preview', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      return previewRestore(id);
    } catch (error) {
      return reply.code(404).send({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post('/api/backups/:id/restore', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as RestoreBody | undefined;
      const result = await restoreBackup(id, body?.confirmation ?? '');
      return result;
    } catch (error) {
      return reply.code(400).send({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.delete('/api/backups/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const deleted = deleteBackup(id);
    return reply.code(deleted ? 200 : 404).send({ deleted });
  });
}
