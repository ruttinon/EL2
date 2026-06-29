import { useState } from 'react';
import { Hand, MousePointer2 } from 'lucide-react';
import type { DeviceSummary } from '@energylink/shared-types';
import { WidgetLibrary, type ActiveTool } from './ToolRail';
import { DevicePalette } from './DevicePalette';
import { AssetLibraryPanel } from './AssetLibraryPanel';

type DockTab = 'widgets' | 'devices' | 'assets';

const TABS: { id: DockTab; label: string }[] = [
  { id: 'widgets', label: 'Widgets' },
  { id: 'devices', label: 'Devices' },

  { id: 'assets', label: 'Media' },
];

export type EditorLeftDockProps = {
  activeTool: ActiveTool;
  onPickTool: (tool: ActiveTool) => void;
  disabled?: boolean;
  devices: DeviceSummary[];
  onAssetsChange?: () => void;
};

export function EditorLeftDock(props: EditorLeftDockProps) {
  const {
    activeTool,
    onPickTool,
    disabled,
    devices,
    onAssetsChange,
  } = props;

  const [tab, setTab] = useState<DockTab>('widgets');

  return (
    <aside className={`eld-dock${disabled ? ' eld-disabled' : ''}`}>
      <div className="eld-head">
        <div className="eld-modes">
          <button
            type="button"
            className={`eld-mode-btn${activeTool === 'select' ? ' active' : ''}`}
            title="Select (V)"
            onClick={() => onPickTool('select')}
          >
            <MousePointer2 size={18} />
          </button>
          <button
            type="button"
            className={`eld-mode-btn${activeTool === 'pan' ? ' active' : ''}`}
            title="Pan (H)"
            onClick={() => onPickTool('pan')}
          >
            <Hand size={18} />
          </button>
        </div>
        <div className="eld-tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={tab === t.id ? 'active' : ''}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="eld-panel" role="tabpanel">
        {tab === 'widgets' ? (
          <WidgetLibrary activeTool={activeTool} onPickTool={onPickTool} />
        ) : null}
        {tab === 'devices' ? (
          <DevicePalette
            variant="embedded"
            devices={devices}
            activeTool={activeTool}
            onPickTool={onPickTool}
            disabled={disabled}
          />
        ) : null}

        {tab === 'assets' ? (
          <AssetLibraryPanel onAssetsChange={onAssetsChange} />
        ) : null}
      </div>
    </aside>
  );
}

export default EditorLeftDock;
