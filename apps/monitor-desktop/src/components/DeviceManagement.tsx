import React from 'react';
import { Cpu, LayoutGrid, Rotate3d } from 'lucide-react';
import type { RuntimeDevice } from '../types/monitor';
import type { DeviceHierarchy } from '../utils/deviceTree';
import type { RuntimeIndexes } from '../utils/runtimeIndexes';
import { getDeviceLiveStatus, countDevicesByStatus } from '../utils/runtimeIndexes';
import { buildDeviceHierarchyFromIndexes } from '../utils/deviceTree';
import { SCALE } from '../utils/scaleConfig';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { DeviceAvatar } from './DeviceAvatar';
import { DeviceConverterCarousel } from './DeviceConverterCarousel';
import { EmptyPanel, ViewSearchInput } from './ViewHelpers';

export type DeviceManagementViewMode = 'carousel' | 'list';

function DeviceCard({
  device,
  indexes,
  onSelect,
  delay = 0,
}: {
  device: RuntimeDevice;
  indexes: RuntimeIndexes;
  onSelect: (id: string) => void;
  delay?: number;
}) {
  const live = getDeviceLiveStatus(device, indexes);
  const endpoint = device.ipAddress
    ? `${device.ipAddress}:${device.port ?? '-'}`
    : device.serialPort ?? '—';

  return (
    <button
      type="button"
      className="device-page-card dash-animate"
      style={{ animationDelay: `${delay}s` }}
      onClick={() => onSelect(device.id)}
    >
      <div className="device-page-card-media">
        <DeviceAvatar device={device} size="lg" />
        <span className={`status-pulse-dot ${live.badge}`} />
      </div>
      <div className="device-page-card-head">
        <div className="device-page-title-wrap">
          <span className="device-page-name">{device.name}</span>
          <span className="device-page-type">{device.type}</span>
        </div>
      </div>
      <div className="device-page-meta">
        <span>{device.protocol ?? '—'}</span>
        <span className="mono">{endpoint}</span>
      </div>
      <div className="device-page-footer">
        <span className={`status-badge-mini ${live.badge}`}>{live.label}</span>
        <span className="device-page-tags">{device.tags?.length ?? 0} signals</span>
      </div>
    </button>
  );
}

function DeviceListLayout({
  hierarchy,
  devices,
  indexes,
  debouncedSearch,
  onSelectDevice,
}: {
  hierarchy: DeviceHierarchy;
  devices: RuntimeDevice[];
  indexes: RuntimeIndexes;
  debouncedSearch: string;
  onSelectDevice: (id: string) => void;
}) {
  const [page, setPage] = React.useState(0);
  const pageSize = SCALE.DEVICE_PAGE_SIZE;
  const converterPages = Math.max(1, Math.ceil(hierarchy.converters.length / pageSize));
  const currentPage = Math.min(page, converterPages - 1);
  const pagedConverters = hierarchy.converters.slice(
    currentPage * pageSize,
    (currentPage + 1) * pageSize,
  );

  React.useEffect(() => {
    setPage(0);
  }, [debouncedSearch]);

  return (
    <div className="device-hierarchy-layout">
      {pagedConverters.map((group, blockIdx) => {
        const convLive = getDeviceLiveStatus(group.converter, indexes);
        const convEndpoint = group.converter.ipAddress
          ? `${group.converter.ipAddress}:${group.converter.port ?? '-'}`
          : group.converter.serialPort ?? '—';
        const blockDelay = 0.08 + blockIdx * 0.04;
        return (
          <div
            key={group.converter.id}
            className="device-converter-block dash-animate"
            style={{ animationDelay: `${blockDelay}s` }}
          >
            <div className="device-converter-head">
              <div className="device-converter-title">
                <DeviceAvatar device={group.converter} size="sm" />
                <span className="device-type-badge converter">Converter</span>
                <b>{group.converter.name}</b>
              </div>
              <div className="device-converter-meta">
                <span>{group.converter.protocol ?? '—'}</span>
                <span className="mono">{convEndpoint}</span>
                <span className={`status-badge-mini ${convLive.badge}`}>{convLive.label}</span>
                <span className="runtime-chip">{group.meters.length} meters</span>
              </div>
            </div>
            {group.meters.length > 0 && (
              <div className="device-page-grid device-meter-grid">
                {group.meters.map((meter, mi) => (
                  <DeviceCard
                    key={meter.device.id}
                    device={meter.device}
                    indexes={indexes}
                    onSelect={onSelectDevice}
                    delay={0.04 + mi * 0.03}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
      {hierarchy.standalone.length > 0 && (
        <div className="device-standalone-panel card">
          <div className="card-header">
            <h3>Standalone devices</h3>
            <span className="runtime-chip">{hierarchy.standalone.length}</span>
          </div>
          <div className="device-page-grid device-meter-grid">
            {hierarchy.standalone.map((node, i) => (
              <DeviceCard
                key={node.device.id}
                device={node.device}
                indexes={indexes}
                onSelect={onSelectDevice}
                delay={0.08 + i * 0.04}
              />
            ))}
          </div>
        </div>
      )}
      {hierarchy.converters.length > pageSize && (
        <div className="pagination-row">
          <button
            type="button"
            className="btn-outline toolbar-btn"
            disabled={currentPage <= 0}
            onClick={() => setPage(p => Math.max(0, p - 1))}
          >
            Previous
          </button>
          <span className="pagination-label">
            Page {currentPage + 1} / {converterPages}
          </span>
          <button
            type="button"
            className="btn-outline toolbar-btn"
            disabled={currentPage >= converterPages - 1}
            onClick={() => setPage(p => Math.min(converterPages - 1, p + 1))}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

function DeviceCarouselLayout({
  hierarchy,
  devices,
  indexes,
  debouncedSearch,
  selectedDeviceId,
  onSelectDevice,
}: {
  hierarchy: DeviceHierarchy;
  devices: RuntimeDevice[];
  indexes: RuntimeIndexes;
  debouncedSearch: string;
  selectedDeviceId?: string | null;
  onSelectDevice: (id: string) => void;
}) {
  const [activeConverterId, setActiveConverterId] = React.useState<string | undefined>();
  const [meterPage, setMeterPage] = React.useState(0);
  const meterPageSize = 12;

  React.useEffect(() => {
    setMeterPage(0);
  }, [debouncedSearch, activeConverterId]);

  React.useEffect(() => {
    if (!hierarchy.converters.length) {
      setActiveConverterId(undefined);
      return;
    }
    if (selectedDeviceId) {
      const asConv = hierarchy.converters.find(g => g.converter.id === selectedDeviceId);
      if (asConv) {
        setActiveConverterId(asConv.converter.id);
        return;
      }
      const parentConv = hierarchy.converters.find(g =>
        g.meters.some(m => m.device.id === selectedDeviceId),
      );
      if (parentConv) {
        setActiveConverterId(parentConv.converter.id);
        return;
      }
    }
    setActiveConverterId(prev => {
      if (prev && hierarchy.converters.some(g => g.converter.id === prev)) return prev;
      return hierarchy.converters[0].converter.id;
    });
  }, [hierarchy, selectedDeviceId]);

  const activeGroup = hierarchy.converters.find(g => g.converter.id === activeConverterId);
  const meterPages = activeGroup
    ? Math.max(1, Math.ceil(activeGroup.meters.length / meterPageSize))
    : 1;
  const currentMeterPage = Math.min(meterPage, meterPages - 1);
  const pagedMeters = activeGroup
    ? activeGroup.meters.slice(currentMeterPage * meterPageSize, (currentMeterPage + 1) * meterPageSize)
    : [];

  return (
    <div className="device-management-layout">
      {hierarchy.converters.length > 0 && (
        <DeviceConverterCarousel
          groups={hierarchy.converters}
          activeId={activeConverterId}
          indexes={indexes}
          onSelect={setActiveConverterId}
        />
      )}

      {activeGroup && (
        <div className="device-meter-panel card dash-animate dash-animate-delay-2">
          <div className="card-header">
            <h3>Meters under {activeGroup.converter.name}</h3>
            <span className="runtime-chip">{activeGroup.meters.length} meters</span>
          </div>
          {activeGroup.meters.length === 0 ? (
            <div className="empty-small pad-empty">No meters under this converter.</div>
          ) : (
            <>
              <div className="device-page-grid device-meter-grid">
                {pagedMeters.map((meter, mi) => (
                  <DeviceCard
                    key={meter.device.id}
                    device={meter.device}
                    indexes={indexes}
                    onSelect={onSelectDevice}
                    delay={0.04 + mi * 0.03}
                  />
                ))}
              </div>
              {activeGroup.meters.length > meterPageSize && (
                <div className="pagination-row">
                  <button
                    type="button"
                    className="btn-outline toolbar-btn"
                    disabled={currentMeterPage <= 0}
                    onClick={() => setMeterPage(p => Math.max(0, p - 1))}
                  >
                    Previous
                  </button>
                  <span className="pagination-label">
                    Page {currentMeterPage + 1} / {meterPages}
                  </span>
                  <button
                    type="button"
                    className="btn-outline toolbar-btn"
                    disabled={currentMeterPage >= meterPages - 1}
                    onClick={() => setMeterPage(p => Math.min(meterPages - 1, p + 1))}
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {hierarchy.standalone.length > 0 && (
        <div className="device-standalone-panel card dash-animate dash-animate-delay-3">
          <div className="card-header">
            <h3>Standalone devices</h3>
            <span className="runtime-chip">{hierarchy.standalone.length}</span>
          </div>
          <div className="device-page-grid">
            {hierarchy.standalone.map((node, i) => (
              <DeviceCard
                key={node.device.id}
                device={node.device}
                indexes={indexes}
                onSelect={onSelectDevice}
                delay={0.04 + i * 0.03}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function DeviceManagementView({
  devices,
  indexes,
  selectedDeviceId,
  onSelectDevice,
}: {
  devices: RuntimeDevice[];
  indexes: RuntimeIndexes;
  selectedDeviceId?: string | null;
  onSelectDevice: (id: string) => void;
}) {
  const [search, setSearch] = React.useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [viewMode, setViewMode] = React.useState<DeviceManagementViewMode>('carousel');

  const hierarchy = React.useMemo(
    () => buildDeviceHierarchyFromIndexes(indexes, devices, debouncedSearch),
    [indexes, devices, debouncedSearch],
  );

  const statusCounts = countDevicesByStatus(indexes);
  const hasItems = hierarchy.converters.length > 0 || hierarchy.standalone.length > 0;

  const viewToggle = (
    <div className="device-view-mode-toggle" role="tablist" aria-label="Device layout mode">
      <button
        type="button"
        role="tab"
        className={`device-view-mode-btn${viewMode === 'carousel' ? ' active' : ''}`}
        aria-selected={viewMode === 'carousel'}
        onClick={() => setViewMode('carousel')}
        title="Carousel view"
      >
        <Rotate3d size={14} />
        <span>Carousel</span>
      </button>
      <button
        type="button"
        role="tab"
        className={`device-view-mode-btn${viewMode === 'list' ? ' active' : ''}`}
        aria-selected={viewMode === 'list'}
        onClick={() => setViewMode('list')}
        title="List view"
      >
        <LayoutGrid size={14} />
        <span>List</span>
      </button>
    </div>
  );

  return (
    <div className="view-page view-stack">
      <div className="card device-management-card">
        <div className="card-header">
          <span />
          <div className="card-header-actions">
            <span className="runtime-chip runtime-chip-teal">{devices.length} devices</span>
            {viewToggle}
          </div>
        </div>
        <div className="card-body device-management-body">
          <ViewSearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search converter, meter, protocol..."
          />

          {!hasItems ? (
            <EmptyPanel
              icon={<Cpu size={40} color="var(--chart-primary)" />}
              title={devices.length === 0 ? 'No devices configured' : 'No devices match search'}
            />
          ) : viewMode === 'carousel' ? (
            <DeviceCarouselLayout
              hierarchy={hierarchy}
              devices={devices}
              indexes={indexes}
              debouncedSearch={debouncedSearch}
              selectedDeviceId={selectedDeviceId}
              onSelectDevice={onSelectDevice}
            />
          ) : (
            <DeviceListLayout
              hierarchy={hierarchy}
              devices={devices}
              indexes={indexes}
              debouncedSearch={debouncedSearch}
              onSelectDevice={onSelectDevice}
            />
          )}
        </div>
      </div>
    </div>
  );
}
