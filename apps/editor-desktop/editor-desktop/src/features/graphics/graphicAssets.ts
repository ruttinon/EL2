import type { GraphicAsset, GraphicAssetKind } from '@energylink/shared-types';

export const LS_ASSETS = 'energylink.setup.assets.v1';
export const LS_IMAGES_LEGACY = 'energylink.setup.images.v1';

type LegacyImage = { id: string; name: string; dataUrl: string; createdAt: string };

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function saveJson<T>(key: string, value: T) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

function migrateLegacyImages(): GraphicAsset[] {
  const legacy = loadJson<LegacyImage[]>(LS_IMAGES_LEGACY, []);
  if (legacy.length === 0) return [];
  return legacy.map((img) => ({
    id: img.id,
    name: img.name,
    kind: 'image' as const,
    url: img.dataUrl,
    mimeType: img.dataUrl.startsWith('data:') ? img.dataUrl.split(';')[0]?.replace('data:', '') : undefined,
    createdAt: img.createdAt,
  }));
}

export function loadGraphicAssets(): GraphicAsset[] {
  const stored = loadJson<GraphicAsset[]>(LS_ASSETS, []);
  if (stored.length > 0) return stored;
  const migrated = migrateLegacyImages();
  if (migrated.length > 0) {
    saveGraphicAssets(migrated);
  }
  return migrated;
}

export function saveGraphicAssets(assets: GraphicAsset[]) {
  saveJson(LS_ASSETS, assets);
}

export function assetKindFromFile(file: File): GraphicAssetKind | null {
  const name = file.name.toLowerCase();
  if (name.endsWith('.html') || name.endsWith('.htm') || file.type === 'text/html') return 'html';
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  if (/\.(mp4|webm|mov|avi|mkv|ogv|m4v)$/i.test(name)) return 'video';
  if (name.endsWith('.glb') || name.endsWith('.gltf')) return 'model3d';
  if (name.endsWith('.json')) return 'lottie';
  if (name.endsWith('.svg') || file.type === 'image/svg+xml') return 'svg';
  if (/\.(png|jpe?g|gif|webp|bmp|ico)$/i.test(name)) return 'image';
  return null;
}

export function acceptFilterForKind(kind: GraphicAssetKind | 'all'): string {
  if (kind === 'image') return 'image/*';
  if (kind === 'model3d') return '.glb,.gltf,model/gltf-binary,model/gltf+json';
  if (kind === 'lottie') return '.json,application/json';
  if (kind === 'video') return 'video/*';
  if (kind === 'svg') return '.svg,image/svg+xml';
  if (kind === 'html') return '.html,.htm,text/html';
  return 'image/*,.glb,.gltf,.json,.svg,.html,.htm,video/*';
}

export async function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(`Cannot read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

export async function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(`Cannot read ${file.name}`));
    reader.readAsText(file);
  });
}

export async function importHtmlFileToAsset(file: File): Promise<{ assetId: string; html: string; ref: string }> {
  const html = await readFileAsText(file);
  const id = `html_${Date.now()}_${Math.round(Math.random() * 1e6)}`;
  const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
  const asset: GraphicAsset = {
    id,
    name: file.name.replace(/\.html?$/i, '') || file.name,
    kind: 'html',
    url: dataUrl,
    mimeType: 'text/html',
    fileSize: file.size,
    createdAt: new Date().toISOString(),
  };
  const assets = loadGraphicAssets();
  saveGraphicAssets([asset, ...assets]);
  return {
    assetId: id,
    html,
    ref: assetRefFromId(id),
  };
}

/** Build externalPage payload for a new HTML graphic page (htmlContent always stored for Monitor snapshot). */
export async function buildExternalPageFromHtmlFile(file: File): Promise<{
  source: 'inline' | 'bundle';
  htmlContent: string;
  htmlRef?: string;
}> {
  const html = await readFileAsText(file);
  if (html.length <= 120_000) {
    return { source: 'inline', htmlContent: html };
  }
  const { ref } = await importHtmlFileToAsset(file);
  return { source: 'bundle', htmlContent: html, htmlRef: ref };
}

export function assetsByKind(assets: GraphicAsset[], kind: GraphicAssetKind): GraphicAsset[] {
  return assets.filter((a) => a.kind === kind);
}

export type SharedAssetSummary = {
  id: string;
  name: string;
  kind: GraphicAssetKind | null;
  url: string;
  fileSize?: number;
  mimeType?: string;
};

/** Pull cross-project assets from Engine shared library into local editor storage. */
export async function syncSharedAssetsFromEngine(engineBaseUrl: string): Promise<{ added: GraphicAsset[]; skipped: number }> {
  const base = engineBaseUrl.replace(/\/$/, '');
  const res = await fetch(`${base}/api/assets/shared`);
  if (!res.ok) throw new Error(`Engine shared assets: HTTP ${res.status}`);
  const data = (await res.json()) as { assets?: SharedAssetSummary[] };
  const remote = data.assets ?? [];
  const existing = loadGraphicAssets();
  const existingUrls = new Set(existing.map((a) => a.url));
  const added: GraphicAsset[] = [];

  for (const item of remote) {
    if (!item.kind) continue;
    const absoluteUrl = item.url.startsWith('http') ? item.url : `${base}${item.url}`;
    if (existingUrls.has(absoluteUrl)) continue;
    const asset: GraphicAsset = {
      id: `shared-${item.id}`,
      name: item.name,
      kind: item.kind,
      url: absoluteUrl,
      mimeType: item.mimeType,
      fileSize: item.fileSize,
      createdAt: new Date().toISOString(),
    };
    added.push(asset);
    existingUrls.add(absoluteUrl);
  }

  if (added.length > 0) {
    const merged = [...added, ...existing];
    saveGraphicAssets(merged);
  }

  return { added, skipped: remote.length - added.length };
}

const ASSET_REF_PREFIX = 'asset://';

export function assetRefFromId(assetId: string): string {
  return `${ASSET_REF_PREFIX}${assetId}`;
}

/** Resolve asset://id or pass through http/data URLs. */
export function resolveAssetRef(ref: string | null | undefined, assets?: GraphicAsset[]): string {
  if (!ref) return '';
  if (!ref.startsWith(ASSET_REF_PREFIX)) return ref;
  const id = ref.slice(ASSET_REF_PREFIX.length);
  const list = assets ?? loadGraphicAssets();
  return list.find((a) => a.id === id)?.url ?? '';
}

const INLINE_MEDIA_LIMIT = 400_000;

export async function importMediaFileToAsset(
  file: File,
  kind: 'image' | 'video' | 'svg',
): Promise<{ assetId: string; url: string; ref: string; mimeType: string }> {
  const dataUrl = await readFileAsDataUrl(file);
  const id = `${kind === 'video' ? 'vid' : 'img'}_${Date.now()}_${Math.round(Math.random() * 1e6)}`;
  const asset: GraphicAsset = {
    id,
    name: file.name.replace(/\.[^.]+$/, '') || file.name,
    kind,
    url: dataUrl,
    mimeType: file.type || (kind === 'video' ? 'video/mp4' : 'image/png'),
    fileSize: file.size,
    createdAt: new Date().toISOString(),
  };
  const assets = loadGraphicAssets();
  saveGraphicAssets([asset, ...assets]);
  const useRef = file.size > INLINE_MEDIA_LIMIT || dataUrl.length > INLINE_MEDIA_LIMIT;
  return {
    assetId: id,
    url: dataUrl,
    ref: useRef ? assetRefFromId(id) : dataUrl,
    mimeType: asset.mimeType ?? '',
  };
}

export async function importImageFileToAsset(file: File) {
  const detected = assetKindFromFile(file);
  const kind = detected === 'svg' ? 'svg' : 'image';
  return importMediaFileToAsset(file, kind);
}

export async function importVideoFileToAsset(file: File) {
  return importMediaFileToAsset(file, 'video');
}

export async function importModelFileToAsset(file: File): Promise<{ assetId: string; url: string; ref: string }> {
  const dataUrl = await readFileAsDataUrl(file);
  const id = `mdl_${Date.now()}_${Math.round(Math.random() * 1e6)}`;
  const asset: GraphicAsset = {
    id,
    name: file.name.replace(/\.(glb|gltf)$/i, '') || file.name,
    kind: 'model3d',
    url: dataUrl,
    mimeType: file.type || 'model/gltf-binary',
    fileSize: file.size,
    createdAt: new Date().toISOString(),
  };
  const assets = loadGraphicAssets();
  saveGraphicAssets([asset, ...assets]);
  const useRef = file.size > 400_000 || dataUrl.length > 400_000;
  return {
    assetId: id,
    url: dataUrl,
    ref: useRef ? assetRefFromId(id) : dataUrl,
  };
}
