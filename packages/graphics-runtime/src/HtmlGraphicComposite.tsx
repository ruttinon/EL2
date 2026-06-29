import React from 'react';
import type { GraphicObjectDefinition } from '@energylink/shared-types';
import { GraphicStage, type GraphicStageProps } from './GraphicStage';
import { HtmlGraphicPage, type HtmlGraphicPageProps } from './HtmlGraphicPage';
import { resolveAnchoredObjects, type HtmlAnchorMap } from './htmlAnchors';

export type HtmlGraphicCompositeProps = HtmlGraphicPageProps & {
  objects?: GraphicObjectDefinition[];
  overlayStageProps?: Omit<
    GraphicStageProps,
    'width' | 'height' | 'objects' | 'backgroundColor' | 'backgroundImage' | 'currentValues'
  >;
};

/** Full-page HTML background with optional SCADA widget overlay. */
export function HtmlGraphicComposite({
  layout,
  width,
  height,
  objects = [],
  overlayStageProps,
  className = '',
  interactive = true,
  currentValues = [],
  onAnchorsChange: onAnchorsChangeProp,
  ...htmlRest
}: HtmlGraphicCompositeProps) {
  const visibleObjects = objects.filter((o) => o.visible !== false);
  const [anchors, setAnchors] = React.useState<HtmlAnchorMap>(new Map());
  const overlayObjects = React.useMemo(
    () => resolveAnchoredObjects(visibleObjects, anchors),
    [visibleObjects, anchors],
  );
  const hasOverlay = visibleObjects.length > 0;

  const handleAnchorsChange = React.useCallback((next: HtmlAnchorMap) => {
    setAnchors(next);
    onAnchorsChangeProp?.(next);
  }, [onAnchorsChangeProp]);

  return (
    <div
      className={`rt-html-composite${className ? ` ${className}` : ''}`}
      style={{ position: 'relative', width, height, overflow: 'hidden' }}
    >
      <HtmlGraphicPage
        layout={layout}
        width={width}
        height={height}
        currentValues={currentValues}
        interactive={interactive}
        className="rt-html-composite-bg"
        onAnchorsChange={handleAnchorsChange}
        pickedAnchors={layout.externalPage?.pickedAnchors ?? []}
        {...htmlRest}
      />
      {hasOverlay ? (
        <div className="rt-html-composite-overlay" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          <GraphicStage
            width={width}
            height={height}
            backgroundColor="transparent"
            backgroundImage={null}
            objects={overlayObjects}
            currentValues={currentValues}
            alarms={overlayStageProps?.alarms ?? []}
            fetchTrend={overlayStageProps?.fetchTrend ?? (async () => null)}
            runtimeMode={overlayStageProps?.runtimeMode ?? true}
            animate={overlayStageProps?.animate ?? true}
            onWriteTag={overlayStageProps?.onWriteTag ?? htmlRest.onWriteTag}
            onNavigate={overlayStageProps?.onNavigate}
            onAcknowledge={overlayStageProps?.onAcknowledge}
            refreshIntervalMs={overlayStageProps?.refreshIntervalMs}
            fitViewport={overlayStageProps?.fitViewport}
            diagramMode={overlayStageProps?.diagramMode}
            wrapClassName={overlayStageProps?.wrapClassName ?? 'rt-html-overlay-wrap'}
            stageClassName={overlayStageProps?.stageClassName ?? 'rt-html-overlay-stage'}
            emptyMessage={overlayStageProps?.emptyMessage}
            activeFloor={overlayStageProps?.activeFloor}
            navigationBar={overlayStageProps?.navigationBar}
          />
        </div>
      ) : null}
    </div>
  );
}
