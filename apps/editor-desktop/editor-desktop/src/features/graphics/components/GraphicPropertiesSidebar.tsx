import type { ReactNode } from 'react';
import { Icon } from '@iconify/react';
import type { GraphicObjectDefinition, GraphicSummary } from '@energylink/shared-types';
import { GraphicsLayerPanel } from '../GraphicsLayerPanel';
import { GraphicsHistoryPanel } from '../GraphicsHistoryPanel';
import { SceneScriptPanel } from '../SceneScriptPanel';
import { GraphicCanvasPropertiesPanel } from './GraphicCanvasPropertiesPanel';
import type { GraphicLayoutSnapshot } from '@energylink/shared-types';
import type { UnifiedCameraPreset } from '@energylink/shared-types';

export type PropTab = 'element' | 'layers' | 'canvas' | 'script' | 'history';

type CanvasImage = { id: string; name: string; dataUrl: string };

export type GraphicPropertiesSidebarProps = {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  propTab: PropTab;
  onPropTabChange: (tab: PropTab) => void;
  selectedGraphic: GraphicSummary;
  selectedObject: GraphicObjectDefinition | null;
  selectedObjectId: string;
  images: CanvasImage[];
  gridEnabled: boolean;
  cameraPreset: UnifiedCameraPreset;
  isBusy: boolean;
  snapshots: GraphicLayoutSnapshot[];
  onLivePreview: () => void;
  onGridChange: (enabled: boolean) => void;
  onCameraChange: (preset: UnifiedCameraPreset) => void;
  onUpdateGraphic: (updater: (graphic: GraphicSummary) => GraphicSummary) => void;
  syncScene3dObjects: (objects: GraphicObjectDefinition[], width: number, height: number) => GraphicObjectDefinition[];
  onSelectObject: (id: string) => void;
  onToggleVisible: (id: string) => void;
  onMoveLayer: (id: string, direction: 'up' | 'down') => void;
  onRestoreSnapshot: (snapshot: GraphicLayoutSnapshot) => void;
  onDeleteSnapshot: (snapshotId: string) => void;
  onRunSceneScript: (json: string, mode: 'replace' | 'merge') => void;
  onDownloadBlender: () => void;
  elementPanel: ReactNode;
};

export function GraphicPropertiesSidebar({
  collapsed,
  onToggleCollapsed,
  propTab,
  onPropTabChange,
  selectedGraphic,
  selectedObject,
  selectedObjectId,
  images,
  gridEnabled,
  cameraPreset,
  isBusy,
  snapshots,
  onLivePreview,
  onGridChange,
  onCameraChange,
  onUpdateGraphic,
  syncScene3dObjects,
  onSelectObject,
  onToggleVisible,
  onMoveLayer,
  onRestoreSnapshot,
  onDeleteSnapshot,
  onRunSceneScript,
  onDownloadBlender,
  elementPanel,
}: GraphicPropertiesSidebarProps) {
  return (
    <aside className="graphics-properties card">
      <div className="gfx-panel-collapse-head">
        <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0, padding: 0, border: 'none', background: 'transparent' }}>
          <Icon icon="solar:settings-minimalistic-bold-duotone" width="18" height="18" style={{ color: '#0ea5e9' }} />
          Properties
        </div>
        <button type="button" className="gfx-panel-toggle" onClick={onToggleCollapsed} title={collapsed ? 'Expand properties' : 'Collapse properties'}>
          <Icon icon={collapsed ? 'solar:alt-arrow-left-bold' : 'solar:alt-arrow-right-bold'} width="14" height="14" />
        </button>
      </div>

      <div className="prop-side-tabs prop-side-tabs-primary">
        <button type="button" className={propTab === 'element' ? 'active' : ''} onClick={() => onPropTabChange('element')} disabled={!selectedObject} title="คุณสมบัติวัตถุที่เลือก">Element</button>
        <button type="button" className={propTab === 'layers' ? 'active' : ''} onClick={() => onPropTabChange('layers')} title="จัดการ layer">Layers</button>
        <button type="button" className={propTab === 'canvas' ? 'active' : ''} onClick={() => onPropTabChange('canvas')} title="ขนาดและพื้นหลัง canvas">Canvas</button>
      </div>
      <div className="prop-side-tabs prop-side-tabs-secondary">
        <button type="button" className={propTab === 'script' ? 'active' : ''} onClick={() => onPropTabChange('script')}>Script</button>
        <button type="button" className={propTab === 'history' ? 'active' : ''} onClick={() => onPropTabChange('history')}>History</button>
        <button type="button" className="gfx-live-tab-btn" onClick={onLivePreview} title="เปิด Live runtime ในหน้าต่างเต็มจอ">Live Preview…</button>
      </div>

      {selectedObject && propTab === 'element' ? (
        <div className="gfx-prop-selection-banner">
          <Icon icon="solar:cursor-bold-duotone" width="14" height="14" />
          <span>{selectedObject.name}</span>
          <span className="gfx-prop-type">{selectedObject.type}</span>
        </div>
      ) : null}

      <div className="gfx-props-scroll">
        {propTab === 'layers' ? (
          <GraphicsLayerPanel
            objects={selectedGraphic.layout?.objects || []}
            selectedObjectId={selectedObjectId}
            onSelect={onSelectObject}
            onToggleVisible={onToggleVisible}
            onMoveLayer={onMoveLayer}
          />
        ) : null}

        {propTab === 'history' ? (
          <GraphicsHistoryPanel snapshots={snapshots} onRestore={onRestoreSnapshot} onDelete={onDeleteSnapshot} />
        ) : null}

        {propTab === 'script' ? (
          <SceneScriptPanel
            disabled={!selectedGraphic}
            busy={isBusy}
            onRun={onRunSceneScript}
            onDownloadBlender={onDownloadBlender}
          />
        ) : null}

        {propTab === 'canvas' ? (
          <GraphicCanvasPropertiesPanel
            graphic={selectedGraphic}
            images={images}
            gridEnabled={gridEnabled}
            cameraPreset={cameraPreset}
            onGridChange={onGridChange}
            onCameraChange={onCameraChange}
            onUpdateGraphic={onUpdateGraphic}
            syncScene3dObjects={syncScene3dObjects}
          />
        ) : null}

        {propTab === 'element' ? elementPanel : null}
      </div>
    </aside>
  );
}
