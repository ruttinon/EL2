import React from 'react';
import { AlertTriangle, Bell, CheckCircle2, ServerCrash, WifiOff } from 'lucide-react';
import type { RuntimeAlarm } from '../types/monitor';
import type { ConnectionState } from '../appShared';

const SEEN_STORAGE_KEY = 'energylink.monitor.notifications.seen.v1';

type NotificationCenterProps = {
  alarms: RuntimeAlarm[];
  unacknowledged: number;
  connStatus: ConnectionState;
  engineError?: string;
  onAcknowledge: (id: string) => void;
  onViewAlarms: () => void;
};

type NotificationItem =
  | { kind: 'alarm'; id: string; alarm: RuntimeAlarm }
  | { kind: 'engine'; id: string; message: string; severity: 'error' | 'warn' };

function loadSeenIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(SEEN_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as string[];
    return new Set(parsed);
  } catch {
    return new Set();
  }
}

function saveSeenIds(ids: Set<string>): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(SEEN_STORAGE_KEY, JSON.stringify([...ids].slice(-200)));
}

export function NotificationCenter({
  alarms,
  unacknowledged,
  connStatus,
  engineError,
  onAcknowledge,
  onViewAlarms,
}: NotificationCenterProps) {
  const [open, setOpen] = React.useState(false);
  const [seenIds, setSeenIds] = React.useState<Set<string>>(() => loadSeenIds());
  const panelRef = React.useRef<HTMLDivElement>(null);

  const activeAlarms = React.useMemo(
    () => alarms.filter(a => a.status === 'active').slice(0, 12),
    [alarms],
  );

  const items = React.useMemo(() => {
    const list: NotificationItem[] = [];
    if (engineError) {
      list.push({ kind: 'engine', id: 'engine-error', message: engineError, severity: 'error' });
    } else if (connStatus === 'bad' || connStatus === 'warn') {
      list.push({
        kind: 'engine',
        id: 'engine-conn',
        message: connStatus === 'bad' ? 'Engine connection failed' : 'Engine connection degraded',
        severity: connStatus === 'bad' ? 'error' : 'warn',
      });
    }
    for (const alarm of activeAlarms) {
      list.push({ kind: 'alarm', id: alarm.id, alarm });
    }
    return list;
  }, [activeAlarms, connStatus, engineError]);

  const unreadCount = React.useMemo(() => {
    let count = 0;
    for (const item of items) {
      if (item.kind === 'engine' && !seenIds.has(item.id)) count += 1;
      if (item.kind === 'alarm' && !item.alarm.acknowledged && !seenIds.has(item.id)) count += 1;
    }
    return count;
  }, [items, seenIds]);

  const markAllSeen = React.useCallback(() => {
    const next = new Set(seenIds);
    for (const item of items) next.add(item.id);
    setSeenIds(next);
    saveSeenIds(next);
  }, [items, seenIds]);

  React.useEffect(() => {
    if (!open) return;
    markAllSeen();
    const onPointer = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('mousedown', onPointer);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onPointer);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, markAllSeen]);

  const badgeCount = Math.max(unreadCount, unacknowledged > 0 && !open ? unacknowledged : 0);

  return (
    <div className="notification-center" ref={panelRef}>
      <button
        type="button"
        className="titlebar-icon-btn"
        onClick={() => setOpen(cur => !cur)}
        title="Notifications"
        aria-label="Notifications"
        aria-expanded={open}
      >
        <Bell size={16} />
        {badgeCount > 0 && (
          <span className="notification-badge" aria-label={`${badgeCount} unread`}>
            {badgeCount > 99 ? '99+' : badgeCount}
          </span>
        )}
      </button>

      {open && (
        <div className="notification-panel" role="dialog" aria-label="Notification center">
          <header className="notification-panel-header">
            <h3>Notifications</h3>
            {unacknowledged > 0 && (
              <span className="notification-panel-meta">{unacknowledged} unacknowledged</span>
            )}
          </header>

          <div className="notification-panel-body">
            {items.length === 0 ? (
              <div className="notification-empty">
                <CheckCircle2 size={28} color="var(--green)" style={{ opacity: 0.7 }} />
                <p>All clear — no active alerts</p>
              </div>
            ) : (
              items.map(item => {
                if (item.kind === 'engine') {
                  return (
                    <div
                      key={item.id}
                      className={`notification-item notification-item--${item.severity}`}
                    >
                      <span className="notification-item-icon" aria-hidden="true">
                        {item.severity === 'error' ? <ServerCrash size={16} /> : <WifiOff size={16} />}
                      </span>
                      <div className="notification-item-body">
                        <span className="notification-item-title">Engine</span>
                        <p className="notification-item-msg">{item.message}</p>
                      </div>
                    </div>
                  );
                }
                const a = item.alarm;
                return (
                  <div
                    key={a.id}
                    className={`notification-item notification-item--alarm${a.acknowledged ? ' acknowledged' : ''}`}
                  >
                    <span className="notification-item-icon" aria-hidden="true">
                      <AlertTriangle size={16} />
                    </span>
                    <div className="notification-item-body">
                      <div className="notification-item-top">
                        <span className="notification-item-title">{a.deviceName}</span>
                        <span className="notification-item-time">
                          {new Date(a.startedAt).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="notification-item-msg">{a.message}</p>
                      {!a.acknowledged && (
                        <button
                          type="button"
                          className="notification-ack-btn"
                          onClick={() => onAcknowledge(a.id)}
                        >
                          Acknowledge
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <footer className="notification-panel-footer">
            <button type="button" className="btn-outline btn-sm" onClick={onViewAlarms}>
              View all alarms
            </button>
          </footer>
        </div>
      )}
    </div>
  );
}
