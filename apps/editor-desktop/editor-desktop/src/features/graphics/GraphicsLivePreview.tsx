import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  GraphicNavigationBar,
  useGraphicNavigation,
  collectFloorLevels,
} from '@energylink/graphics-runtime';
import type { CurrentTagValue, RuntimeAlarm } from '@energylink/graphics-runtime';
import type { GraphicSummary, UnifiedCameraPreset } from '@energylink/shared-types';
import { RuntimeGraphicViewport, normalizeGraphicLayout } from '@energylink/unified-viewport';
import { editorRuntimeApi } from '../../api/editorRuntimeApi';
import { FullscreenPanel } from '../../components/FullscreenPanel';

export function GraphicsLivePreview({
  graphic,
  graphics = [],
}: {
  graphic: GraphicSummary | null;
  graphics?: GraphicSummary[];
}) {
  const [values, setValues] = useState<CurrentTagValue[]>([]);
  const [alarms, setAlarms] = useState<RuntimeAlarm[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(true);
  const [diagramMode, setDiagramMode] = useState(false);
  const [activeFloor, setActiveFloor] = useState<number | null>(null);
  const [cameraPreset, setCameraPreset] = useState<UnifiedCameraPreset>('flat');
  const [fullscreen, setFullscreen] = useState(false);
  const [displayGraphic, setDisplayGraphic] = useState<GraphicSummary | null>(graphic);
  const nav = useGraphicNavigation(graphic?.id ?? '');

  const layout = useMemo(
    () => (displayGraphic?.layout ? normalizeGraphicLayout(displayGraphic.layout) : undefined),
    [displayGraphic?.layout],
  );

  useEffect(() => {
    setDisplayGraphic(graphic);
    if (graphic?.id) nav.reset(graphic.id);
    setActiveFloor(null);
    const normalized = graphic?.layout ? normalizeGraphicLayout(graphic.layout) : undefined;
    setCameraPreset(normalized?.defaultCamera ?? 'flat');
  }, [graphic?.id]);

  useEffect(() => {
    if (!nav.currentId) return;
    if (nav.currentId === graphic?.id) {
      setDisplayGraphic(graphic);
      return;
    }
    const found = graphics.find((g) => g.id === nav.currentId);
    if (found) setDisplayGraphic(found);
  }, [nav.currentId, graphic, graphics]);

  const refresh = useCallback(async () => {
    const [cRes, aRes] = await Promise.all([editorRuntimeApi.getCurrentValues(), editorRuntimeApi.getAlarms()]);
    if (cRes.ok) {
      setValues(cRes.data.values ?? []);
      setError(null);
    } else {
      setError(cRes.message);
    }
    if (aRes.ok) setAlarms(aRes.data.alarms ?? []);
  }, []);

  useEffect(() => {
    void refresh();
    if (!live || !displayGraphic) return undefined;
    const ms = Math.max(1000, displayGraphic.refreshIntervalMs ?? 2000);
    const timer = window.setInterval(() => void refresh(), ms);
    return () => window.clearInterval(timer);
  }, [live, displayGraphic, displayGraphic?.refreshIntervalMs, refresh]);

  const objects = layout?.objects ?? [];
  const floors = useMemo(() => collectFloorLevels(objects), [objects]);
  const stackLabels = nav.stack.map(
    (id) => graphics.find((g) => g.id === id)?.name ?? displayGraphic?.name ?? id.slice(-6),
  );

  if (!displayGraphic) {
    return <div className="graphics-live-preview empty">Select a graphic to preview.</div>;
  }

  return (
    <div className="graphics-live-preview card">
      <div className="graphics-live-preview-header">
        <b>Live Preview</b>
        <span className="muted" style={{ fontSize: 11 }}>
          {values.length} tags · {alarms.filter((a) => a.status === 'active').length} alarms
        </span>
        <label className="live-preview-toggle">
          <input type="checkbox" checked={live} onChange={(e) => setLive(e.target.checked)} />
          Auto-refresh
        </label>
        <button type="button" className="btn secondary tiny" onClick={() => void refresh()}>
          Refresh
        </button>
        <button type="button" className={`btn secondary tiny${diagramMode ? ' active' : ''}`} onClick={() => setDiagramMode((v) => !v)}>
          Diagram
        </button>
      </div>
      {error && <div className="alert error" style={{ margin: '8px 10px', fontSize: 12 }}>{error}</div>}
      <FullscreenPanel
        className="graphics-live-fullscreen-panel"
        label="ดู Live เต็มจอ — สลับมุมกล้อง Monitor / Top / Orbit"
        onFullscreenChange={setFullscreen}
      >
        <div className={`graphics-live-preview-stage${fullscreen ? ' is-fullscreen-stage' : ''}`}>
          <RuntimeGraphicViewport
            width={displayGraphic.width}
            height={displayGraphic.height}
            layout={layout}
            objects={objects}
            cameraPreset={cameraPreset}
            onCameraChange={setCameraPreset}
            activeFloor={activeFloor}
            backgroundColor={layout?.backgroundColor ?? '#fbfdff'}
            backgroundImage={layout?.backgroundImage}
            className="graphics-live-runtime-viewport"
            stageProps={{
              currentValues: values,
              alarms,
              onNavigate: (gid) => nav.push(gid),
              fetchTrend: async (opts) => {
                const r = await editorRuntimeApi.getTrend(opts);
                return r.ok ? r.data : null;
              },
              onAcknowledge: async (id) => {
                await editorRuntimeApi.acknowledgeAlarm(id);
                await refresh();
              },
              refreshIntervalMs: displayGraphic.refreshIntervalMs ?? 2000,
              diagramMode,
              runtimeMode: true,
              fitViewport: fullscreen && !diagramMode,
              wrapClassName: 'graphic-live-preview-wrap',
              stageClassName: 'graphic-live-preview-stage-inner',
              animate: false,
              navigationBar: (
                <GraphicNavigationBar
                  canGoBack={nav.canGoBack}
                  onBack={() => nav.pop()}
                  currentLabel={displayGraphic.name}
                  stackLabels={stackLabels}
                  floors={floors}
                  activeFloor={activeFloor}
                  onFloorChange={setActiveFloor}
                />
              ),
            }}
          />
        </div>
      </FullscreenPanel>
    </div>
  );
}
