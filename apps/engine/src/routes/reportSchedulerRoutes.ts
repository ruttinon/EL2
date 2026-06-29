import type { FastifyInstance } from 'fastify';
import {
  createReportSchedule,
  deleteReportSchedule,
  listReportScheduleRuns,
  listReportSchedules,
  runReportScheduleNow,
  updateReportSchedule
} from '../services/reportSchedulerService.js';

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export async function registerReportSchedulerRoutes(app: FastifyInstance) {
  app.get('/api/report-schedules', async (request, reply) => {
    try {
      const query = request.query as { projectId?: string };
      return { schedules: await listReportSchedules(query.projectId) };
    } catch (error) {
      reply.code(400);
      return { message: errorMessage(error) };
    }
  });

  app.post('/api/report-schedules', async (request, reply) => {
    try {
      return { schedule: await createReportSchedule(request.body as any) };
    } catch (error) {
      reply.code(400);
      return { message: errorMessage(error) };
    }
  });

  app.put('/api/report-schedules/:id', async (request, reply) => {
    try {
      const params = request.params as { id: string };
      return { schedule: await updateReportSchedule(params.id, request.body as any) };
    } catch (error) {
      reply.code(400);
      return { message: errorMessage(error) };
    }
  });

  app.delete('/api/report-schedules/:id', async (request, reply) => {
    try {
      const params = request.params as { id: string };
      return { schedule: await deleteReportSchedule(params.id) };
    } catch (error) {
      reply.code(400);
      return { message: errorMessage(error) };
    }
  });

  app.post('/api/report-schedules/:id/run-now', async (request, reply) => {
    try {
      const params = request.params as { id: string };
      return { runs: await runReportScheduleNow(params.id, 'local-system') };
    } catch (error) {
      reply.code(400);
      return { message: errorMessage(error) };
    }
  });

  app.get('/api/report-schedule-runs', async (request, reply) => {
    try {
      const query = request.query as { projectId?: string; scheduleId?: string; limit?: string };
      return { runs: await listReportScheduleRuns({ projectId: query.projectId, scheduleId: query.scheduleId, limit: query.limit ? Number(query.limit) : 100 }) };
    } catch (error) {
      reply.code(400);
      return { message: errorMessage(error) };
    }
  });
}
