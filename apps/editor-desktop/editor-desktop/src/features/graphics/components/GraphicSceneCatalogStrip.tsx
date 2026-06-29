import { Icon } from '@iconify/react';
import {
  SCENE_CATALOG_MIME,
  SCENE_CATALOG_PRESETS,
  type SceneCatalogDropPayload,
  type SceneCatalogImage,
} from '../GraphicsSceneCatalog';

export type CatalogStripCategory = 'equipment' | 'routing' | 'charts';

export type CatalogStripItem =
  | { id: string; label: string; sub: string; icon: string; color: string; kind: 'payload'; payload: SceneCatalogDropPayload }
  | { id: string; label: string; sub: string; icon: string; color: string; kind: 'tool'; tool: 'wire' }
  | { id: string; label: string; sub: string; icon: string; color: string; kind: 'action'; action: 'autoRoute' | 'live' };

const EQUIPMENT_IDS = new Set([
  'floor-tile', 'meter-panel', 'breaker', 'transformer', 'motor', 'ats-switch',
  'generator', 'disconnect',
]);
const ROUTING_IDS = new Set(['power-line']);
const CHART_IDS = new Set(['echart-line', 'echart-bar', 'echart-pie', 'gauge-speedometer']);

const STRIP_TOOLS: CatalogStripItem[] = [
  { id: 'tool-wire', label: 'Wire', sub: 'port→port', icon: 'solar:link-round-bold-duotone', color: '#22d3ee', kind: 'tool', tool: 'wire' },
  { id: 'action-route', label: 'Auto Route', sub: 'เชื่อมอุปกรณ์', icon: 'solar:routing-2-bold-duotone', color: '#d4af37', kind: 'action', action: 'autoRoute' },
  { id: 'action-live', label: 'Live', sub: 'preview', icon: 'solar:play-circle-bold-duotone', color: '#10b981', kind: 'action', action: 'live' },
];

function presetItems(category: CatalogStripCategory): CatalogStripItem[] {
  const pick = (ids: Set<string>) =>
    SCENE_CATALOG_PRESETS.filter((p) => ids.has(p.id)).map((p) => ({
      id: p.id,
      label: p.label,
      sub: p.payload.kind === 'type' ? p.payload.type : p.payload.kind,
      icon: p.icon,
      color: p.color,
      kind: 'payload' as const,
      payload: p.payload,
    }));

  if (category === 'equipment') return [...pick(EQUIPMENT_IDS)];
  if (category === 'routing') return [...pick(ROUTING_IDS), ...STRIP_TOOLS.filter((t) => t.kind !== 'action' || t.action === 'autoRoute')];
  return [...pick(CHART_IDS), ...STRIP_TOOLS.filter((t) => t.kind === 'action' && t.action === 'live')];
}

const CATEGORIES: Array<{ id: CatalogStripCategory; label: string }> = [
  { id: 'equipment', label: 'อุปกรณ์' },
  { id: 'routing', label: 'เส้นไฟ' },
  { id: 'charts', label: 'กราฟ' },
];

export type GraphicSceneCatalogStripProps = {
  category: CatalogStripCategory;
  onCategoryChange: (cat: CatalogStripCategory) => void;
  armedPayloadId: string | null;
  armedToolId: string | null;
  images: SceneCatalogImage[];
  disabled?: boolean;
  variant?: 'strip' | 'panel';
  onArmPayload: (id: string, payload: SceneCatalogDropPayload, label: string) => void;
  onArmTool: (id: string, tool: 'wire', label: string) => void;
  onDisarm: () => void;
  onAction: (action: 'autoRoute' | 'live') => void;
};

export function GraphicSceneCatalogStrip({
  category,
  onCategoryChange,
  armedPayloadId,
  armedToolId,
  images,
  disabled,
  onArmPayload,
  onArmTool,
  onDisarm,
  onAction,
  variant = 'strip',
}: GraphicSceneCatalogStripProps) {
  const items = presetItems(category);

  const assetCards: CatalogStripItem[] = images.slice(0, 8).map((img) => ({
    id: `img-${img.id}`,
    label: img.name,
    sub: 'image',
    icon: 'solar:gallery-bold-duotone',
    color: '#10b981',
    kind: 'payload' as const,
    payload: { kind: 'image' as const, name: img.name, dataUrl: img.dataUrl, realWidthMm: 800, realHeightMm: 600 },
  }));

  const allItems = category === 'equipment' ? [...items, ...assetCards] : items;

  function handleDrag(e: React.DragEvent, payload: SceneCatalogDropPayload) {
    e.dataTransfer.setData(SCENE_CATALOG_MIME, JSON.stringify(payload));
    e.dataTransfer.effectAllowed = 'copy';
  }

  const cardGrid = (
    <div className={variant === 'panel' ? 'gfx-catalog-panel-items' : 'gfx-catalog-strip-items'}>
      {allItems.map((item) => {
        const active =
          item.kind === 'payload'
            ? armedPayloadId === item.id
            : item.kind === 'tool'
              ? armedToolId === item.id
              : false;
        return (
          <button
            key={item.id}
            type="button"
            className={`gfx-catalog-card${active ? ' armed' : ''}`}
            disabled={disabled}
            draggable={item.kind === 'payload'}
            onDragStart={item.kind === 'payload' ? (e) => handleDrag(e, item.payload) : undefined}
            onClick={() => {
              if (item.kind === 'payload') {
                if (active) onDisarm();
                else onArmPayload(item.id, item.payload, item.label);
              } else if (item.kind === 'tool') {
                if (active) onDisarm();
                else onArmTool(item.id, item.tool, item.label);
              } else onAction(item.action);
            }}
            title={item.label}
          >
            <Icon icon={item.icon} width="22" height="22" style={{ color: item.color }} />
            <b>{item.label}</b>
            <small>{item.sub}</small>
          </button>
        );
      })}
    </div>
  );

  if (variant === 'panel') {
    return (
      <div className="gfx-catalog-panel">
        <p className="gfx-catalog-panel-hint">คลิกวางบน canvas · ลากได้ · 3D ใช้ Import HTML/GLB</p>
        <div className="gfx-catalog-panel-cats">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`gfx-catalog-cat gfx-catalog-cat-panel${category === c.id ? ' active' : ''}`}
              onClick={() => onCategoryChange(c.id)}
              disabled={disabled}
            >
              {c.label}
            </button>
          ))}
        </div>
        {cardGrid}
      </div>
    );
  }

  return (
    <footer className="gfx-catalog-strip">
      <div className="gfx-catalog-strip-left">
        <div className="gfx-catalog-strip-title">Scene Catalog</div>
        <div className="gfx-catalog-strip-hint">คลิกวางบน canvas · 3D ใช้ Import HTML/GLB</div>
      </div>
      <div className="gfx-catalog-strip-cats">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`gfx-catalog-cat${category === c.id ? ' active' : ''}`}
            onClick={() => onCategoryChange(c.id)}
            disabled={disabled}
          >
            {c.label}
          </button>
        ))}
      </div>
      {cardGrid}
    </footer>
  );
}
