import type { FastifyInstance } from 'fastify';
import {
  getRuntimePollingStatus,
  getRuntimeMetrics,
  getCurrentValuesSnapshot,
  runRuntimeReadCycle,
  readTrend,
  startRuntimePolling,
  stopRuntimePolling
} from '../services/runtimePollingService.js';
import { addRuntimeSubscriber } from '../services/runtimeStream.js';

export async function registerRuntimeRoutes(app: FastifyInstance) {
  app.get('/api/runtime/polling/status', async () => getRuntimePollingStatus());

  app.get('/api/runtime/metrics', async () => getRuntimeMetrics());

  app.post('/api/runtime/polling/start', async () => startRuntimePolling('api_start'));

  app.post('/api/runtime/polling/stop', async () => stopRuntimePolling('manual_stop'));

  app.post('/api/runtime/read-cycle', async () => {
    await runRuntimeReadCycle('api_manual_cycle');
    return getRuntimePollingStatus();
  });

  app.get('/api/tags/current', async (request) => {
    const query = request.query as { projectId?: string; deviceId?: string };
    return {
      values: await getCurrentValuesSnapshot(query),
      runtime: getRuntimePollingStatus(),
      metrics: getRuntimeMetrics()
    };
  });

  // Server-Sent Events stream for real-time tag values (P3: push instead of polling)
  app.get('/api/tags/stream', async (request, reply) => {
    const query = request.query as { projectId?: string; deviceId?: string };

    reply.hijack();
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': '*'
    });
    // Hint the browser to retry quickly if the connection drops
    reply.raw.write('retry: 3000\n\n');

    const matches = (row: any) => {
      if (query.projectId && row?.projectId !== query.projectId) return false;
      if (query.deviceId && row?.deviceId !== query.deviceId) return false;
      return true;
    };

    const writeValues = (values: unknown[]) => {
      const filtered = (values as any[]).filter(matches);
      reply.raw.write(`event: values\ndata: ${JSON.stringify({ values: filtered })}\n\n`);
    };

    // Send an immediate snapshot so the client doesn't wait for the next cycle
    try {
      const initial = await getCurrentValuesSnapshot(query);
      reply.raw.write(`event: values\ndata: ${JSON.stringify({ values: initial })}\n\n`);
    } catch {
      // ignore — values will arrive on the next broadcast
    }

    const remove = addRuntimeSubscriber(writeValues);
    // Heartbeat keeps the connection alive through proxies/load balancers
    const heartbeat = setInterval(() => {
      try {
        reply.raw.write(': ping\n\n');
      } catch {
        // ignore
      }
    }, 25000);

    request.raw.on('close', () => {
      clearInterval(heartbeat);
      remove();
    });
  });

  app.get('/api/trend', async (request, reply) => {
    const query = request.query as {
      tagId?: string;
      from?: string;
      to?: string;
      limit?: string;
      points?: string;
      bucketMs?: string;
      agg?: string;
    };
    const result = await readTrend(query);
    if ('error' in result) return reply.code(400).send(result);
    return result;
  });
}
