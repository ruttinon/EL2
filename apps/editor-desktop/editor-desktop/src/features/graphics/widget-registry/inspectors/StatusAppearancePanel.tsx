import type { GraphicObjectDefinition, TagSummary } from '@energylink/shared-types';
import { parseValueRules, serializeValueRules } from '@energylink/graphics-runtime';
import { getValueInspectorCaps } from '../../editor/valueInspectorCaps';
import { ValueWidgetAdvancedPanel } from '../../editor/inspector/widgets/ValueWidgetAdvancedPanel';
import { clearStyleAsset, pickStyleAsset } from '../../editor/inspector/inspectorAssetHelpers';

export function StatusAppearancePanel({
  selected,
  tags,
  onUpdate,
}: {
  selected: GraphicObjectDefinition;
  tags: TagSummary[];
  onUpdate: (id: string, patch: Partial<GraphicObjectDefinition>) => void;
}) {
  const caps = getValueInspectorCaps('status', selected.style);
  if (!caps) return null;

  return (
    <ValueWidgetAdvancedPanel
      selected={selected}
      caps={caps}
      tags={tags}
      stateSlots={[]}
      valueRules={parseValueRules(selected.style)}
      onUpdate={onUpdate}
      updateStateSlots={() => {}}
      updateValueRules={(next) => {
        onUpdate(selected.id, {
          style: {
            ...selected.style,
            valueRulesJson: next.length ? serializeValueRules(next) : undefined,
          },
        });
      }}
      pickStateAsset={(styleKey, file) => pickStyleAsset(selected, styleKey, file, onUpdate)}
      clearStateAsset={(styleKey) => clearStyleAsset(selected, styleKey, onUpdate)}
    />
  );
}
