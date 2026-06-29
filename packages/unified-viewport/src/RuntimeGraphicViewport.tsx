import React from 'react';
import { UnifiedViewport } from './UnifiedViewport';
import { CameraToolbar } from './camera/CameraToolbar';
import type { GraphicStageProps } from '@energylink/graphics-runtime';
import type { GraphicLayout, UnifiedCameraPreset } from '@energylink/shared-types';

/** Drop-in runtime wrapper — replaces GraphicStage when using unified frame */
export type RuntimeGraphicViewportProps = {
  width: number;
  height: number;
  layout?: GraphicLayout;
  objects: GraphicStageProps['objects'];
  cameraPreset?: UnifiedCameraPreset;
  onCameraChange?: (preset: UnifiedCameraPreset) => void;
  showCameraToolbar?: boolean;
  activeFloor?: number | null;
  stageProps: Omit<
    GraphicStageProps,
    'width' | 'height' | 'objects' | 'backgroundColor' | 'backgroundImage' | 'activeFloor'
  >;
  backgroundColor?: string;
  backgroundImage?: string | null;
  className?: string;
};

export function RuntimeGraphicViewport({
  width,
  height,
  layout,
  objects,
  cameraPreset: cameraProp,
  onCameraChange,
  showCameraToolbar = true,
  activeFloor,
  stageProps,
  backgroundColor,
  backgroundImage,
  className,
}: RuntimeGraphicViewportProps) {
  const [camera, setCamera] = React.useState<UnifiedCameraPreset>(
    cameraProp ?? layout?.defaultCamera ?? 'flat',
  );

  React.useEffect(() => {
    if (cameraProp) setCamera(cameraProp);
    else if (layout?.defaultCamera) setCamera(layout.defaultCamera);
  }, [cameraProp, layout?.defaultCamera]);

  function handleCamera(next: UnifiedCameraPreset) {
    setCamera(next);
    onCameraChange?.(next);
  }

  return (
    <div className={className}>
      {showCameraToolbar ? (
        <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'flex-end' }}>
          <CameraToolbar value={camera} onChange={handleCamera} />
        </div>
      ) : null}
      <UnifiedViewport
        mode="runtime"
        width={width}
        height={height}
        layout={layout}
        objects={objects ?? []}
        cameraPreset={camera}
        backgroundColor={backgroundColor}
        backgroundImage={backgroundImage}
        activeFloor={activeFloor}
        stageProps={stageProps}
      />
    </div>
  );
}
