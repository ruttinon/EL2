import { Icon } from '@iconify/react';

export type EditorArmedBannerProps = {
  label: string;
  onCancel: () => void;
};

export function EditorArmedBanner({ label, onCancel }: EditorArmedBannerProps) {
  return (
    <div className="gfx-armed-banner" role="status">
      <div className="gfx-armed-banner-body">
        <Icon icon="solar:cursor-square-bold-duotone" width="20" height="20" style={{ color: '#38bdf8', flexShrink: 0 }} />
        <span>
          <b>โหมดวาง:</b> {label} — คลิกบน canvas เพื่อวาง · กด <kbd>Esc</kbd> ยกเลิก
        </span>
      </div>
      <button type="button" className="btn secondary tiny" onClick={onCancel}>
        ยกเลิก
      </button>
    </div>
  );
}
