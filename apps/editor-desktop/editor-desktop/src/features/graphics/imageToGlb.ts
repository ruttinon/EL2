import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

export type ImageToGlbMode = 'relief' | 'silhouette';

export type ImageToGlbOptions = {
  /** Max displacement as fraction of model width (0.05–0.5) */
  depthScale?: number;
  /** Grid resolution per axis (16–128) */
  segments?: number;
  mode?: ImageToGlbMode;
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('โหลดรูpไม่ได้'));
    img.src = src;
  });
}

function sampleHeight(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  u: number,
  v: number,
  mode: ImageToGlbMode,
): number {
  const x = Math.min(w - 1, Math.max(0, Math.round(u * (w - 1))));
  const y = Math.min(h - 1, Math.max(0, Math.round(v * (h - 1))));
  const i = (y * w + x) * 4;
  const r = data[i] / 255;
  const g = data[i + 1] / 255;
  const b = data[i + 2] / 255;
  const a = data[i + 3] / 255;
  if (mode === 'silhouette') return a;
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  return Math.max(a * 0.15, 1 - lum);
}

/** Build a GLB mesh from a 2D image (relief or alpha silhouette extrusion) */
export async function imageDataUrlToGlbBlob(
  dataUrl: string,
  options: ImageToGlbOptions = {},
): Promise<{ blob: Blob; byteLength: number }> {
  const depthScale = Math.min(0.5, Math.max(0.05, options.depthScale ?? 0.18));
  const segments = Math.min(128, Math.max(16, Math.round(options.segments ?? 64)));
  const mode = options.mode ?? 'relief';

  const img = await loadImage(dataUrl);
  const cw = Math.min(512, img.naturalWidth || img.width);
  const ch = Math.min(512, Math.round(cw * ((img.naturalHeight || img.height) / (img.naturalWidth || img.width || 1))));

  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas ไม่พร้อม');
  ctx.drawImage(img, 0, 0, cw, ch);
  const { data } = ctx.getImageData(0, 0, cw, ch);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;

  const aspect = cw / ch;
  const planeW = 1;
  const planeH = 1 / aspect;
  const maxDepth = planeW * depthScale;

  const geo = new THREE.PlaneGeometry(planeW, planeH, segments, segments);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const lx = pos.getX(i);
    const ly = pos.getY(i);
    const u = (lx / planeW) + 0.5;
    const v = 1 - ((ly / planeH) + 0.5);
    const h = sampleHeight(data, cw, ch, u, v, mode);
    pos.setZ(i, h * maxDepth);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 0.85,
    metalness: 0.05,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'ImageMesh';
  mesh.rotation.x = -Math.PI / 2;

  const scene = new THREE.Scene();
  scene.add(mesh);

  const exporter = new GLTFExporter();
  const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
    exporter.parse(
      scene,
      (result) => {
        if (result instanceof ArrayBuffer) resolve(result);
        else reject(new Error('GLB export failed'));
      },
      (err) => reject(err instanceof Error ? err : new Error(String(err))),
      { binary: true },
    );
  });

  texture.dispose();
  geo.dispose();
  mat.dispose();

  const blob = new Blob([arrayBuffer], { type: 'model/gltf-binary' });
  return { blob, byteLength: arrayBuffer.byteLength };
}

export async function imageDataUrlToGlbDataUrl(
  dataUrl: string,
  options?: ImageToGlbOptions,
): Promise<string> {
  const { blob } = await imageDataUrlToGlbBlob(dataUrl, options);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('อ่าน GLB ไม่ได้'));
    reader.readAsDataURL(blob);
  });
}

export function downloadGlbBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.glb') ? filename : `${filename}.glb`;
  a.click();
  URL.revokeObjectURL(url);
}

export function detectGlbMode(dataUrl: string): ImageToGlbMode {
  if (dataUrl.startsWith('data:image/png')) return 'silhouette';
  return 'relief';
}
