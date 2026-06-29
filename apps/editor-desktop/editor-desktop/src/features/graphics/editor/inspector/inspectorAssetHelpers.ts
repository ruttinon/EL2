import type { GraphicObjectDefinition } from '@energylink/shared-types';
import { readAsDataUrl } from './inspectorUtils';

export async function pickStyleAsset(
  selected: GraphicObjectDefinition,
  styleKey: string,
  file: File | null | undefined,
  onUpdate: (id: string, patch: Partial<GraphicObjectDefinition>) => void,
): Promise<void> {
  if (!file) return;
  const dataUrl = await readAsDataUrl(file);
  const patch: Record<string, string | number | boolean | undefined> = { [styleKey]: dataUrl };
  if (styleKey === 'fillImage') patch.valueDisplayMode = 'image';
  if (styleKey === 'stateOnImage') {
    patch.designPreviewValue = 1;
    patch.valueDisplayMode = 'image';
  }
  if (styleKey === 'stateOffImage') {
    patch.designPreviewValue = 0;
    patch.valueDisplayMode = 'image';
  }
  if (styleKey === 'stateOnGlb' || styleKey === 'stateOffGlb') {
    patch.valueDisplayMode = 'model3d';
    if (styleKey === 'stateOnGlb') patch.designPreviewValue = 1;
    if (styleKey === 'stateOffGlb') patch.designPreviewValue = 0;
  }
  onUpdate(selected.id, { style: { ...selected.style, ...patch } });
}

export function clearStyleAsset(
  selected: GraphicObjectDefinition,
  styleKey: string,
  onUpdate: (id: string, patch: Partial<GraphicObjectDefinition>) => void,
): void {
  const nextStyle = { ...selected.style };
  delete (nextStyle as Record<string, unknown>)[styleKey];
  if (styleKey === 'fillImage') nextStyle.valueDisplayMode = 'classic';
  onUpdate(selected.id, { style: nextStyle });
}
