import type { GraphicObjectDefinition } from '@energylink/shared-types';

export const MIN_OBJECT_SIZE = 12;

export type DisplayMode = 'text' | 'image';

/** Extra fields stored locally on objects (not in shared-type binding) */
export interface ObjectDisplayExtra {
  displayMode?: DisplayMode;
  imageId?: string;
  imageDataUrl?: string;
}

export type ExtendedObject = GraphicObjectDefinition & ObjectDisplayExtra & {
  navigateTo?: string;
  tagIds?: string[];
  deviceId?: string;
  flowTagId?: string;
  enableTagId?: string;
};

export function getExtra(obj: GraphicObjectDefinition): ObjectDisplayExtra {
  const o = obj as ExtendedObject;
  return {
    displayMode: o.displayMode,
    imageId: o.imageId,
    imageDataUrl: o.imageDataUrl,
  };
}
