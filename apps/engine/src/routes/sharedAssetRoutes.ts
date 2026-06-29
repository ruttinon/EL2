import type { FastifyInstance } from 'fastify';
import fs from 'node:fs';
import path from 'node:path';
import { getImagesDir } from '@energylink/shared-data';
import { appendEngineLog } from '../services/engineLogger.js';

const SHARED_SUBDIR = 'shared-library';
const ALLOWED_EXT = new Set(['.glb', '.gltf', '.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif', '.json', '.mp4', '.webm']);

type SharedAssetKind = 'image' | 'model3d' | 'lottie' | 'video' | 'svg';

function sharedRoot() {
  const root = path.join(getImagesDir(), SHARED_SUBDIR);
  fs.mkdirSync(root, { recursive: true });
  return root;
}

function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120);
}

function kindFromExt(ext: string): SharedAssetKind | null {
  const e = ext.toLowerCase();
  if (['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(e)) return 'image';
  if (['.glb', '.gltf'].includes(e)) return 'model3d';
  if (e === '.json') return 'lottie';
  if (['.mp4', '.webm'].includes(e)) return 'video';
  if (e === '.svg') return 'svg';
  return null;
}

function mimeForExt(ext: string) {
  const map: Record<string, string> = {
    '.glb': 'model/gltf-binary',
    '.gltf': 'model/gltf+json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.gif': 'image/gif',
    '.json': 'application/json',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
  };
  return map[ext.toLowerCase()] ?? 'application/octet-stream';
}

type UploadBody = { filename?: string; dataBase64?: string };

export async function registerSharedAssetRoutes(app: FastifyInstance) {
  app.get('/api/assets/shared', async () => {
    const root = sharedRoot();
    const files = fs.readdirSync(root, { withFileTypes: true })
      .filter((d) => d.isFile())
      .map((d) => d.name)
      .filter((name) => ALLOWED_EXT.has(path.extname(name).toLowerCase()));

    const assets = files.map((name) => {
      const ext = path.extname(name).toLowerCase();
      const stat = fs.statSync(path.join(root, name));
      const kind = kindFromExt(ext);
      return {
        id: name,
        name,
        kind,
        url: `/api/assets/shared/file/${encodeURIComponent(name)}`,
        fileSize: stat.size,
        mimeType: mimeForExt(ext),
        updatedAt: stat.mtime.toISOString(),
      };
    });

    return { root: SHARED_SUBDIR, count: assets.length, assets };
  });

  app.get('/api/assets/shared/file/*', async (request, reply) => {
    const wildcard = (request.params as { '*': string })['*'] ?? '';
    const name = safeName(path.basename(wildcard));
    const filePath = path.join(sharedRoot(), name);
    if (!filePath.startsWith(sharedRoot()) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      return reply.code(404).send({ message: 'Shared asset not found.' });
    }
    const ext = path.extname(name).toLowerCase();
    return reply.type(mimeForExt(ext)).send(fs.createReadStream(filePath));
  });

  app.post('/api/assets/shared', async (request, reply) => {
    const body = (request.body ?? {}) as UploadBody;
    const filename = safeName(body.filename ?? 'asset.bin');
    const ext = path.extname(filename).toLowerCase();
    if (!ALLOWED_EXT.has(ext)) {
      return reply.code(400).send({ error: `Unsupported extension "${ext}".`, allowed: [...ALLOWED_EXT] });
    }
    if (!body.dataBase64) {
      return reply.code(400).send({ error: 'dataBase64 is required.' });
    }
    let buffer: Buffer;
    try {
      buffer = Buffer.from(body.dataBase64, 'base64');
    } catch {
      return reply.code(400).send({ error: 'Invalid base64.' });
    }
    const filePath = path.join(sharedRoot(), filename);
    fs.writeFileSync(filePath, buffer);
    appendEngineLog('info', 'Shared asset uploaded', { filename, bytes: buffer.length });
    return {
      ok: true,
      name: filename,
      url: `/api/assets/shared/file/${encodeURIComponent(filename)}`,
      kind: kindFromExt(ext),
      bytes: buffer.length,
    };
  });
}
