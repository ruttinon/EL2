import type { FastifyInstance } from 'fastify';
import {
  MJPEG_BOUNDARY,
  getRtspSession,
  hasFfmpegOnPath,
  listRtspSessions,
  readRtspHlsFile,
  startRtspSession,
  stopRtspSession,
  subscribeRtspMjpeg,
} from '../services/rtspProxyService.js';

function hasFfmpeg(): boolean {
  return hasFfmpegOnPath();
}

export async function registerStreamRoutes(app: FastifyInstance) {
  app.get('/api/stream/tools', async () => ({
    ffmpeg: hasFfmpeg(),
    rtspNative: hasFfmpeg(),
    docs: 'docs/VIDEO_STREAM_RTSP.md',
    notes: hasFfmpeg()
      ? 'POST /api/stream/rtsp/start bridges RTSP → MJPEG + HLS segments, or use external MediaMTX/ffmpeg.'
      : 'Install ffmpeg on PATH for native RTSP bridge, or use MediaMTX externally.',
    videoWidgetTypes: ['file', 'mjpeg', 'hls', 'rtsp'],
    endpoints: {
      start: 'POST /api/stream/rtsp/start',
      mjpeg: 'GET /api/stream/rtsp/:id/mjpg',
      hlsPlaylist: 'GET /api/stream/rtsp/:id/hls/index.m3u8',
      hlsSegment: 'GET /api/stream/rtsp/:id/hls/seg_NNN.ts',
      stop: 'DELETE /api/stream/rtsp/:id',
      list: 'GET /api/stream/rtsp',
    },
  }));

  app.get('/api/stream/rtsp', async () => ({
    sessions: listRtspSessions(),
  }));

  app.post('/api/stream/rtsp/start', async (request, reply) => {
    const body = (request.body ?? {}) as { rtspUrl?: string; label?: string };
    const rtspUrl = typeof body.rtspUrl === 'string' ? body.rtspUrl.trim() : '';
    if (!/^rtsp:\/\/.+/i.test(rtspUrl)) {
      return reply.code(400).send({ ok: false, error: 'invalid rtsp url' });
    }
    const result = startRtspSession(rtspUrl, body.label);
    if ('error' in result) {
      return reply.code(503).send({ ok: false, error: result.error });
    }
    return {
      ok: true,
      id: result.id,
      mjpegUrl: `/api/stream/rtsp/${result.id}/mjpg`,
      hlsUrl: `/api/stream/rtsp/${result.id}/hls/index.m3u8`,
    };
  });

  app.delete('/api/stream/rtsp/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!stopRtspSession(id)) {
      return reply.code(404).send({ ok: false, error: 'session not found' });
    }
    return { ok: true };
  });

  app.get('/api/stream/rtsp/:id/mjpg', async (request, reply) => {
    const { id } = request.params as { id: string };
    const session = getRtspSession(id);
    if (!session) {
      return reply.code(404).send({ error: 'session not found' });
    }

    reply.hijack();
    reply.raw.writeHead(200, {
      'Content-Type': `multipart/x-mixed-replace; boundary=${MJPEG_BOUNDARY}`,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    const writeFrame = (frame: Buffer) => {
      reply.raw.write(
        `--${MJPEG_BOUNDARY}\r\nContent-Type: image/jpeg\r\nContent-Length: ${frame.length}\r\n\r\n`,
      );
      reply.raw.write(frame);
      reply.raw.write('\r\n');
    };

    const unsub = subscribeRtspMjpeg(id, writeFrame);
    if (!unsub) {
      reply.raw.end();
      return;
    }

    request.raw.on('close', () => {
      unsub();
    });
  });

  app.get('/api/stream/rtsp/:id/hls/:file', async (request, reply) => {
    const { id, file } = request.params as { id: string; file: string };
    const payload = readRtspHlsFile(id, file);
    if (!payload) {
      return reply.code(404).send({ error: 'segment not found' });
    }
    return reply
      .header('Content-Type', payload.contentType)
      .header('Cache-Control', 'no-cache, no-store, must-revalidate')
      .header('Access-Control-Allow-Origin', '*')
      .send(payload.body);
  });

  app.post('/api/stream/rtsp-hint', async (request) => {
    const body = (request.body ?? {}) as { rtspUrl?: string };
    const rtspUrl = typeof body.rtspUrl === 'string' ? body.rtspUrl.trim() : '';
    const valid = /^rtsp:\/\/.+/i.test(rtspUrl);
    const ffmpegAvailable = hasFfmpeg();
    return {
      ok: valid,
      rtspUrl: valid ? rtspUrl : undefined,
      ffmpegAvailable,
      nativeBridge: ffmpegAvailable
        ? 'POST /api/stream/rtsp/start with { rtspUrl } — use hlsUrl (preferred) or mjpegUrl in Video widget'
        : undefined,
      suggestedMjpegCommand: valid && !ffmpegAvailable
        ? `ffmpeg -rtsp_transport tcp -i "${rtspUrl}" -f mjpeg -q:v 5 -r 10 -listen 1 http://0.0.0.0:8090/cam.mjpg`
        : undefined,
      docs: 'docs/VIDEO_STREAM_RTSP.md',
    };
  });
}
