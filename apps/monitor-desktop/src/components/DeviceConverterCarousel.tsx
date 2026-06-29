import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ConverterNode } from '../utils/deviceTree';
import type { RuntimeIndexes } from '../utils/runtimeIndexes';
import { getDeviceLiveStatus } from '../utils/runtimeIndexes';
import { DeviceAvatar } from './DeviceAvatar';

const VISIBLE_RADIUS = 2;

export function DeviceConverterCarousel({
  groups,
  activeId,
  indexes,
  onSelect,
}: {
  groups: ConverterNode[];
  activeId?: string;
  indexes: RuntimeIndexes;
  onSelect: (converterId: string) => void;
}) {
  const activeIndex = React.useMemo(() => {
    if (!groups.length) return 0;
    const idx = groups.findIndex(g => g.converter.id === activeId);
    return idx >= 0 ? idx : 0;
  }, [groups, activeId]);

  const go = (delta: number) => {
    if (!groups.length) return;
    const next = (activeIndex + delta + groups.length) % groups.length;
    onSelect(groups[next].converter.id);
  };

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') go(-1);
      if (e.key === 'ArrowRight') go(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (groups.length === 0) return null;

  return (
    <div className="device-carousel-wrap dash-animate">
      <div className="device-carousel-toolbar">
        <span className="device-carousel-label">Converters</span>
        <span className="runtime-chip">{activeIndex + 1} / {groups.length}</span>
      </div>
      <div className="device-carousel">
        <button
          type="button"
          className="device-carousel-nav"
          onClick={() => go(-1)}
          aria-label="Previous converter"
        >
          <ChevronLeft size={22} />
        </button>
        <div className="device-carousel-stage" aria-live="polite">
          {groups.map((group, i) => {
            let offset = i - activeIndex;
            if (offset > groups.length / 2) offset -= groups.length;
            if (offset < -groups.length / 2) offset += groups.length;
            if (Math.abs(offset) > VISIBLE_RADIUS) return null;

            const live = getDeviceLiveStatus(group.converter, indexes);
            const convEndpoint = group.converter.ipAddress
              ? `${group.converter.ipAddress}:${group.converter.port ?? '-'}`
              : group.converter.serialPort ?? '—';
            const isActive = offset === 0;
            const scale = isActive ? 1 : 0.82;
            const opacity = isActive ? 1 : 0.55;

            return (
              <button
                key={group.converter.id}
                type="button"
                className={`device-carousel-card${isActive ? ' active' : ''}`}
                style={{
                  transform: `translateX(${offset * 118}px) scale(${scale}) rotateY(${offset * -14}deg)`,
                  opacity,
                  zIndex: 10 - Math.abs(offset),
                }}
                onClick={() => onSelect(group.converter.id)}
                aria-current={isActive ? 'true' : undefined}
              >
                <div className="device-carousel-card-media">
                  <DeviceAvatar device={group.converter} size="hero" />
                </div>
                <div className="device-carousel-card-body">
                  <span className="device-type-badge converter">Converter</span>
                  <b className="device-carousel-name">{group.converter.name}</b>
                  <span className="device-carousel-meta mono">{convEndpoint}</span>
                  <div className="device-carousel-foot">
                    <span className={`status-badge-mini ${live.badge}`}>{live.label}</span>
                    <span className="runtime-chip">{group.meters.length} meters</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          className="device-carousel-nav"
          onClick={() => go(1)}
          aria-label="Next converter"
        >
          <ChevronRight size={22} />
        </button>
      </div>
    </div>
  );
}
