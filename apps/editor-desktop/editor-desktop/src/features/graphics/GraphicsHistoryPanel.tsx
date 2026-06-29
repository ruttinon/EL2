import { Icon } from '@iconify/react';
import type { GraphicLayoutSnapshot } from '@energylink/shared-types';

export function GraphicsHistoryPanel({
  snapshots,
  onRestore,
  onDelete,
}: {
  snapshots: GraphicLayoutSnapshot[];
  onRestore: (snapshot: GraphicLayoutSnapshot) => void;
  onDelete: (snapshotId: string) => void;
}) {
  if (snapshots.length === 0) {
    return (
      <p className="muted" style={{ fontSize: 12, padding: 8 }}>
        No layout history yet. Snapshots are saved when you save a graphic (Engine DB or local fallback, up to 30 versions).
      </p>
    );
  }

  return (
    <div className="graphics-history-panel">
      {snapshots.map((snap) => (
        <div key={snap.id} className="history-row">
          <div className="history-meta">
            <span className="history-label">{snap.label}</span>
            <span className="history-detail">
              {snap.objectCount} objects · {snap.width}×{snap.height} · {new Date(snap.savedAt).toLocaleString()}
            </span>
          </div>
          <div className="history-actions">
            <button type="button" className="btn secondary tiny" onClick={() => onRestore(snap)} title="Restore this layout">
              <Icon icon="solar:history-bold-duotone" width="14" height="14" />
              Restore
            </button>
            <button type="button" className="layer-icon-btn" title="Delete snapshot" onClick={() => onDelete(snap.id)}>
              <Icon icon="solar:trash-bin-trash-bold-duotone" width="14" height="14" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
