import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

export type CabinetGlbSpec = {
  widthMm: number;
  heightMm: number;
  depthMm: number;
  color?: string;
  breakerRows?: number;
  breakerCols?: number;
  name?: string;
};

function hexColor(hex: string): THREE.Color {
  try {
    return new THREE.Color(hex);
  } catch {
    return new THREE.Color('#64748b');
  }
}

/** สร้าง GLB ตู้ MCC/panel จากขนาด mm — ไม่ใช้ AI */
export async function cabinetSpecToGlbBlob(spec: CabinetGlbSpec): Promise<{ blob: Blob; byteLength: number }> {
  const w = Math.max(100, spec.widthMm);
  const h = Math.max(100, spec.heightMm);
  const d = Math.max(80, spec.depthMm);
  const scale = 1 / w;
  const bodyW = 1;
  const bodyH = h * scale;
  const bodyD = d * scale;
  const color = hexColor(spec.color ?? '#64748b');

  const scene = new THREE.Scene();
  const group = new THREE.Group();
  group.name = spec.name ?? 'Cabinet';

  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.15 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(bodyW, bodyH, bodyD), bodyMat);
  body.position.set(bodyW / 2, bodyH / 2, bodyD / 2);
  group.add(body);

  const rows = Math.max(1, Math.min(24, spec.breakerRows ?? 6));
  const cols = Math.max(1, Math.min(12, spec.breakerCols ?? 1));
  const doorMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.6, metalness: 0.2 });
  const slotH = (bodyH * 0.85) / rows;
  const slotW = (bodyW * 0.75) / cols;
  const startX = bodyW * 0.125;
  const startY = bodyH * 0.08;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const slot = new THREE.Mesh(
        new THREE.BoxGeometry(slotW * 0.92, slotH * 0.88, bodyD * 0.02),
        doorMat,
      );
      slot.position.set(
        startX + c * slotW + slotW / 2,
        startY + r * slotH + slotH / 2,
        bodyD + 0.002,
      );
      group.add(slot);
    }
  }

  scene.add(group);

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

  body.geometry.dispose();
  bodyMat.dispose();
  group.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
      if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
      else child.material.dispose();
    }
  });

  const blob = new Blob([arrayBuffer], { type: 'model/gltf-binary' });
  return { blob, byteLength: arrayBuffer.byteLength };
}

export async function cabinetSpecToGlbDataUrl(spec: CabinetGlbSpec): Promise<string> {
  const { blob } = await cabinetSpecToGlbBlob(spec);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('อ่าน GLB ไม่ได้'));
    reader.readAsDataURL(blob);
  });
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('อ่าน blob ไม่ได้'));
    reader.readAsDataURL(blob);
  });
}
