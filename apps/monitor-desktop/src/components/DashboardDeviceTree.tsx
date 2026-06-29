import React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { RuntimeDevice } from '../types/monitor';
import type { RuntimeIndexes } from '../utils/runtimeIndexes';
import { getDeviceLiveStatus } from '../utils/runtimeIndexes';
import { buildDeviceHierarchyFromIndexes } from '../utils/deviceTree';
import { SCALE } from '../utils/scaleConfig';
import { DeviceAvatar } from './DeviceAvatar';

function deviceEndpoint(device: RuntimeDevice): string {
  if (device.ipAddress) return `${device.ipAddress}:${device.port ?? '-'}`;
  return device.serialPort ?? '—';
}

function formatPower(kw: number): string {
  if (kw >= 100) return `${kw.toFixed(0)} kW`;
  if (kw >= 10) return `${kw.toFixed(1)} kW`;
  return `${kw.toFixed(2)} kW`;
}

function TreeNodeButton({
  device,
  indexes,
  depth,
  childCount,
  expanded,
  onToggle,
  onSelect,
  delay,
}: {
  device: RuntimeDevice;
  indexes: RuntimeIndexes;
  depth: 'root' | 'child';
  childCount?: number;
  expanded?: boolean;
  onToggle?: () => void;
  onSelect: (id: string) => void;
  delay: number;
}) {
  const live = getDeviceLiveStatus(device, indexes);
  const tagCount = device.tags?.length ?? 0;
  const powerKw = indexes.powerByDeviceId.get(device.id) ?? 0;
  const endpoint = deviceEndpoint(device);
  const deviceType = (device.type ?? '').toLowerCase();
  const isConverterDevice = deviceType === 'converter' || deviceType === 'gateway' || deviceType === 'concentrator';
  const hasMeters = (childCount ?? 0) > 0;
  const typeLabel = isConverterDevice ? 'Converter' : deviceType === 'meter' ? 'Meter' : device.type ?? 'Device';

  return (
    <div
      className={`dash-tree-node-wrap dash-tree-node-wrap--${depth}`}
      style={{ animationDelay: `${delay}s` }}
    >
      {depth === 'child' && <span className="dash-tree-branch" aria-hidden="true" />}
      <div className="dash-tree-node-line">
        {hasMeters && (
          <button
            type="button"
            className="dash-tree-toggle"
            onClick={e => {
              e.stopPropagation();
              onToggle?.();
            }}
            aria-expanded={expanded}
            aria-label={expanded ? 'Collapse meters' : 'Expand meters'}
          >
            {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          </button>
        )}
        {depth === 'root' && !hasMeters && <span className="dash-tree-toggle-spacer" aria-hidden="true" />}
        <button
          type="button"
          className={`dash-tree-node${depth === 'child' ? ' dash-tree-node--meter' : ''}`}
          onClick={() => onSelect(device.id)}
        >
          <DeviceAvatar device={device} size={depth === 'child' ? 'sm' : 'md'} className="dash-tree-avatar" />
          <div className="dash-tree-node-main">
            <div className="dash-tree-node-top">
              <span className="dash-tree-node-name" title={device.name}>{device.name}</span>
              <span className={`status-pulse-dot ${live.badge}`} />
            </div>
            <div className="dash-tree-node-meta">
              <span className={`dash-tree-type ${isConverterDevice ? 'converter' : 'meter'}`}>{typeLabel}</span>
              <span className="dash-tree-endpoint mono" title={endpoint}>{endpoint}</span>
              <span className="dash-tree-tags">{tagCount} tags</span>
              {powerKw > 0 && <span className="dash-tree-power">{formatPower(powerKw)}</span>}
            </div>
          </div>
          <div className="dash-tree-node-end">
            <span className={`status-badge-mini ${live.badge}`}>{live.label}</span>
            <span className="dash-tree-open">
              Open
              <ChevronRight size={14} />
            </span>
          </div>
        </button>
      </div>
    </div>
  );
}

export function DashboardDeviceTree({
  devices,
  indexes,
  statusCounts,
  powerItems,
  onSelectDevice,
}: {
  devices: RuntimeDevice[];
  statusCounts: { online: number; warning: number; offline: number };
  indexes: RuntimeIndexes;
  powerItems: Array<{ name: string; value: number }>;
  onSelectDevice: (id: string) => void;
}) {
  const hierarchy = React.useMemo(
    () => buildDeviceHierarchyFromIndexes(indexes, devices),
    [indexes, devices],
  );

  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(() => new Set());

  React.useEffect(() => {
    setExpandedIds(prev => {
      if (prev.size > 0) return prev;
      const initial = new Set<string>();
      for (const group of hierarchy.converters.slice(0, 3)) {
        if (group.meters.length > 0) initial.add(group.converter.id);
      }
      return initial;
    });
  }, [hierarchy.converters]);

  function toggleExpanded(id: string) {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const previewLimit = SCALE.DASHBOARD_DEVICE_PREVIEW;
  const displayConverters = hierarchy.converters.slice(0, previewLimit);
  const hiddenConverterCount = Math.max(0, hierarchy.converters.length - displayConverters.length);
  const truncated = hiddenConverterCount > 0 || devices.length > previewLimit;
  const maxPower = Math.max(...powerItems.map(p => p.value), 0.001);

  if (devices.length === 0) {
    return <div className="empty-small">No devices available.</div>;
  }

  let delay = 0.04;

  return (
    <div className="dash-device-tree-shell">
      <div className="dash-device-tree-layout">
        <div className="dash-device-tree-panel">
          <div className="dash-device-tree-scroll" aria-label="Device tree">
            {displayConverters.map(group => {
            const expanded = expandedIds.has(group.converter.id);
            const groupDelay = delay;
            delay += 0.05;
            return (
              <div key={group.converter.id} className="dash-tree-group">
                <TreeNodeButton
                  device={group.converter}
                  indexes={indexes}
                  depth="root"
                  childCount={group.meters.length}
                  expanded={expanded}
                  onToggle={() => toggleExpanded(group.converter.id)}
                  onSelect={onSelectDevice}
                  delay={groupDelay}
                />
                {expanded && group.meters.length > 0 && (
                  <div className="dash-tree-children">
                    {group.meters.map(meter => {
                      const meterDelay = delay;
                      delay += 0.03;
                      return (
                        <TreeNodeButton
                          key={meter.device.id}
                          device={meter.device}
                          indexes={indexes}
                          depth="child"
                          onSelect={onSelectDevice}
                          delay={meterDelay}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {hierarchy.standalone.length > 0 && (
            <div className="dash-tree-standalone">
              {hierarchy.standalone.map(node => {
                const nodeDelay = delay;
                delay += 0.04;
                return (
                  <TreeNodeButton
                    key={node.device.id}
                    device={node.device}
                    indexes={indexes}
                    depth="root"
                    onSelect={onSelectDevice}
                    delay={nodeDelay}
                  />
                );
              })}
            </div>
          )}
          </div>
        </div>

        <aside className="dash-device-rail">
        <div className="dash-device-rail-head">
          <span className="dash-device-rail-title">Fleet snapshot</span>
          <span className="runtime-chip runtime-chip-teal">{devices.length} total</span>
        </div>

        <div className="dash-rail-status-grid">
          <div className="dash-rail-stat dash-rail-stat--online">
            <span className="dash-rail-stat-val">{statusCounts.online}</span>
            <span className="dash-rail-stat-label">Online</span>
          </div>
          <div className="dash-rail-stat dash-rail-stat--warn">
            <span className="dash-rail-stat-val">{statusCounts.warning}</span>
            <span className="dash-rail-stat-label">Warning</span>
          </div>
          <div className="dash-rail-stat dash-rail-stat--offline">
            <span className="dash-rail-stat-val">{statusCounts.offline}</span>
            <span className="dash-rail-stat-label">Offline</span>
          </div>
        </div>

        <div className="dash-rail-power">
          <span className="dash-rail-section-label">Load by device</span>
          {powerItems.length === 0 ? (
            <div className="empty-small">No power readings yet.</div>
          ) : (
            <ul className="dash-rail-power-list">
              {powerItems.slice(0, 6).map((item, i) => (
                <li key={`${item.name}-${i}`} className="dash-rail-power-row">
                  <span className="dash-rail-power-name" title={item.name}>{item.name}</span>
                  <div className="dash-rail-power-bar-wrap">
                    <div
                      className="dash-rail-power-bar"
                      style={{ width: `${Math.max(4, (item.value / maxPower) * 100)}%` }}
                    />
                  </div>
                  <span className="dash-rail-power-val">{formatPower(item.value)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="dash-rail-legend">
          <span><span className="status-pulse-dot good" /> Online</span>
          <span><span className="status-pulse-dot warn" /> Warning</span>
          <span><span className="status-pulse-dot bad" /> Offline</span>
        </div>
      </aside>
      </div>

      {truncated && (
        <p className="dash-tree-truncated-hint">
          Showing {displayConverters.length} of {hierarchy.converters.length} converter groups
          {hiddenConverterCount > 0 ? ` · ${devices.length} devices in fleet` : ''}
        </p>
      )}
    </div>
  );
}
