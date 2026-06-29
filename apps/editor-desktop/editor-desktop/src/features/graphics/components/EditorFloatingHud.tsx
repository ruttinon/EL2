import type { GraphicObjectDefinition } from '@energylink/shared-types';
import type { CurrentTagValue } from '@energylink/graphics-runtime';

const HUD_TYPES = new Set(['elecsymbol', 'viewport3d', 'image', 'gauge', 'value', 'kpicard']);

export type EditorFloatingHudProps = {
  objects: GraphicObjectDefinition[];
  currentValues: CurrentTagValue[];
  selectedObjectId: string | null;
  showAllBound: boolean;
};

export function EditorFloatingHud({
  objects,
  currentValues,
  selectedObjectId,
  showAllBound,
}: EditorFloatingHudProps) {
  const valueByTag = new Map(currentValues.map((v) => [v.id, v]));

  const targets = objects.filter((o) => {
    if (o.visible === false) return false;
    const tagId = o.binding?.tagId;
    if (!tagId) return false;
    if (!HUD_TYPES.has(o.type)) return false;
    if (!showAllBound && o.id !== selectedObjectId) return false;
    return true;
  });

  if (!targets.length) return null;

  return (
    <div className="gfx-floating-hud" aria-hidden>
      {targets.map((o) => {
        const tagId = o.binding!.tagId!;
        const val = valueByTag.get(tagId);
        const display = val?.value != null && val.value !== '' ? String(val.value) : '—';
        const unit = val?.unit ? ` ${val.unit}` : '';
        return (
          <div
            key={o.id}
            className={`gfx-floating-hud-card${o.id === selectedObjectId ? ' selected' : ''}`}
            style={{
              left: o.x + o.width / 2,
              top: o.y - 6,
            }}
          >
            <span className="gfx-floating-hud-label">{o.name || o.text || 'Tag'}</span>
            <span className="gfx-floating-hud-value">
              {display}
              {unit}
            </span>
          </div>
        );
      })}
    </div>
  );
}
