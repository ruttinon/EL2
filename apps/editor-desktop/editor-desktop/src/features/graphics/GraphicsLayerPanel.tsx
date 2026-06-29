import { Icon } from '@iconify/react';
import type { GraphicObjectDefinition, GraphicUnifiedLayer } from '@energylink/shared-types';
import { resolveUnifiedLayer } from '@energylink/shared-types';

const UNIFIED_LAYER_GROUPS: { id: GraphicUnifiedLayer; label: string; icon: string }[] = [
  { id: 'world', label: 'World (3D)', icon: 'solar:box-bold-duotone' },
  { id: 'diagram', label: 'Diagram / SLD', icon: 'solar:transmission-bold-duotone' },
  { id: 'hud', label: 'HUD / Data', icon: 'solar:chart-2-bold-duotone' },
];

export function GraphicsLayerPanel({
  objects,
  selectedObjectId,
  onSelect,
  onToggleVisible,
  onMoveLayer,
}: {
  objects: GraphicObjectDefinition[];
  selectedObjectId: string;
  onSelect: (id: string) => void;
  onToggleVisible: (id: string) => void;
  onMoveLayer: (id: string, direction: 'up' | 'down') => void;
}) {
  const sorted = [...objects].sort((a, b) => (b.layer ?? 0) - (a.layer ?? 0));

  const grouped = UNIFIED_LAYER_GROUPS.map((g) => ({
    ...g,
    items: sorted.filter((o) => resolveUnifiedLayer(o) === g.id),
  })).filter((g) => g.items.length > 0);

  if (objects.length === 0) {
    return <p className="muted" style={{ fontSize: 12, padding: 8 }}>No objects on canvas.</p>;
  }

  return (
    <div className="graphics-layer-panel">
      {grouped.map((group) => (
        <div key={group.id} className={`layer-group layer-group-${group.id}`}>
          <div className="layer-group-title">
            <Icon icon={group.icon} width="14" height="14" style={{ marginRight: 4, verticalAlign: -2 }} />
            {group.label}
          </div>
          {group.items.map((obj) => (
            <div
              key={obj.id}
              className={`layer-row${obj.id === selectedObjectId ? ' selected' : ''}${obj.visible === false ? ' hidden-layer' : ''}`}
            >
              <button type="button" className="layer-select" onClick={() => onSelect(obj.id)}>
                <span className="layer-type">{obj.type}</span>
                <span className="layer-name">{obj.name}</span>
                {obj.style?.renderMode ? (
                  <span className="layer-mode">{String(obj.style.renderMode)}</span>
                ) : null}
              </button>
              <button type="button" className="layer-icon-btn" title="Toggle visible" onClick={() => onToggleVisible(obj.id)}>
                <Icon icon={obj.visible === false ? 'solar:eye-closed-bold-duotone' : 'solar:eye-bold-duotone'} width="14" height="14" />
              </button>
              <button type="button" className="layer-icon-btn" title="Bring forward" onClick={() => onMoveLayer(obj.id, 'up')}>
                <Icon icon="solar:alt-arrow-up-bold-duotone" width="14" height="14" />
              </button>
              <button type="button" className="layer-icon-btn" title="Send backward" onClick={() => onMoveLayer(obj.id, 'down')}>
                <Icon icon="solar:alt-arrow-down-bold-duotone" width="14" height="14" />
              </button>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
