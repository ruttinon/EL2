import { Upload, X, Plus, Trash2 } from 'lucide-react';
import type { GraphicObjectDefinition, TagSummary } from '@energylink/shared-types';
import type { ValueStateRule, WidgetStateSlot } from '@energylink/graphics-runtime';
import { hexForColorInput } from '../../../colorInput';
import { StateSlotsEditor } from '../../StateSlotsEditor';
import {
  type ValueInspectorCaps,
  valueRuleWhenOptions,
  VALUE_RULE_WHEN_LABELS,
} from '../../valueInspectorCaps';
import { mergeStyle, readAsDataUrl, styleNum, styleStr } from '../inspectorUtils';

export type ValueWidgetAdvancedPanelProps = {
  selected: GraphicObjectDefinition;
  caps: ValueInspectorCaps;
  tags: TagSummary[];
  stateSlots: WidgetStateSlot[];
  valueRules: ValueStateRule[];
  onUpdate: (id: string, patch: Partial<GraphicObjectDefinition>) => void;
  updateStateSlots: (next: WidgetStateSlot[]) => void;
  updateValueRules: (next: ValueStateRule[]) => void;
  pickStateAsset: (styleKey: string, file?: File | null) => Promise<void>;
  clearStateAsset: (styleKey: string) => void;
};

export function ValueWidgetAdvancedPanel({
  selected,
  caps,
  tags,
  stateSlots,
  valueRules,
  onUpdate,
  updateStateSlots,
  updateValueRules,
  pickStateAsset,
  clearStateAsset,
}: ValueWidgetAdvancedPanelProps) {
  const setStyle = (patch: Record<string, string | number | boolean | undefined>) => {
    onUpdate(selected.id, { style: mergeStyle(selected, patch) });
  };

  return (
    <details className="ins-more ins-more-premium">
      <summary>Advanced Settings</summary>

      {caps.displayModes.length > 1 ? (
        <label className="ins-row">
          <span>Display Mode</span>
          <select
            value={caps.displayModes.includes(styleStr(selected, 'valueDisplayMode', 'classic') as 'classic' | 'image' | 'model3d')
              ? styleStr(selected, 'valueDisplayMode', 'classic')
              : caps.displayModes[0]}
            onChange={(e) => setStyle({ valueDisplayMode: e.target.value })}
          >
            {caps.displayModes.includes('classic') ? <option value="classic">Classic</option> : null}
            {caps.displayModes.includes('image') ? <option value="image">Image</option> : null}
            {caps.displayModes.includes('model3d') ? <option value="model3d">3D Model</option> : null}
          </select>
        </label>
      ) : null}

      {caps.showVariants ? (
        <label className="ins-row">
          <span>Style Variant</span>
          <select value={styleStr(selected, 'valueVariant', selected.type === 'value' ? 'minimal' : 'default')} onChange={(e) => setStyle({ valueVariant: e.target.value })}>
            <option value="default">Default</option>
            <option value="compact">Compact</option>
            <option value="card">Card</option>
            <option value="minimal">Minimal</option>
            <option value="industrial">Industrial</option>
          </select>
        </label>
      ) : null}

      {(caps.showStateSlots || caps.showBinaryStates) ? (
        <label className="ins-row">
          <span>Preview on Canvas</span>
          <select
            value={String(
              selected.style?.designPreviewValue
              ?? (caps.showBinaryStates
                ? 1
                : selected.type === 'statusbadge' || selected.type === 'multistate'
                  ? 1
                  : selected.type === 'semaphore'
                    ? 0
                    : (stateSlots[0]?.value ?? 0)),
            )}
            onChange={(e) => setStyle({ designPreviewValue: Number(e.target.value) })}
          >
            {caps.showBinaryStates ? (
              <>
                <option value="1">ON</option>
                <option value="0">OFF</option>
              </>
            ) : (
              stateSlots.map((s) => (
                <option key={s.value} value={String(s.value)}>{s.value} — {s.label || `State ${s.value}`}</option>
              ))
            )}
          </select>
        </label>
      ) : null}

      {caps.displayModes.includes('image')
        && !caps.showStateSlots
        && !caps.showBinaryStates
        && styleStr(selected, 'valueDisplayMode', 'classic') === 'image' ? (
        <div className="ins-subsec">
          <span className="ins-subsec-title">
            {selected.type === 'kpicard' ? 'Card Background Image' : 'Background Image'}
          </span>
          {styleStr(selected, 'fillImage', '') ? (
            <div className="ins-media">
              <img className="ins-thumb" src={styleStr(selected, 'fillImage', '')} alt="" />
              <button type="button" className="ins-media-clear" title="Remove" onClick={() => clearStateAsset('fillImage')}><X size={14} /></button>
            </div>
          ) : (
            <label className="ins-file-btn">
              <Upload size={14} /> Upload Image...
              <input type="file" accept="image/*" hidden onChange={(e) => void pickStateAsset('fillImage', e.target.files?.[0])} />
            </label>
          )}
        </div>
      ) : null}

      {selected.type === 'value' && styleStr(selected, 'fillImage', '') ? (
        <div className="ins-media">
          <img className="ins-thumb" src={styleStr(selected, 'fillImage', '')} alt="" />
          <button type="button" className="ins-media-clear" title="Remove" onClick={() => clearStateAsset('fillImage')}><X size={14} /></button>
        </div>
      ) : selected.type === 'value' ? (
        <label className="ins-file-btn">
          <Upload size={14} /> Background Image...
          <input
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              void pickStateAsset('fillImage', e.target.files?.[0]);
              setStyle({ valueDisplayMode: 'image' });
            }}
          />
        </label>
      ) : null}

      {caps.showStateSlots ? (
        <>
          <StateSlotsEditor
            title={caps.stateSlotsTitle}
            hint=""
            slots={stateSlots}
            onChange={updateStateSlots}
            readAsDataUrl={readAsDataUrl}
            fixedValues={selected.type === 'semaphore' ? [0, 1, 2] : undefined}
          />
          {selected.type === 'semaphore' ? (
            <label className="ins-row">
              <span>Semaphore Background</span>
              <input type="color" value={hexForColorInput(styleStr(selected, 'fill', '#1e293b'), '#1e293b')} onChange={(e) => setStyle({ fill: e.target.value })} />
            </label>
          ) : null}
        </>
      ) : null}

      {caps.showBinaryStates ? (
        <div className="ins-subsec">
          <div className="ins-subsec-title">Image / Model ON-OFF</div>
          {(caps.displayModes.includes('image') || caps.displayModes.includes('model3d')) ? (
            <div className="ins-grid2">
              {styleStr(selected, 'stateOnImage', '') ? (
                <div className="ins-media">
                  <img className="ins-thumb" src={styleStr(selected, 'stateOnImage', '')} alt="" />
                  <button type="button" className="ins-media-clear" title="Remove" onClick={() => clearStateAsset('stateOnImage')}><X size={14} /></button>
                </div>
              ) : (
                <label className="ins-file-btn"><Upload size={14} /> Image ON…
                  <input type="file" accept="image/*" hidden onChange={(e) => void pickStateAsset('stateOnImage', e.target.files?.[0])} />
                </label>
              )}
              {styleStr(selected, 'stateOffImage', '') ? (
                <div className="ins-media">
                  <img className="ins-thumb" src={styleStr(selected, 'stateOffImage', '')} alt="" />
                  <button type="button" className="ins-media-clear" title="Remove" onClick={() => clearStateAsset('stateOffImage')}><X size={14} /></button>
                </div>
              ) : (
                <label className="ins-file-btn"><Upload size={14} /> Image OFF…
                  <input type="file" accept="image/*" hidden onChange={(e) => void pickStateAsset('stateOffImage', e.target.files?.[0])} />
                </label>
              )}
            </div>
          ) : null}
          {caps.displayModes.includes('model3d') ? (
            <div className="ins-grid2" style={{ marginTop: 8 }}>
              {styleStr(selected, 'stateOnGlb', '') ? (
                <div className="ins-media">
                  <span className="ins-file-name">ON 3D ✓</span>
                  <button type="button" className="ins-media-clear" title="Remove" onClick={() => clearStateAsset('stateOnGlb')}><X size={14} /></button>
                </div>
              ) : (
                <label className="ins-file-btn"><Upload size={14} /> 3D Model ON…
                  <input type="file" accept=".glb,.gltf" hidden onChange={(e) => void pickStateAsset('stateOnGlb', e.target.files?.[0])} />
                </label>
              )}
              {styleStr(selected, 'stateOffGlb', '') ? (
                <div className="ins-media">
                  <span className="ins-file-name">OFF 3D ✓</span>
                  <button type="button" className="ins-media-clear" title="Remove" onClick={() => clearStateAsset('stateOffGlb')}><X size={14} /></button>
                </div>
              ) : (
                <label className="ins-file-btn"><Upload size={14} /> 3D Model OFF…
                  <input type="file" accept=".glb,.gltf" hidden onChange={(e) => void pickStateAsset('stateOffGlb', e.target.files?.[0])} />
                </label>
              )}
            </div>
          ) : null}
        </div>
      ) : null}

      {selected.type === 'value' || selected.type === 'gauge' ? (
        <div className="ins-subsec">
          <div className="ins-subsec-title">Thresholds</div>
          <div className="ins-grid2">
            <label className="ins-row"><span>High Limit (≥)</span>
              <input type="number" value={styleNum(selected, 'thresholdHigh', 80)} onChange={(e) => setStyle({ thresholdHigh: Number(e.target.value) })} />
            </label>
            <label className="ins-row"><span>Low Limit (≤)</span>
              <input type="number" value={styleNum(selected, 'thresholdLow', 20)} onChange={(e) => setStyle({ thresholdLow: Number(e.target.value) })} />
            </label>
            <label className="ins-row"><span>High Color</span>
              <input type="color" value={hexForColorInput(styleStr(selected, 'alarmColor', '#fee2e2'), '#fee2e2')} onChange={(e) => setStyle({ alarmColor: e.target.value })} />
            </label>
            <label className="ins-row"><span>Low Color</span>
              <input type="color" value={hexForColorInput(styleStr(selected, 'warningColor', '#fef3c7'), '#fef3c7')} onChange={(e) => setStyle({ warningColor: e.target.value })} />
            </label>
          </div>
        </div>
      ) : null}

      {caps.showValueRules ? (
        <div className="ins-subsec">
          <div className="ins-subsec-head">
            <span className="ins-subsec-title">{caps.valueRulesTitle}</span>
            <button
              type="button"
              className="ins-icon-btn"
              title="Add Rule"
              onClick={() => updateValueRules([...valueRules, { ...caps.defaultRule }])}
            >
              <Plus size={14} />
            </button>
          </div>
          {valueRules.length === 0 ? (
            <p className="ins-hint">Optional — Add rules to change styles based on specific conditions</p>
          ) : null}
          {valueRules.map((rule, i) => (
            <div key={i} className="ins-action">
              <div className="ins-grid2">
                <label className="ins-row"><span>Tag</span>
                  <select
                    value={rule.tagId ?? ''}
                    onChange={(e) => {
                      const next = [...valueRules];
                      next[i] = { ...rule, tagId: e.target.value || undefined };
                      updateValueRules(next);
                    }}
                  >
                    <option value="">— Main —</option>
                    {tags.map((t) => (
                      <option key={t.id} value={t.id}>{t.name ?? t.id}</option>
                    ))}
                  </select>
                </label>
                <label className="ins-row"><span>When</span>
                  <select
                    value={rule.when}
                    onChange={(e) => {
                      const next = [...valueRules];
                      next[i] = { ...rule, when: e.target.value as ValueStateRule['when'] };
                      updateValueRules(next);
                    }}
                  >
                    {valueRuleWhenOptions(caps).map((w) => (
                      <option key={w} value={w}>{VALUE_RULE_WHEN_LABELS[w]}</option>
                    ))}
                  </select>
                </label>
                {rule.when === 'between' ? (
                  <>
                    <label className="ins-row"><span>Min</span>
                      <input type="number" value={rule.min ?? 0} onChange={(e) => {
                        const next = [...valueRules];
                        next[i] = { ...rule, min: Number(e.target.value) };
                        updateValueRules(next);
                      }} />
                    </label>
                    <label className="ins-row"><span>Max</span>
                      <input type="number" value={rule.max ?? 100} onChange={(e) => {
                        const next = [...valueRules];
                        next[i] = { ...rule, max: Number(e.target.value) };
                        updateValueRules(next);
                      }} />
                    </label>
                  </>
                ) : rule.when !== 'on' && rule.when !== 'off' ? (
                  <label className="ins-row"><span>Value</span>
                    <input type="number" value={rule.value ?? 0} onChange={(e) => {
                      const next = [...valueRules];
                      next[i] = { ...rule, value: Number(e.target.value) };
                      updateValueRules(next);
                    }} />
                  </label>
                ) : null}
                {caps.ruleFields.fill ? (
                  <label className="ins-row"><span>Color</span>
                    <input type="color" value={hexForColorInput(rule.background ?? rule.fill ?? '#22c55e', '#22c55e')} onChange={(e) => {
                      const next = [...valueRules];
                      next[i] = { ...rule, background: e.target.value, fill: e.target.value };
                      updateValueRules(next);
                    }} />
                  </label>
                ) : null}
                {caps.ruleFields.color ? (
                  <label className="ins-row"><span>Text Color</span>
                    <input type="color" value={hexForColorInput(rule.color ?? '#142033', '#142033')} onChange={(e) => {
                      const next = [...valueRules];
                      next[i] = { ...rule, color: e.target.value };
                      updateValueRules(next);
                    }} />
                  </label>
                ) : null}
              </div>
              {caps.ruleFields.text ? (
                <label className="ins-row"><span>Text</span>
                  <input
                    value={rule.text ?? ''}
                    placeholder="(Optional)"
                    onChange={(e) => {
                      const next = [...valueRules];
                      next[i] = { ...rule, text: e.target.value || undefined };
                      updateValueRules(next);
                    }}
                  />
                </label>
              ) : null}
              {caps.ruleFields.image && (caps.displayModes.includes('image') || caps.displayModes.includes('model3d')) && (
                rule.imageUrl ? (
                  <div className="ins-media">
                    <img className="ins-thumb" src={rule.imageUrl} alt="" />
                    <button type="button" className="ins-media-clear" title="Remove image" onClick={() => {
                      const next = [...valueRules];
                      next[i] = { ...rule, imageUrl: undefined };
                      updateValueRules(next);
                    }}><X size={14} /></button>
                  </div>
                ) : (
                  <label className="ins-file-btn"><Upload size={14} /> Image when matched…
                    <input
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const next = [...valueRules];
                        next[i] = { ...rule, imageUrl: await readAsDataUrl(file) };
                        updateValueRules(next);
                      }}
                    />
                  </label>
                )
              )}
              <button type="button" className="ins-action-del" onClick={() => updateValueRules(valueRules.filter((_, idx) => idx !== i))}>
                <Trash2 size={13} /> Remove Rule
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </details>
  );
}
