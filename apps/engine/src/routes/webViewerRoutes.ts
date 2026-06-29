import type { FastifyInstance } from 'fastify';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function contentType(filePath: string) {
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
  if (filePath.endsWith('.js')) return 'application/javascript; charset=utf-8';
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
  if (filePath.endsWith('.json')) return 'application/json; charset=utf-8';
  if (filePath.endsWith('.svg')) return 'image/svg+xml';
  if (filePath.endsWith('.png')) return 'image/png';
  if (filePath.endsWith('.ico')) return 'image/x-icon';
  return 'application/octet-stream';
}

function candidateWebRoots() {
  return [
    process.env.ENERGYLINK_WEBVIEWER_DIST,
    path.resolve(process.cwd(), 'apps/web-viewer/dist'),
    path.resolve(process.cwd(), 'WebViewer/dist'),
    path.resolve(process.cwd(), '../WebViewer/dist'),
    path.resolve(__dirname, '../../../../apps/web-viewer/dist'),
    path.resolve(__dirname, '../../WebViewer/dist')
  ].filter(Boolean) as string[];
}

function findWebRoot() {
  for (const candidate of candidateWebRoots()) {
    if (fs.existsSync(path.join(candidate, 'index.html'))) return candidate;
  }
  return null;
}

export async function registerWebViewerRoutes(app: FastifyInstance) {
  app.get('/', async (_, reply) => {
    const root = findWebRoot();
    if (!root) {
      reply.type('text/html; charset=utf-8');
      return '<!doctype html><html><body><h1>EnergyLink Web Viewer</h1><p>Web Viewer build not found. Run pnpm build:web and package the WebViewer dist folder.</p></body></html>';
    }
    reply.type('text/html; charset=utf-8');
    return fs.createReadStream(path.join(root, 'index.html'));
  });

  app.get('/web-viewer/*', async (request, reply) => {
    const root = findWebRoot();
    if (!root) {
      reply.code(404);
      return { message: 'Web Viewer build not found. Run pnpm build:web.' };
    }
    const params = request.params as { '*': string };
    const requested = params['*'] || 'index.html';
    const safePath = path.normalize(requested).replace(/^\.\.(\/|\\|$)+/, '');
    const filePath = path.join(root, safePath);
    if (!filePath.startsWith(root) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      const indexPath = path.join(root, 'index.html');
      reply.type('text/html; charset=utf-8');
      return fs.createReadStream(indexPath);
    }
    reply.type(contentType(filePath));
    return fs.createReadStream(filePath);
  });

  app.get('/assets/*', async (request, reply) => {
    const root = findWebRoot();
    if (!root) {
      reply.code(404);
      return { message: 'Web Viewer assets not found. Run pnpm build:web.' };
    }
    const params = request.params as { '*': string };
    const safePath = path.normalize(params['*']).replace(/^\.\.(\/|\\|$)+/, '');
    const filePath = path.join(root, 'assets', safePath);
    if (!filePath.startsWith(path.join(root, 'assets')) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      reply.code(404);
      return { message: 'Web Viewer asset not found.' };
    }
    reply.type(contentType(filePath));
    return fs.createReadStream(filePath);
  });
}
