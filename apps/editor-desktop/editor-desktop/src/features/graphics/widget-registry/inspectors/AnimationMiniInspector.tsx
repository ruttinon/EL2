import { Plus, Trash2 } from 'lucide-react';
import type { GraphicObjectDefinition, TagSummary, WidgetAnimation } from '@energylink/shared-types';
import { hexForColorInput } from '../../colorInput';

const KIND_OPTIONS: Array<{ value: WidgetAnimation['kind']; label: string }> = [
  { value: 'color', label: 'Change Color' },
  { value: 'blink', label: 'Blink' },
  { value: 'show', label: 'Show' },
  { value: 'hide', label: 'Hide' },
  { value: 'rotate', label: 'Rotate' },
  { value: 'move', label: 'Move' },
  { value: 'swapImage', label: 'Swap Image' },
];

const CMP_OPTIONS = [
  { value: 'lt', label: '<' },
  { value: 'lte', label: '≤' },
  { value: 'eq', label: '=' },
  { value: 'gte', label: '≥' },
  { value: 'gt', label: '>' },
] as const;

function newAnimation(tagId?: string): WidgetAnimation {
  return {
    id: `anim_${Date.now()}`,
    when: { op: 'tag', tagId: tagId ?? '', cmp: 'lt', value: 0 },
    kind: 'color',
    options: { color: '#ef4444' },
  };
}

export function widgetHasAnimation(groups: Array<string | { custom: string }>): boolean {
  return groups.some((g) => g === 'animation');
}

export function AnimationMiniInspector({
  selected,
  tags,
  onUpdate,
}: {
  selected: GraphicObjectDefinition;
  tags: TagSummary[];
  onUpdate: (id: string, patch: Partial<GraphicObjectDefinition>) => void;
}) {
  const animations = selected.animations ?? [];
  const defaultTag = selected.tagId ?? selected.binding?.tagId ?? '';

  const setAnimations = (next: WidgetAnimation[]) => {
    onUpdate(selected.id, { animations: next.length ? next : undefined });
  };

  const patchAnim = (index: number, patch: Partial<WidgetAnimation>) => {
    const next = animations.map((a, i) => (i === index ? { ...a, ...patch } : a));
    setAnimations(next);
  };

  const patchWhen = (index: number, patch: Partial<Extract<WidgetAnimation['when'], { op: 'tag' }>>) => {
    const anim = animations[index];
    if (!anim || anim.when.op !== 'tag') return;
    patchAnim(index, { when: { ...anim.when, ...patch } });
  };

  return (
    <details className="ins-composer-group" open={animations.length > 0}>
      <summary>
        Animations
        <button
          type="button"
          className="ins-icon-btn"
          title="Add"
          onClick={(e) => {
            e.preventDefault();
            setAnimations([...animations, newAnimation(defaultTag)]);
          }}
        >
          <Plus size={14} />
        </button>
      </summary>
      <div className="ins-composer-fields">
        <p className="ins-hint">Apply visual effects when condition is met</p>
        {animations.length === 0 ? (
          <p className="ins-hint">None — click + to Add</p>
        ) : null}
        {animations.map((anim, i) => {
          const when = anim.when.op === 'tag' ? anim.when : null;
          return (
            <div key={anim.id} className="ins-action">
              <div className="ins-action-head">
                <strong>#{i + 1}</strong>
                <button type="button" className="ins-icon-btn danger" title="Delete" onClick={() => setAnimations(animations.filter((_, j) => j !== i))}>
                  <Trash2 size={14} />
                </button>
              </div>
              {when ? (
                <div className="ins-grid2">
                  <label className="ins-row">
                    <span>Tag</span>
                    <select value={when.tagId} onChange={(e) => patchWhen(i, { tagId: e.target.value })}>
                      <option value="">—</option>
                      {tags.map((t) => (
                        <option key={t.id} value={t.id}>{t.name ?? t.id}</option>
                      ))}
                    </select>
                  </label>
                  <label className="ins-row">
                    <span>When</span>
                    <select value={when.cmp} onChange={(e) => patchWhen(i, { cmp: e.target.value as typeof when.cmp })}>
                      {CMP_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="ins-row">
                    <span>Value</span>
                    <input
                      type="number"
                      value={Number(when.value ?? 0)}
                      onChange={(e) => patchWhen(i, { value: Number(e.target.value) })}
                    />
                  </label>
                </div>
              ) : null}
              <label className="ins-row">
                <span>Effect</span>
                <select
                  value={anim.kind}
                  onChange={(e) => patchAnim(i, { kind: e.target.value as WidgetAnimation['kind'] })}
                >
                  {KIND_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </label>
              {anim.kind === 'color' ? (
                <label className="ins-row">
                  <span>Color</span>
                  <input
                    type="color"
                    value={hexForColorInput(String(anim.options?.color ?? '#ef4444'), '#ef4444')}
                    onChange={(e) => patchAnim(i, { options: { ...anim.options, color: e.target.value } })}
                  />
                </label>
              ) : null}
              {anim.kind === 'blink' ? (
                <div className="ins-grid2">
                  <label className="ins-row">
                    <span>Color A</span>
                    <input
                      type="color"
                      value={hexForColorInput(String(anim.options?.fillA ?? '#22c55e'), '#22c55e')}
                      onChange={(e) => patchAnim(i, { options: { ...anim.options, fillA: e.target.value } })}
                    />
                  </label>
                  <label className="ins-row">
                    <span>Color B</span>
                    <input
                      type="color"
                      value={hexForColorInput(String(anim.options?.fillB ?? '#14532d'), '#14532d')}
                      onChange={(e) => patchAnim(i, { options: { ...anim.options, fillB: e.target.value } })}
                    />
                  </label>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </details>
  );
}
