import { Plus, Trash2 } from 'lucide-react';
import type { GraphicObjectDefinition, TagSummary } from '@energylink/shared-types';
import type { ValueStateRule } from '@energylink/graphics-runtime';
import { parseValueRules, serializeValueRules } from '@energylink/graphics-runtime';
import { hexForColorInput } from '../../colorInput';
import { getValueInspectorCaps, VALUE_RULE_WHEN_LABELS, valueRuleWhenOptions } from '../../editor/valueInspectorCaps';

export function widgetSupportsValueRules(type: string, style?: Record<string, unknown>): boolean {
  return Boolean(getValueInspectorCaps(type, style)?.showValueRules);
}

export function ValueRulesMiniInspector({
  selected,
  tags,
  onUpdate,
}: {
  selected: GraphicObjectDefinition;
  tags: TagSummary[];
  onUpdate: (id: string, patch: Partial<GraphicObjectDefinition>) => void;
}) {
  const caps = getValueInspectorCaps(selected.type, selected.style);
  if (!caps?.showValueRules) return null;

  const rules = parseValueRules(selected.style);

  const updateRules = (next: ValueStateRule[]) => {
    onUpdate(selected.id, {
      style: { ...selected.style, valueRulesJson: next.length ? serializeValueRules(next) : undefined },
    });
  };

  return (
    <details className="ins-composer-group" open={rules.length > 0}>
      <summary>
        {caps.valueRulesTitle || 'Conditions'}
        <button
          type="button"
          className="ins-icon-btn"
          title="Add Condition"
          onClick={(e) => {
            e.preventDefault();
            updateRules([...rules, { ...caps.defaultRule }]);
          }}
        >
          <Plus size={14} />
        </button>
      </summary>
      <div className="ins-composer-fields">
        <p className="ins-hint">{caps.valueRulesHint || 'Change appearance when condition is met'}</p>
        {rules.map((rule, i) => (
          <div key={i} className="ins-action">
            <div className="ins-action-head">
              <strong>Rule #{i + 1}</strong>
              <button type="button" className="ins-icon-btn danger" onClick={() => updateRules(rules.filter((_, j) => j !== i))}>
                <Trash2 size={14} />
              </button>
            </div>
            <div className="ins-grid2">
              <label className="ins-row">
                <span>Tag</span>
                <select
                  value={rule.tagId ?? ''}
                  onChange={(e) => {
                    const next = [...rules];
                    next[i] = { ...rule, tagId: e.target.value || undefined };
                    updateRules(next);
                  }}
                >
                  <option value="">— Primary —</option>
                  {tags.map((t) => (
                    <option key={t.id} value={t.id}>{t.name ?? t.id}</option>
                  ))}
                </select>
              </label>
              <label className="ins-row">
                <span>When</span>
                <select
                  value={rule.when}
                  onChange={(e) => {
                    const next = [...rules];
                    next[i] = { ...rule, when: e.target.value as ValueStateRule['when'] };
                    updateRules(next);
                  }}
                >
                  {valueRuleWhenOptions(caps).map((w) => (
                    <option key={w} value={w}>{VALUE_RULE_WHEN_LABELS[w]}</option>
                  ))}
                </select>
              </label>
              {rule.when !== 'on' && rule.when !== 'off' && rule.when !== 'between' ? (
                <label className="ins-row">
                  <span>Value</span>
                  <input
                    type="number"
                    value={rule.value ?? 0}
                    onChange={(e) => {
                      const next = [...rules];
                      next[i] = { ...rule, value: Number(e.target.value) };
                      updateRules(next);
                    }}
                  />
                </label>
              ) : null}
              {rule.when === 'between' ? (
                <>
                  <label className="ins-row">
                    <span>Min</span>
                    <input
                      type="number"
                      value={rule.min ?? 0}
                      onChange={(e) => {
                        const next = [...rules];
                        next[i] = { ...rule, min: Number(e.target.value) };
                        updateRules(next);
                      }}
                    />
                  </label>
                  <label className="ins-row">
                    <span>Max</span>
                    <input
                      type="number"
                      value={rule.max ?? 100}
                      onChange={(e) => {
                        const next = [...rules];
                        next[i] = { ...rule, max: Number(e.target.value) };
                        updateRules(next);
                      }}
                    />
                  </label>
                </>
              ) : null}
              {caps.ruleFields.fill ? (
                <label className="ins-row">
                  <span>Color</span>
                  <input
                    type="color"
                    value={hexForColorInput(rule.background ?? rule.fill ?? '#22c55e', '#22c55e')}
                    onChange={(e) => {
                      const next = [...rules];
                      next[i] = { ...rule, background: e.target.value, fill: e.target.value };
                      updateRules(next);
                    }}
                  />
                </label>
              ) : null}
              {caps.ruleFields.color ? (
                <label className="ins-row">
                  <span>Text Color</span>
                  <input
                    type="color"
                    value={hexForColorInput(rule.color ?? '#ffffff', '#ffffff')}
                    onChange={(e) => {
                      const next = [...rules];
                      next[i] = { ...rule, color: e.target.value };
                      updateRules(next);
                    }}
                  />
                </label>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </details>
  );
}
