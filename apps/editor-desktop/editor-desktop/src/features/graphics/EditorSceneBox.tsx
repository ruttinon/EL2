import { clampBoxDepth } from './boxDepth';

/** CSS 3D cube — one object = one cabinet/box with real depth faces */
export function EditorSceneBox({
  width,
  height,
  depth,
  faceImage,
  sideColor = '#475569',
  label,
}: {
  width: number;
  height: number;
  depth: number;
  faceImage?: string;
  sideColor?: string;
  label?: string;
}) {
  const d = clampBoxDepth(depth, width, height);
  const frontBg = faceImage ? `url(${faceImage}) center/cover no-repeat` : sideColor;

  return (
    <div
      className="editor-scene-box-root"
      style={{ width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none' }}
    >
      <div className="editor-scene-box-stage">
        <div
          className="editor-scene-box-cube"
          style={{
            width,
            height,
            '--cube-w': `${width}px`,
            '--cube-h': `${height}px`,
            '--cube-depth': `${d}px`,
          } as React.CSSProperties}
        >
          <div className="editor-cube-face editor-cube-front" style={{ background: frontBg }}>
            {label && !faceImage ? <span className="editor-scene-box-label">{label}</span> : null}
          </div>
          <div className="editor-cube-face editor-cube-back" style={{ background: sideColor, filter: 'brightness(0.65)' }} />
          <div className="editor-cube-face editor-cube-right" style={{ background: sideColor, filter: 'brightness(0.72)' }} />
          <div className="editor-cube-face editor-cube-left" style={{ background: sideColor, filter: 'brightness(0.68)' }} />
          <div className="editor-cube-face editor-cube-top" style={{ background: sideColor, filter: 'brightness(0.88)' }} />
          <div className="editor-cube-face editor-cube-bottom" style={{ background: sideColor, filter: 'brightness(0.55)' }} />
        </div>
      </div>
    </div>
  );
}
