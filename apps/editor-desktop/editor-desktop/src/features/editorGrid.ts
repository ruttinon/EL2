import type React from 'react';

/** Shared canvas grid defaults for graphics and report designers. */
export const DEFAULT_GRID_SIZE = 20;

export const GRID_SIZE_OPTIONS = [5, 10, 20, 40, 50] as const;

export type EditorGridStyle = 'lines' | 'dots';

export type EditorGridState = {
  enabled: boolean;
  size: number;
  style: EditorGridStyle;
};

export const DEFAULT_GRID_STATE: EditorGridState = {
  enabled: true,
  size: DEFAULT_GRID_SIZE,
  style: 'lines',
};

export function normalizeGridSize(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_GRID_SIZE;
  return Math.min(100, Math.max(5, Math.round(value)));
}

export function snapToGrid(value: number, enabled: boolean, gridSize = DEFAULT_GRID_SIZE): number {
  if (!enabled) return Math.round(value);
  const size = normalizeGridSize(gridSize);
  return Math.round(value / size) * size;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

const GRID_COLOR = 'rgba(71,85,105,.32)';
const DOT_COLOR = 'rgba(71,85,105,.5)';

export function buildGridOverlayStyle(size: number, style: EditorGridStyle): React.CSSProperties {
  const px = `${normalizeGridSize(size)}px`;
  if (style === 'dots') {
    return {
      backgroundImage: `radial-gradient(circle, ${DOT_COLOR} 1px, transparent 1px)`,
      backgroundSize: `${px} ${px}`,
    };
  }
  return {
    backgroundImage: [
      `linear-gradient(${GRID_COLOR} 1px, transparent 1px)`,
      `linear-gradient(90deg, ${GRID_COLOR} 1px, transparent 1px)`,
    ].join(', '),
    backgroundSize: `${px} ${px}`,
  };
}

/** Parse ribbon commands like "grid 20px" → size or null. */
export function parseGridSizeFromCommand(command: string): number | null {
  const match = normalizeCommandGrid(command);
  if (!match) return null;
  return normalizeGridSize(match);
}

function normalizeCommandGrid(command: string): number | null {
  const match = command.trim().match(/^grid\s+(\d+)\s*px$/i);
  if (!match) return null;
  return Number(match[1]);
}

export function isGridCommand(command: string): boolean {
  return /^grid(\s+\d+\s*px)?$/i.test(command.trim());
}
