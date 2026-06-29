import type { DeviceSummary } from '@energylink/shared-types';
import { Image as ImageIcon } from 'lucide-react';
import { resolveDeviceIconUrl } from '../deviceAssetHelpers';

export const deviceToolKey = (deviceId: string) => `device:2d:${deviceId}`;

export function parseDeviceToolKey(tool: string): { deviceId: string; mode: '2d' } | null {
  if (!tool.startsWith('device:')) return null;
  const parts = tool.split(':');
  if (parts.length !== 3) return null;
  if (parts[1] !== '2d') return null;
  return { mode: '2d', deviceId: parts[2] };
}

export type DevicePaletteProps = {
  devices: DeviceSummary[];
  activeTool: string;
  onPickTool: (tool: string) => void;
  disabled?: boolean;
  variant?: 'sidebar' | 'embedded';
};

export function DevicePalette({ devices, activeTool, onPickTool, disabled, variant = 'sidebar' }: DevicePaletteProps) {
  const meters = devices.filter((d) => d.type === 'meter' || d.type === 'sensor');
  const converters = devices.filter((d) => d.type === 'converter');
  const other = devices.filter((d) => !meters.includes(d) && !converters.includes(d));

  const renderRow = (d: DeviceSummary) => {
    const icon = resolveDeviceIconUrl(d);
    const key2d = deviceToolKey(d.id);
    return (
      <div key={d.id} className="dp-row">
        <div className="dp-thumb">
          {icon ? <img src={icon} alt="" /> : <span>{d.name.slice(0, 2).toUpperCase()}</span>}
        </div>
        <div className="dp-meta">
          <strong>{d.name}</strong>
          <small>{d.type}</small>
        </div>
        <div className="dp-actions">
          <button
            type="button"
            className={`dp-btn${activeTool === key2d ? ' active' : ''}`}
            title="วางไอคอน 2D บน canvas"
            disabled={disabled || !icon}
            onClick={() => onPickTool(activeTool === key2d ? 'select' : key2d)}
          >
            <ImageIcon size={14} />
          </button>
        </div>
      </div>
    );
  };

  if (devices.length === 0) {
    const empty = (
      <>
        {variant === 'sidebar' ? <div className="dp-head">Devices</div> : null}
        <p className="dp-empty-msg">ยังไม่มีอุปกรณ์ — เพิ่มใน Setup → Devices</p>
      </>
    );
    if (variant === 'embedded') return <div className="dp-embedded">{empty}</div>;
    return <aside className="dp-panel dp-empty">{empty}</aside>;
  }

  const body = (
    <>
      {variant === 'sidebar' ? <div className="dp-head">Devices</div> : null}
      <p className="dp-hint">วางไอคอน 2D · โมเดล 3D ใช้ Import HTML/GLB</p>
      {meters.length > 0 ? (
        <section className="dp-section">
          <h4>Meters / Sensors</h4>
          {meters.map(renderRow)}
        </section>
      ) : null}
      {converters.length > 0 ? (
        <section className="dp-section">
          <h4>Converters</h4>
          {converters.map(renderRow)}
        </section>
      ) : null}
      {other.length > 0 ? (
        <section className="dp-section">
          <h4>Other</h4>
          {other.map(renderRow)}
        </section>
      ) : null}
    </>
  );

  if (variant === 'embedded') return <div className="dp-embedded">{body}</div>;
  return <aside className="dp-panel">{body}</aside>;
}
