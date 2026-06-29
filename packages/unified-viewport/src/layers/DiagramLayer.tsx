import React from 'react';
import { GraphicStage, type FetchTrendFn, type WriteTagOptions } from '@energylink/graphics-runtime';
import type { CurrentTagValue, RuntimeAlarm } from '@energylink/graphics-runtime';
import type { GraphicObjectDefinition } from '@energylink/shared-types';

export type DiagramLayerProps = {
  width: number;
  height: number;
  objects: GraphicObjectDefinition[];
  backgroundColor?: string;
  backgroundImage?: string | null;
  currentValues?: CurrentTagValue[];
  alarms?: RuntimeAlarm[];
  fetchTrend: FetchTrendFn;
  refreshIntervalMs?: number;
  runtimeMode?: boolean;
  /** When true, GraphicStage receives pointer events (Run mode / live preview interactions). */
  interactive?: boolean;
  animate?: boolean;
  emptyMessage?: string;
  stageClassName?: string;
  className?: string;
  onWriteTag?: (tagId: string, tagName: string, dataType: string, options?: WriteTagOptions) => void;
  /** When true, overlay layer ignores pointer events except on widget bounds (HTML composite pages). */
  pointerPassthrough?: boolean;
  onNavigate?: (graphicId: string) => void;
  /** Floor filter for zone3d / multi-floor widgets. */
  activeFloor?: number | null;
  resolveAssetRef?: (ref: string) => string;
};

/** Shared diagram renderer — GraphicStage wrapper for editor + runtime parity */
export function DiagramLayer({
  width,
  height,
  objects,
  backgroundColor = '#fbfdff',
  backgroundImage,
  currentValues = [],
  alarms = [],
  fetchTrend,
  refreshIntervalMs = 10000,
  runtimeMode = false,
  interactive = false,
  animate = false,
  emptyMessage,
  stageClassName = 'uv-diagram-stage-inner',
  className,
  onWriteTag,
  onNavigate,
  pointerPassthrough = false,
  activeFloor = null,
  resolveAssetRef,
}: DiagramLayerProps) {
  const pointerEvents = pointerPassthrough ? 'none' : (interactive ? 'auto' : 'none');
  return (
    <div
      className={className ?? 'uv-diagram-layer-stage'}
      style={{ position: 'absolute', inset: 0, pointerEvents }}
    >
      <GraphicStage
        width={width}
        height={height}
        backgroundColor={backgroundColor}
        backgroundImage={backgroundImage}
        objects={objects}
        currentValues={currentValues}
        alarms={alarms}
        activeFloor={activeFloor}
        fetchTrend={fetchTrend}
        refreshIntervalMs={refreshIntervalMs}
        runtimeMode={runtimeMode}
        animate={animate}
        emptyMessage={emptyMessage}
        wrapClassName="uv-diagram-stage-wrap"
        stageClassName={stageClassName}
        onWriteTag={onWriteTag}
        onNavigate={onNavigate}
        resolveAssetRef={resolveAssetRef}
      />
    </div>
  );
}
