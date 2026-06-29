import type { GraphicObjectDefinition } from '@energylink/shared-types';

export function styleNum(obj: GraphicObjectDefinition, key: string, fallback: number): number {
  const v = obj.style?.[key];
  return typeof v === 'number' ? v : fallback;
}

export function styleStr(obj: GraphicObjectDefinition, key: string, fallback: string): string {
  const v = obj.style?.[key];
  return typeof v === 'string' ? v : fallback;
}

export function styleBool(obj: GraphicObjectDefinition, key: string, fallback: boolean): boolean {
  const v = obj.style?.[key];
  return typeof v === 'boolean' ? v : fallback;
}

export async function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('read failed'));
    reader.readAsDataURL(file);
  });
}

export type StylePatch = Record<string, string | number | boolean | undefined>;

export function mergeStyle(
  obj: GraphicObjectDefinition,
  patch: StylePatch,
  opts?: { barType?: boolean },
): StylePatch {
  const next = { ...patch };
  const barType = opts?.barType ?? false;
  if (typeof next.fill === 'string' && !barType) next.background = next.fill;
  if (typeof next.background === 'string' && next.fill === undefined && !barType) next.fill = next.background;
  if (typeof next.stroke === 'string') next.borderColor = next.stroke;
  return { ...obj.style, ...next };
}
