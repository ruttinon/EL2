import { randomUUID } from 'node:crypto';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const JPEG_SOI = Buffer.from([0xff, 0xd8]);
const JPEG_EOI = Buffer.from([0xff, 0xd9]);
export const MJPEG_BOUNDARY = 'energylinkframe';

const HLS_SEGMENT_RE = /^seg_\d+\.ts$/;

type RtspSession = {
  id: string;
  rtspUrl: string;
  label?: string;
  process: ChildProcess;
  hlsProcess: ChildProcess;
  hlsDir: string;
  clients: Set<(frame: Buffer) => void>;
  lastFrame: Buffer | null;
  startedAt: number;
};

const sessions = new Map<string, RtspSession>();

export function hasFfmpegOnPath(): boolean {
  try {
    const r = spawnSync(process.platform === 'win32' ? 'where' : 'which', ['ffmpeg'], { encoding: 'utf8' });
    return r.status === 0 && Boolean(r.stdout?.trim());
  } catch {
    return false;
  }
}

function hlsDirFor(id: string): string {
  return join(tmpdir(), 'energylink-hls', id);
}

function extractJpegFrames(buffer: Buffer, onFrame: (frame: Buffer) => void): Buffer {
  let rest = buffer;
  while (rest.length > 2) {
    const start = rest.indexOf(JPEG_SOI);
    if (start === -1) return Buffer.alloc(0);
    if (start > 0) rest = rest.subarray(start);
    const end = rest.indexOf(JPEG_EOI, 2);
    if (end === -1) return rest;
    onFrame(rest.subarray(0, end + 2));
    rest = rest.subarray(end + 2);
  }
  return rest;
}

function startHlsWriter(id: string, rtspUrl: string): { hlsDir: string; process: ChildProcess } {
  const hlsDir = hlsDirFor(id);
  mkdirSync(hlsDir, { recursive: true });
  const segmentPattern = join(hlsDir, 'seg_%03d.ts');
  const playlistPath = join(hlsDir, 'index.m3u8');
  const proc = spawn(
    'ffmpeg',
    [
      '-hide_banner',
      '-loglevel',
      'error',
      '-rtsp_transport',
      'tcp',
      '-i',
      rtspUrl,
      '-an',
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-tune',
      'zerolatency',
      '-g',
      '30',
      '-sc_threshold',
      '0',
      '-f',
      'hls',
      '-hls_time',
      '2',
      '-hls_list_size',
      '6',
      '-hls_flags',
      'delete_segments+append_list',
      '-hls_segment_filename',
      segmentPattern,
      playlistPath,
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );
  return { hlsDir, process: proc };
}

function cleanupSessionFiles(session: RtspSession) {
  try {
    rmSync(session.hlsDir, { recursive: true, force: true });
  } catch {
    /* best effort */
  }
}

export function startRtspSession(
  rtspUrl: string,
  label?: string,
): { id: string } | { error: string } {
  if (!hasFfmpegOnPath()) return { error: 'ffmpeg not found on PATH' };

  const id = randomUUID().replace(/-/g, '').slice(0, 10);
  const proc = spawn(
    'ffmpeg',
    [
      '-hide_banner',
      '-loglevel',
      'error',
      '-rtsp_transport',
      'tcp',
      '-i',
      rtspUrl,
      '-an',
      '-f',
      'image2pipe',
      '-vcodec',
      'mjpeg',
      '-q:v',
      '5',
      '-r',
      '10',
      'pipe:1',
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );

  const { hlsDir, process: hlsProcess } = startHlsWriter(id, rtspUrl);

  const session: RtspSession = {
    id,
    rtspUrl,
    label,
    process: proc,
    hlsProcess,
    hlsDir,
    clients: new Set(),
    lastFrame: null,
    startedAt: Date.now(),
  };

  let pending: Buffer = Buffer.alloc(0);
  proc.stdout?.on('data', (chunk: Buffer) => {
    pending = Buffer.from(extractJpegFrames(Buffer.concat([pending, chunk]), (frame) => {
      session.lastFrame = frame;
      for (const client of session.clients) client(frame);
    }));
  });

  const removeSession = () => {
    sessions.delete(id);
    cleanupSessionFiles(session);
  };

  proc.on('close', removeSession);
  hlsProcess.on('close', () => {
    if (!sessions.has(id)) return;
  });

  proc.stderr?.on('data', () => {
    /* ffmpeg diagnostics */
  });
  hlsProcess.stderr?.on('data', () => {
    /* ffmpeg diagnostics */
  });

  sessions.set(id, session);
  return { id };
}

export function getRtspSession(id: string): RtspSession | undefined {
  return sessions.get(id);
}

export function subscribeRtspMjpeg(id: string, onFrame: (frame: Buffer) => void): (() => void) | null {
  const session = sessions.get(id);
  if (!session) return null;
  if (session.lastFrame) onFrame(session.lastFrame);
  session.clients.add(onFrame);
  return () => {
    session.clients.delete(onFrame);
  };
}

export function readRtspHlsFile(id: string, filename: string): { body: Buffer | string; contentType: string } | null {
  const session = sessions.get(id);
  if (!session) return null;
  if (filename !== 'index.m3u8' && !HLS_SEGMENT_RE.test(filename)) return null;
  const filePath = join(session.hlsDir, filename);
  if (!filePath.startsWith(session.hlsDir)) return null;
  if (!existsSync(filePath)) return null;
  if (filename === 'index.m3u8') {
    const raw = readFileSync(filePath, 'utf8');
    const rewritten = raw.replace(/^(seg_\d+\.ts)$/gm, `/api/stream/rtsp/${id}/hls/$1`);
    return { body: rewritten, contentType: 'application/vnd.apple.mpegurl' };
  }
  return { body: readFileSync(filePath), contentType: 'video/mp2t' };
}

export function stopRtspSession(id: string): boolean {
  const session = sessions.get(id);
  if (!session) return false;
  session.process.kill('SIGTERM');
  session.hlsProcess.kill('SIGTERM');
  sessions.delete(id);
  cleanupSessionFiles(session);
  return true;
}

export function listRtspSessions() {
  return [...sessions.values()].map((s) => ({
    id: s.id,
    rtspUrl: s.rtspUrl,
    label: s.label,
    startedAt: s.startedAt,
    clientCount: s.clients.size,
    hasFrame: s.lastFrame != null,
    hlsReady: existsSync(join(s.hlsDir, 'index.m3u8')),
    mjpegUrl: `/api/stream/rtsp/${s.id}/mjpg`,
    hlsUrl: `/api/stream/rtsp/${s.id}/hls/index.m3u8`,
  }));
}

export function stopAllRtspSessions() {
  for (const id of [...sessions.keys()]) stopRtspSession(id);
}
