import React from 'react';
import type { ResolvedValueAppearance } from './valueAppearance';

let modelViewerScriptLoaded = false;

function loadModelViewer(): Promise<void> {
  if (modelViewerScriptLoaded || typeof document === 'undefined') return Promise.resolve();
  const existing = document.getElementById('energylink-model-viewer-value');
  if (existing) {
    modelViewerScriptLoaded = true;
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.id = 'energylink-model-viewer-value';
    script.type = 'module';
    script.src = 'https://ajax.googleapis.com/ajax/libs/model-viewer/3.5.0/model-viewer.min.js';
    script.onload = () => {
      modelViewerScriptLoaded = true;
      resolve();
    };
    script.onerror = () => reject(new Error('model-viewer load failed'));
    document.head.appendChild(script);
  });
}

function ValueModel3dView({ glbUrl, autoRotate }: { glbUrl: string; autoRotate: boolean }) {
  const hostRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!glbUrl || !hostRef.current) return undefined;
    let cancelled = false;

    void (async () => {
      try {
        await loadModelViewer();
        if (cancelled || !hostRef.current) return;
        const mv = document.createElement('model-viewer');
        mv.setAttribute('src', glbUrl);
        mv.setAttribute('camera-controls', '');
        mv.setAttribute('interaction-prompt', 'none');
        mv.setAttribute('shadow-intensity', '0.6');
        mv.setAttribute('exposure', '1');
        if (autoRotate) mv.setAttribute('auto-rotate', '');
        mv.style.width = '100%';
        mv.style.height = '100%';
        mv.style.background = 'transparent';
        hostRef.current.innerHTML = '';
        hostRef.current.appendChild(mv);
      } catch {
        if (hostRef.current) {
          hostRef.current.innerHTML = '<span class="rt-value-3d-error">3D</span>';
        }
      }
    })();

    return () => {
      cancelled = true;
      if (hostRef.current) hostRef.current.innerHTML = '';
    };
  }, [glbUrl, autoRotate]);

  return <div ref={hostRef} className="rt-value-3d-host" style={{ width: '100%', height: '100%' }} />;
}

export type ValueDisplayShellProps = {
  appearance: ResolvedValueAppearance;
  className?: string;
  style?: React.CSSProperties;
  autoRotate3d?: boolean;
  children?: React.ReactNode;
};

/** Renders image / 3D / classic shell for flexible value widgets. */
export function ValueDisplayShell({
  appearance,
  className = '',
  style,
  autoRotate3d = true,
  children,
}: ValueDisplayShellProps) {
  if (appearance.visible === false) return null;

  const mode = appearance.displayMode;
  const glowStyle: React.CSSProperties =
    appearance.glow && appearance.background
      ? { boxShadow: `0 0 12px 3px ${appearance.background}88` }
      : {};

  if (mode === 'model3d' && appearance.glbUrl) {
    return (
      <div className={`rt-value-shell rt-value-shell-3d${className}`} style={{ ...style, ...glowStyle, padding: 0, overflow: 'hidden', position: 'relative' }}>
        <ValueModel3dView glbUrl={appearance.glbUrl} autoRotate={autoRotate3d} />
        {children}
      </div>
    );
  }

  if (appearance.imageUrl) {
    return (
      <div className={`rt-value-shell rt-value-shell-image${className}`} style={{ ...style, ...glowStyle, padding: 0, background: 'transparent', overflow: 'hidden', position: 'relative' }}>
        <img
          src={appearance.imageUrl}
          alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', position: 'absolute', inset: 0 }}
        />
        {children ? <div className="rt-value-shell-children" style={{ position: 'relative', zIndex: 1, width: '100%', height: '100%' }}>{children}</div> : null}
      </div>
    );
  }

  return (
    <div
      className={`rt-value-shell rt-value-shell-classic${className}`}
      style={{
        ...style,
        ...glowStyle,
        background: appearance.background ?? appearance.fill ?? style?.background,
        color: appearance.color ?? style?.color,
      }}
    >
      {appearance.text ? <span className="rt-value-shell-text">{appearance.text}</span> : null}
      {children}
    </div>
  );
}
