import { clampBoxDepth, defaultBoxDepth } from './boxDepth';
export function SceneBox({
  width,
  height,
  depth,
  faceImage,
  sideColor = '#475569',
  label,
  depthZ = 0,
  style,
  className = '',
}: {
  width: number;
  height: number;
  depth: number;
  faceImage?: string;
  sideColor?: string;
  label?: string;
  depthZ?: number;
  style?: React.CSSProperties;
  className?: string;
}) {
  const d = clampBoxDepth(depth, width, height);
  const frontBg = faceImage ? `url(${faceImage}) center/cover no-repeat` : sideColor;

  return (
    <div
      className={`rt-scene-box-root ${className}`.trim()}
      style={{
        width,
        height,
        overflow: 'visible',
        position: 'relative',
        top: -depthZ * 0.4,
        ...style,
      }}
    >
      <div className="rt-scene-box-stage">
        <div
          className="rt-scene-box-cube"
          style={{ width, height, '--cube-w': `${width}px`, '--cube-h': `${height}px`, '--cube-depth': `${d}px` } as React.CSSProperties}
        >
          <div className="rt-cube-face rt-cube-front" style={{ background: frontBg }}>
            {label && !faceImage ? <span className="rt-scene-box-label">{label}</span> : null}
          </div>
          <div className="rt-cube-face rt-cube-back" style={{ background: sideColor, filter: 'brightness(0.65)' }} />
          <div className="rt-cube-face rt-cube-right" style={{ background: sideColor, filter: 'brightness(0.72)' }} />
          <div className="rt-cube-face rt-cube-left" style={{ background: sideColor, filter: 'brightness(0.68)' }} />
          <div className="rt-cube-face rt-cube-top" style={{ background: sideColor, filter: 'brightness(0.88)' }} />
          <div className="rt-cube-face rt-cube-bottom" style={{ background: sideColor, filter: 'brightness(0.55)' }} />
        </div>
      </div>
    </div>
  );
}

export function boxDepthForObject(width: number, height: number, style?: Record<string, unknown>): number {
  return defaultBoxDepth(width, height, style);
}
