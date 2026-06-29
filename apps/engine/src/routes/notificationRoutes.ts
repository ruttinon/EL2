import type { FastifyInstance } from 'fastify';
import {
  createNotificationChannel,
  createNotificationRule,
  deleteNotificationChannel,
  deleteNotificationRule,
  listNotificationChannels,
  listNotificationEvents,
  listNotificationRules,
  listPendingSoundNotifications,
  markNotificationDelivered,
  updateNotificationChannel,
  updateNotificationRule
} from '../services/alarmNotificationService.js';

export async function registerNotificationRoutes(app: FastifyInstance) {
  app.get('/api/notifications/channels', async (request) => {
    const query = request.query as { projectId?: string };
    return { channels: await listNotificationChannels(query.projectId) };
  });

  app.post('/api/notifications/channels', async (request, reply) => {
    const body = request.body as any;
    if (!body?.name || !body?.type) return reply.code(400).send({ message: 'name and type are required.' });
    return { channel: await createNotificationChannel(body) };
  });

  app.put('/api/notifications/channels/:id', async (request, reply) => {
    const params = request.params as { id: string };
    try {
      return { channel: await updateNotificationChannel(params.id, request.body as any) };
    } catch (error) {
      return reply.code(404).send({ message: error instanceof Error ? error.message : String(error) });
    }
  });

  app.delete('/api/notifications/channels/:id', async (request, reply) => {
    const params = request.params as { id: string };
    try {
      return { channel: await deleteNotificationChannel(params.id) };
    } catch (error) {
      return reply.code(404).send({ message: error instanceof Error ? error.message : String(error) });
    }
  });

  app.get('/api/notifications/rules', async (request) => {
    const query = request.query as { projectId?: string };
    return { rules: await listNotificationRules(query.projectId) };
  });

  app.post('/api/notifications/rules', async (request, reply) => {
    const body = request.body as any;
    if (!body?.name || !body?.channelId || !body?.eventType) return reply.code(400).send({ message: 'name, channelId, and eventType are required.' });
    return { rule: await createNotificationRule(body) };
  });

  app.put('/api/notifications/rules/:id', async (request, reply) => {
    const params = request.params as { id: string };
    try {
      return { rule: await updateNotificationRule(params.id, request.body as any) };
    } catch (error) {
      return reply.code(404).send({ message: error instanceof Error ? error.message : String(error) });
    }
  });

  app.delete('/api/notifications/rules/:id', async (request, reply) => {
    const params = request.params as { id: string };
    try {
      return { rule: await deleteNotificationRule(params.id) };
    } catch (error) {
      return reply.code(404).send({ message: error instanceof Error ? error.message : String(error) });
    }
  });

  app.get('/api/notifications/events', async (request) => {
    const query = request.query as any;
    return { events: await listNotificationEvents(query) };
  });

  app.get('/api/notifications/pending', async (request) => {
    const query = request.query as { projectId?: string; channelType?: string };
    if (query.channelType && query.channelType !== 'sound') return { events: [] };
    return { events: await listPendingSoundNotifications(query.projectId) };
  });

  app.post('/api/notifications/events/:id/mark-delivered', async (request, reply) => {
    const params = request.params as { id: string };
    try {
      return { event: await markNotificationDelivered(params.id) };
    } catch (error) {
      return reply.code(404).send({ message: error instanceof Error ? error.message : String(error) });
    }
  });
}
