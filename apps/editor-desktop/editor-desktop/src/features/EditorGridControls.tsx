import React from 'react';
import { Icon } from '@iconify/react';
import { Grid3x3 } from 'lucide-react';
import {
  GRID_SIZE_OPTIONS,
  type EditorGridStyle,
  normalizeGridSize,
} from './editorGrid';

type Props = {
  enabled: boolean;
  size: number;
  style: EditorGridStyle;
  onEnabledChange: (enabled: boolean) => void;
  onSizeChange: (size: number) => void;
  onStyleChange: (style: EditorGridStyle) => void;
  /** Graphics toolbar: icon-only. Reports: labeled button. */
  variant?: 'icon' | 'labeled';
};

export function EditorGridControls({
  enabled,
  size,
  style,
  onEnabledChange,
  onSizeChange,
  onStyleChange,
  variant = 'labeled',
}: Props) {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    function onDocClick(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const label = `Grid ${normalizeGridSize(size)}px`;

  return (
    <div className="editor-grid-controls" ref={rootRef}>
      {variant === 'icon' ? (
        <button
          type="button"
          className={enabled ? 'active' : ''}
          onClick={() => onEnabledChange(!enabled)}
          title={enabled ? `${label} (${style}) — คลิกปิด` : 'เปิด Grid'}
        >
          <Grid3x3 size={18} />
        </button>
      ) : (
        <button
          type="button"
          className={`btn secondary small-btn${enabled ? ' active' : ''}`}
          onClick={() => onEnabledChange(!enabled)}
          title={enabled ? `${label} — คลิกปิด` : 'เปิด Grid'}
        >
          <Icon icon="solar:widget-4-bold-duotone" width="14" height="14" />
          {label}
        </button>
      )}
      <button
        type="button"
        className={variant === 'icon' ? 'editor-grid-settings-btn' : 'btn secondary small-btn editor-grid-settings-btn'}
        onClick={() => setOpen((value) => !value)}
        title="ตั้งค่า Grid"
        aria-expanded={open}
      >
        {variant === 'icon' ? '▾' : '▾'}
      </button>
      {open ? (
        <div className="editor-grid-panel" role="dialog" aria-label="Grid settings">
          <label className="editor-grid-check">
            <input type="checkbox" checked={enabled} onChange={(e) => onEnabledChange(e.target.checked)} />
            แสดง Grid
          </label>
          <label className="editor-grid-field">
            <span>ความถี่ (px)</span>
            <select value={normalizeGridSize(size)} onChange={(e) => onSizeChange(Number(e.target.value))}>
              {GRID_SIZE_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt} px</option>
              ))}
            </select>
          </label>
          <label className="editor-grid-field">
            <span>รูปแบบ</span>
            <select value={style} onChange={(e) => onStyleChange(e.target.value as EditorGridStyle)}>
              <option value="lines">เส้น (Lines)</option>
              <option value="dots">จุด (Dots)</option>
            </select>
          </label>
        </div>
      ) : null}
    </div>
  );
}
