import React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { RuntimeDevice } from '../types/monitor';
import type { RuntimeIndexes } from '../utils/runtimeIndexes';
import { getDeviceLiveStatus } from '../utils/runtimeIndexes';
import { liveBadgeClass } from '../utils/deviceVisual';
import { SCALE } from '../utils/scaleConfig';
import { DeviceAvatar } from './DeviceAvatar';
import { ViewSearchInput } from './ViewHelpers';

export function SidebarDeviceTree({
  devices,
  indexes,
  search,
  onSearchChange,
  onSelectDevice,
}: {
  devices: RuntimeDevice[];
  indexes: RuntimeIndexes;
  search: string;
  onSearchChange: (v: string) => void;
  onSelectDevice: (id: string) => void;
}) {
  const [sectionOpen, setSectionOpen] = React.useState(true);
  const [collapsedIds, setCollapsedIds] = React.useState<Set<string>>(() => new Set());
  const autoCollapsedRef = React.useRef(false);

  const q = search.trim().toLowerCase();
  let roots = indexes.roots;
  if (q) {
    roots = roots.filter(d => {
      if (d.name.toLowerCase().includes(q) || d.type?.toLowerCase().includes(q)) return true;
      const children = indexes.childrenByParentId.get(d.id) ?? [];
      return children.some(c => c.name.toLowerCase().includes(q));
    });
  } else if (roots.length > SCALE.SIDEBAR_DEVICE_PREVIEW) {
    roots = roots.slice(0, SCALE.SIDEBAR_DEVICE_PREVIEW);
  }

  const truncated = !q && indexes.roots.length > SCALE.SIDEBAR_DEVICE_PREVIEW;

  React.useEffect(() => {
    if (autoCollapsedRef.current || indexes.roots.length < SCALE.AUTO_COLLAPSE_DEVICES) return;
    autoCollapsedRef.current = true;
    setCollapsedIds(new Set(indexes.roots.map(r => r.id)));
  }, [indexes.roots]);

  React.useEffect(() => {
    if (!q) return;
    setCollapsedIds(prev => {
      const next = new Set(prev);
      for (const root of roots) {
        const children = indexes.childrenByParentId.get(root.id) ?? [];
        const childMatch = children.some(c => c.name.toLowerCase().includes(q));
        if (childMatch || root.name.toLowerCase().includes(q)) next.delete(root.id);
      }
      return next;
    });
  }, [q, roots, indexes]);

  function toggleGroup(id: string) {
    setCollapsedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function isGroupExpanded(rootId: string, childCount: number) {
    if (childCount === 0) return false;
    if (q) return !collapsedIds.has(rootId);
    return !collapsedIds.has(rootId);
  }

  if (devices.length === 0) {
    return (
      <div className="sidebar-devices-section">
        <button
          type="button"
          className="panel-section-toggle"
          onClick={() => setSectionOpen(o => !o)}
          aria-expanded={sectionOpen}
        >
          <span>Devices</span>
          <span className="runtime-chip sidebar-section-count">0</span>
          {sectionOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        {sectionOpen && <div className="empty-small">No devices configured yet.</div>}
      </div>
    );
  }

  return (
    <div className="sidebar-devices-section">
      <button
        type="button"
        className="panel-section-toggle"
        onClick={() => setSectionOpen(o => !o)}
        aria-expanded={sectionOpen}
      >
        <span>Devices</span>
        <span className="runtime-chip sidebar-section-count">{devices.length}</span>
        {sectionOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>

      {sectionOpen && (
        <div className="sidebar-devices-body">
          <ViewSearchInput
            value={search}
            onChange={onSearchChange}
            placeholder="Search converters & meters..."
            variant="sidebar"
          />
          <div className="sidebar-device-tree">
            {roots.map(root => {
              const live = getDeviceLiveStatus(root, indexes);
              const children = (indexes.childrenByParentId.get(root.id) ?? []).filter(c => {
                if (!q) return true;
                return c.name.toLowerCase().includes(q) || root.name.toLowerCase().includes(q);
              });
              const expanded = isGroupExpanded(root.id, children.length);
              return (
                <div key={root.id} className="sidebar-device-group">
                  <div className="sidebar-device-root-line">
                    {children.length > 0 && (
                      <button
                        type="button"
                        className="sidebar-tree-collapse-btn"
                        onClick={() => toggleGroup(root.id)}
                        aria-expanded={expanded}
                        aria-label={expanded ? 'Collapse meters' : 'Expand meters'}
                      >
                        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </button>
                    )}
                    <button
                      type="button"
                      className="sidebar-device-row root"
                      onClick={() => onSelectDevice(root.id)}
                    >
                      <DeviceAvatar device={root} size="xs" />
                      <span className={`device-status-dot ${liveBadgeClass(live.badge)}`} />
                      <span className="sidebar-device-name">{root.name}</span>
                      {children.length > 0 && (
                        <span className="runtime-chip sidebar-device-count">{children.length}</span>
                      )}
                    </button>
                  </div>
                  {expanded && children.map(child => {
                    const childLive = getDeviceLiveStatus(child, indexes);
                    return (
                      <button
                        key={child.id}
                        type="button"
                        className="sidebar-device-row child"
                        onClick={() => onSelectDevice(child.id)}
                      >
                        <DeviceAvatar device={child} size="xs" />
                        <span className={`device-status-dot ${liveBadgeClass(childLive.badge)}`} />
                        <span className="sidebar-device-name">{child.name}</span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
          {truncated && (
            <div className="sidebar-scale-hint">
              Showing {SCALE.SIDEBAR_DEVICE_PREVIEW} of {indexes.roots.length} — search to find more
            </div>
          )}
        </div>
      )}
    </div>
  );
}
