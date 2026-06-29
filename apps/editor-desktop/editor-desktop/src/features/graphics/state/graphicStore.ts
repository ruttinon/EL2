import { create } from 'zustand';
import type { UnifiedCameraPreset } from '@energylink/shared-types';

type GraphicEditorUiState = {
  cameraPreset: UnifiedCameraPreset;
  liveOpen: boolean;
  setCameraPreset: (preset: UnifiedCameraPreset) => void;
  setLiveOpen: (open: boolean) => void;
};

export const useGraphicEditorStore = create<GraphicEditorUiState>((set) => ({
  cameraPreset: 'flat',
  liveOpen: false,
  setCameraPreset: (cameraPreset) => set({ cameraPreset }),
  setLiveOpen: (liveOpen) => set({ liveOpen }),
}));
