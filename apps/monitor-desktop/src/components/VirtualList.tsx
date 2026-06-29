import React from 'react';

type VirtualListProps<T> = {
  items: T[];
  height: number;
  itemHeight: number;
  overscan?: number;
  className?: string;
  getKey: (item: T, index: number) => string;
  renderItem: (item: T, index: number) => React.ReactNode;
};

/**
 * Lightweight fixed-height virtual list — no extra dependencies.
 */
export function VirtualList<T>({
  items,
  height,
  itemHeight,
  overscan = 6,
  className,
  getKey,
  renderItem,
}: VirtualListProps<T>) {
  const [scrollTop, setScrollTop] = React.useState(0);
  const totalHeight = items.length * itemHeight;
  const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const visibleCount = Math.ceil(height / itemHeight) + overscan * 2;
  const end = Math.min(items.length, start + visibleCount);

  return (
    <div
      className={className}
      style={{ height, overflow: 'auto' }}
      onScroll={e => setScrollTop(e.currentTarget.scrollTop)}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        {items.slice(start, end).map((item, i) => {
          const index = start + i;
          return (
            <div
              key={getKey(item, index)}
              style={{
                position: 'absolute',
                top: index * itemHeight,
                left: 0,
                right: 0,
                height: itemHeight,
                boxSizing: 'border-box',
              }}
            >
              {renderItem(item, index)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
