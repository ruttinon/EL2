import { Icon } from '@iconify/react';
import { useRef, useState } from 'react';
import { CameraToolbar } from '@energylink/unified-viewport';
import type { UnifiedCameraPreset } from '@energylink/shared-types';
import type { GraphicSummary } from '@energylink/shared-types';
import { GraphicEditorDebugBar } from './GraphicEditorDebugBar';
import type { ViewportDebugFlags } from '../editorViewportDebug';

export type EditorViewMode = 'canvas' | 'logic' | 'dashboard';

export type GraphicEditorToolbarProps = {
  selectedGraphic: GraphicSummary | null;
  isBusy: boolean;
  editorViewMode: EditorViewMode;
  onEditorViewModeChange: (mode: EditorViewMode) => void;
  viewportDebug: ViewportDebugFlags;
  onViewportDebugChange: (patch: Partial<ViewportDebugFlags>) => void;
  cameraPreset: UnifiedCameraPreset;
  gridEnabled: boolean;
  snap3dEnabled: boolean;
  canvasZoom: number;
  liveModalOpen: boolean;
  onSave: () => void;
  onValidate: () => void;
  onSetDefault: () => void;
  onExport: () => void;
  onImportFile: (file: File) => void | Promise<void>;
  onCameraChange: (preset: UnifiedCameraPreset) => void;
  onToggleGrid: () => void;
  onToggleSnap3d: () => void;
  onZoomOut: () => void;
  onZoomIn: () => void;
  onFitZoom: () => void;
  onLivePreview: () => void;
  onRefresh: () => void;
  onDelete: () => void;
};

export function GraphicEditorToolbar({
  selectedGraphic,
  isBusy,
  editorViewMode,
  onEditorViewModeChange,
  viewportDebug,
  onViewportDebugChange,
  cameraPreset,
  gridEnabled,
  snap3dEnabled,
  canvasZoom,
  liveModalOpen,
  onSave,
  onValidate,
  onSetDefault,
  onExport,
  onImportFile,
  onCameraChange,
  onToggleGrid,
  onToggleSnap3d,
  onZoomOut,
  onZoomIn,
  onFitZoom,
  onLivePreview,
  onRefresh,
  onDelete,
}: GraphicEditorToolbarProps) {
  const importInputRef = useRef<HTMLInputElement>(null);
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <div className="gfx-designer-header gfx-designer-header-compact">
      <div className="gfx-header-row gfx-header-main">
        <div className="gfx-doc-title">
          <Icon icon="solar:palette-bold-duotone" width="18" height="18" style={{ color: '#fb7185', flexShrink: 0 }} />
          <b title={selectedGraphic?.name}>{selectedGraphic?.name || 'No Graphic'}</b>
          {selectedGraphic ? (
            <span className="gfx-doc-meta">
              {selectedGraphic.width}×{selectedGraphic.height} · {selectedGraphic.layout?.objects?.length ?? 0} obj
            </span>
          ) : (
            <span className="gfx-doc-meta">เลือกหรือสร้าง Graphic</span>
          )}
        </div>

        {selectedGraphic ? (
          <>
            <div className="gfx-view-tabs" role="tablist" aria-label="มุมมอง">
              <button
                type="button"
                role="tab"
                aria-selected={editorViewMode === 'canvas'}
                className={`gfx-view-tab${editorViewMode === 'canvas' ? ' active' : ''}`}
                onClick={() => onEditorViewModeChange('canvas')}
              >
                <Icon icon="solar:pen-new-square-bold-duotone" width="16" height="16" />
                แก้ไข
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={editorViewMode === 'dashboard'}
                className={`gfx-view-tab${editorViewMode === 'dashboard' ? ' active' : ''}`}
                onClick={() => onEditorViewModeChange('dashboard')}
                title="ดู SCADA widgets แบบ operator"
              >
                <Icon icon="solar:monitor-bold-duotone" width="16" height="16" />
                ดูตัวอย่าง
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={editorViewMode === 'logic'}
                className={`gfx-view-tab${editorViewMode === 'logic' ? ' active' : ''}`}
                onClick={() => onEditorViewModeChange('logic')}
                title="Logic Flow — wire / cable"
              >
                <Icon icon="solar:diagram-up-bold-duotone" width="16" height="16" />
                Logic
              </button>
            </div>

            <div className="gfx-tool-groups gfx-tool-groups-compact">
              <button type="button" className="btn primary tiny" onClick={onSave} disabled={isBusy} title="Save">
                <Icon icon="solar:diskette-bold-duotone" width="14" height="14" />
                Save
              </button>
              <CameraToolbar value={cameraPreset} onChange={onCameraChange} />
              <button type="button" className={`btn secondary tiny${gridEnabled ? ' active' : ''}`} onClick={onToggleGrid} title="Grid">Grid</button>
              <div className="gfx-zoom-cluster">
                <button type="button" className="btn secondary tiny" onClick={onZoomOut}>−</button>
                <span>{Math.round(canvasZoom * 100)}%</span>
                <button type="button" className="btn secondary tiny" onClick={onZoomIn}>+</button>
                <button type="button" className="btn secondary tiny" onClick={onFitZoom}>Fit</button>
              </div>
              <div className="gfx-more-menu">
                <button type="button" className="btn secondary tiny" onClick={() => setMoreOpen((v) => !v)}>
                  เพิ่มเติม ▾
                </button>
                {moreOpen ? (
                  <div className="gfx-more-dropdown">
                    <button type="button" className="gfx-more-item" onClick={() => { onValidate(); setMoreOpen(false); }}>Validate</button>
                    <button type="button" className="gfx-more-item" onClick={() => { onSetDefault(); setMoreOpen(false); }}>Set default</button>
                    <button type="button" className="gfx-more-item" onClick={() => { onExport(); setMoreOpen(false); }}>Export</button>
                    <button type="button" className="gfx-more-item" onClick={() => { importInputRef.current?.click(); setMoreOpen(false); }}>Import</button>
                    <button type="button" className={`gfx-more-item${liveModalOpen ? ' active' : ''}`} onClick={() => { onLivePreview(); setMoreOpen(false); }}>Live preview</button>
                    <button type="button" className="gfx-more-item" onClick={() => { onToggleSnap3d(); }}>Snap 3D {snap3dEnabled ? '✓' : ''}</button>
                    <button type="button" className="gfx-more-item" onClick={() => { onRefresh(); setMoreOpen(false); }}>Refresh data</button>
                    <button type="button" className="gfx-more-item danger" onClick={() => { onDelete(); setMoreOpen(false); }}>Delete</button>
                    <div className="gfx-more-debug">
                      <span className="gfx-more-debug-label">Layer debug</span>
                      <GraphicEditorDebugBar debug={viewportDebug} onChange={onViewportDebugChange} />
                    </div>
                  </div>
                ) : null}
              </div>
              <input
                ref={importInputRef}
                type="file"
                accept=".json,.graphic.json,application/json"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  void Promise.resolve(onImportFile(file)).finally(() => {
                    if (importInputRef.current) importInputRef.current.value = '';
                  });
                }}
              />
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
