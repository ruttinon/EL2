import { useMemo } from 'react';
import { Icon } from '@iconify/react';
import type { GraphicSummary } from '@energylink/shared-types';
import type { CurrentTagValue } from '@energylink/graphics-runtime';
import { RuntimeGraphicViewport, normalizeGraphicLayout } from '@energylink/unified-viewport';
import { countScadaWidgets, filterScadaDashboardObjects } from '../scadaDashboard';
import { editorRuntimeApi } from '../../../api/editorRuntimeApi';

export type EditorScadaDashboardViewProps = {
  graphic: GraphicSummary;
  currentValues: CurrentTagValue[];
  onClose: () => void;
};

export function EditorScadaDashboardView({ graphic, currentValues, onClose }: EditorScadaDashboardViewProps) {
  const allObjects = graphic.layout?.objects ?? [];
  const scadaObjects = useMemo(() => filterScadaDashboardObjects(allObjects), [allObjects]);
  const widgetCount = useMemo(() => countScadaWidgets(allObjects), [allObjects]);

  const layout = useMemo(() => {
    if (!graphic.layout) return undefined;
    return normalizeGraphicLayout({
      ...graphic.layout,
      defaultCamera: 'flat',
      objects: scadaObjects,
    });
  }, [graphic.layout, scadaObjects]);

  return (
    <div className="gfx-scada-dashboard-overlay" role="region" aria-label="SCADA dashboard view">
      <div className="gfx-scada-dashboard-head">
        <div className="gfx-scada-dashboard-title">
          <Icon icon="solar:monitor-bold-duotone" width="18" height="18" style={{ color: '#10b981' }} />
          <b>SCADA Dashboard</b>
          <span className="gfx-scada-dashboard-meta">
            {widgetCount} widgets · {currentValues.length} live tags
          </span>
        </div>
        <button type="button" className="btn secondary tiny" onClick={onClose}>
          ← Edit
        </button>
      </div>
      <div className="gfx-scada-dashboard-body">
        {scadaObjects.length === 0 ? (
          <p className="gfx-scada-dashboard-empty">
            ยังไม่มี widget — สลับไปแท็บ SCADA แล้ววาง Gauge, Trend, KPI จาก catalog
          </p>
        ) : (
          <RuntimeGraphicViewport
            width={graphic.width}
            height={graphic.height}
            layout={layout}
            objects={scadaObjects}
            cameraPreset="flat"
            showCameraToolbar={false}
            backgroundColor={layout?.backgroundColor ?? '#0f172a'}
            backgroundImage={layout?.backgroundImage}
            className="gfx-scada-dashboard-viewport"
            stageProps={{
              currentValues,
              alarms: [],
              fetchTrend: async (opts) => {
                const r = await editorRuntimeApi.getTrend(opts);
                return r.ok ? r.data : null;
              },
              refreshIntervalMs: graphic.refreshIntervalMs ?? 2000,
              runtimeMode: true,
              diagramMode: false,
              animate: true,
              wrapClassName: 'gfx-scada-dashboard-wrap',
              stageClassName: 'gfx-scada-dashboard-stage',
            }}
          />
        )}
      </div>
    </div>
  );
}
