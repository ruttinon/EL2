import { Icon } from '@iconify/react';
import type { GraphicSummary, GraphicObjectType } from '@energylink/shared-types';
import { GraphicsSceneCatalog } from '../GraphicsSceneCatalog';

interface GraphicsToolPaletteProps {
  isBusy: boolean;
  graphics: GraphicSummary[];
  selectedGraphicId: string | null;
  selectedGraphic: GraphicSummary | undefined;
  paletteTab: string;
  activeTool: string;
  toolCategories: Record<string, { label: string; types: GraphicObjectType[] }>;
  objectTools: Array<{ type: GraphicObjectType; label: string; icon: React.ReactNode; width: number; height: number; text?: string }>;
  images: any[];
  model3dAssets: any[];
  onSelectGraphic: (id: string) => void;
  onNewGraphic: () => void;
  onSetPaletteTab: (tab: string) => void;
  onSetActiveTool: (tool: string) => void;
  onImportImage: () => void;
}

export function GraphicsToolPalette({
  isBusy,
  graphics,
  selectedGraphicId,
  selectedGraphic,
  paletteTab,
  activeTool,
  toolCategories,
  objectTools,
  images,
  model3dAssets,
  onSelectGraphic,
  onNewGraphic,
  onSetPaletteTab,
  onSetActiveTool,
  onImportImage,
}: GraphicsToolPaletteProps) {
  return (
    <aside className="graphics-toolbox card">
      {/* Header section with graphic selector & New button */}
      <div className="toolbox-header-row">
        <span className="section-title-icon-text">
          <Icon icon="solar:palette-bold-duotone" width="18" height="18" style={{ color: '#fb7185' }} />
          <b>Graphics ({graphics.length})</b>
        </span>
      </div>

      <div style={{ padding: '0 10px 8px' }}>
        <button className="btn primary" onClick={onNewGraphic} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '12px', padding: '6px 10px' }}>
          <Icon icon="solar:document-add-bold-duotone" width="16" height="16" style={{ color: '#34d399' }} />
          New Graphic
        </button>
      </div>

      <div className="graphic-list-compact">
        {graphics.map((graphic) => (
          <button
            key={graphic.id}
            className={graphic.id === selectedGraphicId ? 'graphic-list-item-compact selected' : 'graphic-list-item-compact'}
            onClick={() => onSelectGraphic(graphic.id)}
          >
            <div className="graphic-item-main">
              <span className="graphic-item-name">{graphic.name}</span>
              {graphic.isDefault && <span className="default-badge">Default</span>}
            </div>
            <span className="graphic-item-meta">{graphic.width} × {graphic.height} · {graphic.layout?.objects?.length || 0} objects</span>
          </button>
        ))}
        {graphics.length === 0 && <p className="muted" style={{ padding: '0 8px', fontSize: '12px' }}>No graphics in project.</p>}
      </div>

      <div className="toolbox-divider" />

      {/* Symbol tool section (Always visible) */}
      <div className="toolbox-header-row" style={{ marginTop: '8px' }}>
        <span className="section-title-icon-text">
          <Icon icon="solar:tuning-square-bold-duotone" width="18" height="18" style={{ color: '#38bdf8' }} />
          <b>Symbols / Palette</b>
        </span>
      </div>

      <div className="palette-tabs">
        {Object.keys(toolCategories).map((key) => (
          <button
            key={key}
            type="button"
            className={paletteTab === key ? 'palette-tab active' : 'palette-tab'}
            onClick={() => onSetPaletteTab(key)}
          >
            {toolCategories[key].label}
          </button>
        ))}
      </div>

      {selectedGraphic ? (
        <div className="wire-tools-row">
          <button
            type="button"
            className={activeTool === 'wire' ? 'object-tool selected compact' : 'object-tool compact'}
            onClick={() => onSetActiveTool('wire')}
            title="Wire Tool — ต่อ port ระหว่างอุปกรณ์"
          >
            <Icon icon="solar:link-round-bold-duotone" width="18" height="18" style={{ color: '#22d3ee' }} />
            Wire
          </button>
          <button
            type="button"
            className={activeTool === 'cable3d' ? 'object-tool selected compact' : 'object-tool compact'}
            onClick={() => onSetActiveTool('cable3d')}
            title="Cable 3D"
          >
            <Icon icon="solar:link-circle-bold-duotone" width="18" height="18" style={{ color: '#a78bfa' }} />
            Cable
          </button>
        </div>
      ) : null}
      
      {paletteTab === 'scene' ? (
        <GraphicsSceneCatalog
          images={images}
          model3dAssets={model3dAssets}
          onDragStart={() => undefined}
          onImportImage={onImportImage}
        />
      ) : (
        <div className="object-tool-grid">
          <button className={activeTool === 'select' ? 'object-tool selected' : 'object-tool'} onClick={() => onSetActiveTool('select')} disabled={!selectedGraphic}><span><Icon icon="solar:cursor-bold-duotone" width="20" height="20" style={{ color: activeTool === 'select' ? '#38bdf8' : '#0ea5e9' }} /></span>Select</button>
          {objectTools.filter((tool) => toolCategories[paletteTab].types.includes(tool.type)).map((tool) => (
            <button key={tool.type} className={activeTool === tool.type ? 'object-tool selected' : 'object-tool'} onClick={() => onSetActiveTool(tool.type)} disabled={!selectedGraphic}>
              <span>{tool.icon}</span>{tool.label}
            </button>
          ))}
        </div>
      )}
    </aside>
  );
}
