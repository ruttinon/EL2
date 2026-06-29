import React from 'react';
import { buildGridOverlayStyle, type EditorGridStyle } from './editorGrid';

type Props = {
  size: number;
  style: EditorGridStyle;
  className?: string;
};

export function EditorGridOverlay({ size, style, className = 'ec-grid-overlay' }: Props) {
  return <div className={className} style={buildGridOverlayStyle(size, style)} aria-hidden />;
}
