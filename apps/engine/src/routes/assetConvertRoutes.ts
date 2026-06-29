import type { FastifyInstance } from 'fastify';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { getImagesDir } from '@energylink/shared-data';
import { appendEngineLog } from '../services/engineLogger.js';

const SUPPORTED_SOURCE = new Set(['fbx', 'obj', 'stl', 'dae']);
const INCOMING_SUBDIR = 'incoming-3d';
const SHARED_SUBDIR = 'shared-library';

type ConvertBody = {
  filename?: string;
  dataBase64?: string;
  target?: string;
};

function safeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120);
}

function tryFbx2Gltf(sourcePath: string): { ok: boolean; glbPath?: string; log?: string } {
  const glbPath = sourcePath.replace(/\.[^.]+$/, '.glb');
  try {
    const r = spawnSync('fbx2gltf', ['-i', sourcePath, '-o', glbPath], {
      encoding: 'utf8',
      timeout: 120_000,
    });
    if (r.status === 0 && fs.existsSync(glbPath)) {
      return { ok: true, glbPath };
    }
    return { ok: false, log: (r.stderr || r.stdout || 'fbx2gltf failed').slice(0, 500) };
  } catch {
    return { ok: false, log: 'fbx2gltf not found on PATH' };
  }
}

export async function registerAssetConvertRoutes(app: FastifyInstance) {
  app.get('/api/assets/convert', async () => ({
    pipeline: 'manual-or-external',
    supportedSources: [...SUPPORTED_SOURCE],
    supportedTargets: ['glb', 'gltf'],
    docs: 'docs/ASSET_CONVERT_PIPELINE.md',
    notes: 'Upload FBX/OBJ/STL for staging. Convert with Blender, assimp, or fbx2gltf, then import GLB in Editor → Setup → Assets.',
  }));

  app.post('/api/assets/convert', async (request, reply) => {
    const body = (request.body ?? {}) as ConvertBody;
    const filename = safeFilename(cleanText(body.filename) || 'model.fbx');
    const ext = path.extname(filename).replace('.', '').toLowerCase();
    const target = cleanText(body.target) || 'glb';

    if (!SUPPORTED_SOURCE.has(ext)) {
      return reply.code(400).send({
        ok: false,
        error: `Unsupported source format ".${ext}". Use: ${[...SUPPORTED_SOURCE].join(', ')}`,
        docs: 'docs/ASSET_CONVERT_PIPELINE.md',
      });
    }

    if (!body.dataBase64 || typeof body.dataBase64 !== 'string') {
      return reply.code(400).send({
        ok: false,
        error: 'Request body must include dataBase64 (file bytes, base64-encoded).',
        example: { filename: 'pump.fbx', dataBase64: '...', target: 'glb' },
        docs: 'docs/ASSET_CONVERT_PIPELINE.md',
      });
    }

    let buffer: Buffer;
    try {
      buffer = Buffer.from(body.dataBase64, 'base64');
    } catch {
      return reply.code(400).send({ ok: false, error: 'Invalid base64 in dataBase64.' });
    }

    if (buffer.length < 16) {
      return reply.code(400).send({ ok: false, error: 'File too small or empty.' });
    }

    const incomingDir = path.join(getImagesDir(), INCOMING_SUBDIR);
    fs.mkdirSync(incomingDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const savedName = `${stamp}_${filename}`;
    const savedPath = path.join(incomingDir, savedName);
    fs.writeFileSync(savedPath, buffer);

    appendEngineLog('info', '3D asset staged for conversion', { savedPath, ext, target, bytes: buffer.length });

    const converted = ext === 'fbx' ? tryFbx2Gltf(savedPath) : { ok: false as const, log: undefined };
    if (converted.ok && converted.glbPath) {
      const sharedDir = path.join(getImagesDir(), SHARED_SUBDIR);
      fs.mkdirSync(sharedDir, { recursive: true });
      const glbName = path.basename(converted.glbPath).replace(/\.glb$/i, '') + '.glb';
      const sharedPath = path.join(sharedDir, glbName);
      fs.copyFileSync(converted.glbPath, sharedPath);
      return {
        ok: true,
        status: 'converted',
        savedPath,
        glbPath: sharedPath,
        sharedUrl: `/api/assets/shared/file/${encodeURIComponent(glbName)}`,
        filename: savedName,
        bytes: buffer.length,
        target: 'glb',
        message: `Converted ${savedName} → ${glbName} via fbx2gltf. Import from shared library in Editor.`,
      };
    }

    return {
      ok: true,
      status: 'staged',
      savedPath,
      filename: savedName,
      bytes: buffer.length,
      target,
      message: `Saved ${savedName}. Convert to GLB externally, then import in Editor → Setup → Assets.`,
      docs: 'docs/ASSET_CONVERT_PIPELINE.md',
      suggestedCommands: [
        `blender --background --python convert_to_glb.py -- "${savedPath}"`,
        `assimp export "${savedPath}" "${savedPath.replace(/\.[^.]+$/, '.glb')}"`,
        `fbx2gltf -i "${savedPath}" -o "${savedPath.replace(/\.[^.]+$/, '.glb')}"`,
      ],
      convertAttempt: converted.log,
    };
  });
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}
