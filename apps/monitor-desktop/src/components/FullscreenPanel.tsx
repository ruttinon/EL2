import React from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';

export function FullscreenPanel({
  className,
  children,
  label = 'Toggle fullscreen',
  onFullscreenChange,
}: {
  className?: string;
  children: React.ReactNode;
  label?: string;
  onFullscreenChange?: (active: boolean) => void;
}) {
  const panelRef = React.useRef<HTMLDivElement>(null);
  const [active, setActive] = React.useState(false);

  const toggle = React.useCallback(async () => {
    const el = panelRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await el.requestFullscreen();
      }
    } catch {
      /* fullscreen not supported or denied */
    }
  }, []);

  React.useEffect(() => {
    const onChange = () => {
      const active = document.fullscreenElement === panelRef.current;
      setActive(active);
      onFullscreenChange?.(active);
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, [onFullscreenChange]);

  return (
    <div
      ref={panelRef}
      className={`fullscreen-panel${active ? ' is-fullscreen' : ''}${className ? ` ${className}` : ''}`}
    >
      <button
        type="button"
        className="fullscreen-toggle-btn"
        onClick={() => void toggle()}
        title={active ? 'Exit fullscreen' : label}
        aria-label={active ? 'Exit fullscreen' : label}
      >
        {active ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        <span className="fullscreen-toggle-label">{active ? 'Exit' : 'Fullscreen'}</span>
      </button>
      <div className="fullscreen-panel-body">{children}</div>
    </div>
  );
}
