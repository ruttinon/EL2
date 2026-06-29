import type { FastifyInstance } from 'fastify';
import { getMaintenancePreview, listMaintenanceRuns, runMaintenance } from '../services/maintenanceService.js';

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export async function registerMaintenanceRoutes(app: FastifyInstance) {
  app.get('/api/maintenance/preview', async (_request, reply) => {
    try {
      return await getMaintenancePreview();
    } catch (error) {
      reply.code(400);
      return { error: errorMessage(error) };
    }
  });

  app.get('/api/maintenance/runs', async (request, reply) => {
    try {
      const query = request.query as { limit?: string };
      return { runs: await listMaintenanceRuns(Number(query.limit ?? 100)) };
    } catch (error) {
      reply.code(400);
      return { error: errorMessage(error) };
    }
  });

  app.post('/api/maintenance/run', async (request, reply) => {
    try {
      const body = (request.body ?? {}) as { jobs?: string[] };
      return await runMaintenance({ jobs: body.jobs, requestedBy: 'local-system' });
    } catch (error) {
      reply.code(400);
      return { error: errorMessage(error) };
    }
  });
}
