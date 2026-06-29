import type { ViewportDebugFlags } from '../editorViewportDebug';

export type GraphicEditorDebugBarProps = {
  debug: ViewportDebugFlags;
  onChange: (patch: Partial<ViewportDebugFlags>) => void;
};

export function GraphicEditorDebugBar({ debug, onChange }: GraphicEditorDebugBarProps) {
  const toggles: Array<{ key: keyof ViewportDebugFlags; label: string }> = [
    { key: 'walls', label: 'Walls' },
    { key: 'cables', label: 'Cables' },
    { key: 'labels', label: 'Labels' },
    { key: 'widgets', label: 'Widgets' },
    { key: 'flow', label: 'Flow' },
  ];

  return (
    <div className="gfx-debug-bar" role="group" aria-label="Viewport debug layers">
      {toggles.map((t) => (
        <label key={t.key} className="gfx-debug-toggle">
          <input
            type="checkbox"
            checked={debug[t.key]}
            onChange={(e) => onChange({ [t.key]: e.target.checked })}
          />
          {t.label}
        </label>
      ))}
    </div>
  );
}
