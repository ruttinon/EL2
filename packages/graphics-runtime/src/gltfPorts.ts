import type { GraphicPort, PortKind } from '@energylink/shared-types';
import type { Object3D } from 'three';
import { formatPorts } from '@energylink/shared-types';
import { autoGlbEquipmentPorts } from './ports';

const PORT_NODE_RE = /^(port_|socket_|in_|out_)/i;

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

/** Map glTF node name → port id + kind */
export function parseGltfPortNodeName(name: string): { id: string; kind: PortKind } {
  const trimmed = name.trim();
  const lower = trimmed.toLowerCase();
  let kind: PortKind = 'bidirectional';
  if (lower.startsWith('in_') || lower.includes('_in') || lower.startsWith('socket_in')) {
    kind = 'in';
  } else if (lower.startsWith('out_') || lower.includes('_out') || lower.startsWith('socket_out')) {
    kind = 'out';
  }

  let id = trimmed
    .replace(/^port_/i, '')
    .replace(/^socket_/i, '')
    .replace(/^in_/i, 'in-')
    .replace(/^out_/i, 'out-')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!id) id = trimmed.toLowerCase().replace(/\s+/g, '-');
  return { id, kind };
}

export type GltfPortSample = {
  name: string;
  /** 0–1 relative to model bounding box (top-down XZ → canvas x,y) */
  x: number;
  y: number;
};

/** Build ports from named nodes + normalized bbox positions (unit-testable) */
export function portsFromGltfNodeSamples(samples: GltfPortSample[]): GraphicPort[] {
  const ports: GraphicPort[] = [];
  const seen = new Set<string>();
  for (const sample of samples) {
    if (!PORT_NODE_RE.test(sample.name)) continue;
    const { id, kind } = parseGltfPortNodeName(sample.name);
    let uniqueId = id;
    let n = 2;
    while (seen.has(uniqueId)) {
      uniqueId = `${id}-${n}`;
      n += 1;
    }
    seen.add(uniqueId);
    ports.push({
      id: uniqueId,
      x: clamp01(sample.x),
      y: clamp01(sample.y),
      label: sample.name,
      kind,
    });
  }
  return ports;
}

export function formatGltfPorts(ports: GraphicPort[]): string {
  return ports.length > 0 ? formatPorts(ports) : autoGlbEquipmentPorts();
}

/** Load GLB/glTF and extract ports from node names (browser / Electron) */
export async function extractGltfPortsFromUrl(url: string): Promise<GraphicPort[]> {
  if (typeof window === 'undefined' || !url.trim()) return [];

  const [{ GLTFLoader }, THREE] = await Promise.all([
    import('three/examples/jsm/loaders/GLTFLoader.js'),
    import('three'),
  ]);

  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(url);
  const box = new THREE.Box3().setFromObject(gltf.scene);
  const size = box.getSize(new THREE.Vector3());
  const min = box.min;
  const samples: GltfPortSample[] = [];
  const worldPos = new THREE.Vector3();

  gltf.scene.traverse((node: Object3D) => {
    if (!node.name || !PORT_NODE_RE.test(node.name)) return;
    node.getWorldPosition(worldPos);
    const nx = size.x > 1e-6 ? (worldPos.x - min.x) / size.x : 0.5;
    const nz = size.z > 1e-6 ? (worldPos.z - min.z) / size.z : 0.5;
    samples.push({
      name: node.name,
      x: nx,
      y: 1 - nz,
    });
  });

  return portsFromGltfNodeSamples(samples);
}

export async function resolveGlbPortsFromUrl(url: string | undefined): Promise<string> {
  if (!url?.trim()) return autoGlbEquipmentPorts();
  try {
    const ports = await extractGltfPortsFromUrl(url);
    if (ports.length > 0) return formatPorts(ports);
  } catch {
    /* bbox fallback */
  }
  return autoGlbEquipmentPorts();
}
