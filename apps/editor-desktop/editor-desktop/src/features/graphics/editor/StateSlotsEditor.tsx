import { Upload, X, Plus, Trash2 } from 'lucide-react';
import type { WidgetStateSlot } from '@energylink/graphics-runtime';
import { hexForColorInput } from '../colorInput';

type Props = {
  title: string;
  hint: string;
  slots: WidgetStateSlot[];
  onChange: (slots: WidgetStateSlot[]) => void;
  readAsDataUrl: (file: File) => Promise<string>;
  fixedValues?: number[];
};

function mergeSlot(base: WidgetStateSlot, patch: Partial<WidgetStateSlot>): WidgetStateSlot {
  const merged: WidgetStateSlot = { ...base, ...patch };
  if ('imageUrl' in patch && patch.imageUrl === undefined) delete merged.imageUrl;
  if ('glbUrl' in patch && patch.glbUrl === undefined) delete merged.glbUrl;
  return merged;
}

export function StateSlotsEditor({ title, hint, slots, onChange, readAsDataUrl, fixedValues }: Props) {
  const displaySlots: WidgetStateSlot[] = fixedValues
    ? fixedValues.map((fv) => slots.find((s) => s.value === fv) ?? { value: fv, label: `State ${fv}`, color: '#64748b' })
    : slots;

  const patchAt = (i: number, patch: Partial<WidgetStateSlot>) => {
    const updated = mergeSlot(displaySlots[i], patch);
    if (fixedValues) {
      const others = slots.filter((s) => s.value !== updated.value);
      onChange([...others, updated].sort((a, b) => a.value - b.value));
    } else {
      onChange(slots.map((s, idx) => (idx === i ? updated : s)));
    }
  };

  const addSlot = () => {
    const nextValue = slots.length > 0 ? Math.max(...slots.map((s) => s.value)) + 1 : 0;
    onChange([...slots, { value: nextValue, label: `State ${nextValue}`, color: '#64748b' }]);
  };

  const removeSlot = (i: number) => onChange(slots.filter((_, idx) => idx !== i));

  return (
    <div className="ins-state-slots">
      <h4 style={{ margin: '12px 0 4px' }}>{title}</h4>
      <p className="ins-hint">{hint}</p>
      {displaySlots.map((slot, i) => (
        <div key={`${slot.value}-${i}`} className="ins-action">
          <div className="ins-grid2">
            <label className="ins-row"><span>Tag Value</span>
              <input type="number" value={slot.value} disabled={Boolean(fixedValues)} onChange={(e) => patchAt(i, { value: Number(e.target.value) })} />
            </label>
            <label className="ins-row"><span>Label</span>
              <input value={slot.label} onChange={(e) => patchAt(i, { label: e.target.value })} />
            </label>
            <label className="ins-row"><span>Color</span>
              <input type="color" value={hexForColorInput(slot.color ?? '#64748b', '#64748b')} onChange={(e) => patchAt(i, { color: e.target.value })} />
            </label>
          </div>
          {slot.imageUrl ? (
            <div className="ins-media">
              <img className="ins-thumb" src={slot.imageUrl} alt="" />
              <button className="ins-media-clear" title="Remove image" onClick={() => patchAt(i, { imageUrl: undefined })}><X size={14} /></button>
            </div>
          ) : (
            <label className="ins-file-btn"><Upload size={14} /> Image for this state…
              <input type="file" accept="image/*" hidden onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                patchAt(i, { imageUrl: await readAsDataUrl(file) });
              }} />
            </label>
          )}
          {slot.glbUrl ? (
            <div className="ins-media">
              <span className="ins-file-name">GLB ✓</span>
              <button className="ins-media-clear" title="Remove model" onClick={() => patchAt(i, { glbUrl: undefined })}><X size={14} /></button>
            </div>
          ) : (
            <label className="ins-file-btn"><Upload size={14} /> 3D Model (.glb)…
              <input type="file" accept=".glb,.gltf" hidden onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                patchAt(i, { glbUrl: await readAsDataUrl(file) });
              }} />
            </label>
          )}
          {!fixedValues && slots.length > 1 ? (
            <button className="ins-action-del" onClick={() => removeSlot(i)}><Trash2 size={13} /> Remove State</button>
          ) : null}
        </div>
      ))}
      {!fixedValues ? (
        <button className="ins-file-btn" style={{ marginTop: 8 }} onClick={addSlot}><Plus size={14} /> Add State</button>
      ) : null}
    </div>
  );
}
