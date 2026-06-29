import type { FastifyInstance } from 'fastify';
import { acknowledgeAlarm, readAlarms, readAlarmSummary } from '../services/alarmRuntimeService.js';

export async function registerAlarmRoutes(app: FastifyInstance) {
  app.get('/api/alarms', async (request) => {
    const query = request.query as { projectId?: string; status?: 'active' | 'cleared' | 'all' | 'history'; limit?: string };
    return {
      alarms: await readAlarms(query),
      summary: await readAlarmSummary(query.projectId)
    };
  });

  app.get('/api/alarms/active', async (request) => {
    const query = request.query as { projectId?: string; limit?: string };
    return {
      alarms: await readAlarms({ ...query, status: 'active' }),
      summary: await readAlarmSummary(query.projectId)
    };
  });

  app.get('/api/alarms/history', async (request) => {
    const query = request.query as { projectId?: string; limit?: string };
    return {
      alarms: await readAlarms({ ...query, status: 'history' }),
      summary: await readAlarmSummary(query.projectId)
    };
  });

  app.post('/api/alarms/:id/acknowledge', async (request, reply) => {
    const params = request.params as { id: string };
    const body = request.body as { user?: string } | undefined;
    const result = await acknowledgeAlarm(params.id, body?.user);
    if ('error' in result) return reply.code(404).send(result);
    return { alarm: result };
  });
}
