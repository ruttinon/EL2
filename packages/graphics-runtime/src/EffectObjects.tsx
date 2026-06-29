import React, { Suspense, lazy } from 'react';
import type { CurrentTagValue, NormalizedGraphicObject } from './types';
import { SceneBox, boxDepthForObject } from './SceneBox';
import { resolveCameraOrbit } from './sceneUtils';
import { FlowPathSvg } from './SldObjects';
import {
  cableToViewportLocal2d,
  inlayCablesForViewport,
} from './viewportCables';
import { EquipmentChrome } from './equipmentChrome';

const Spline = lazy(() => import('@splinetool/react-spline'));

function loadScriptOnce(id: string, src: string, moduleType = false): Promise<void> {
  if (document.getElementById(id)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.id = id;
    if (moduleType) script.type = 'module';
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

type LottiePlayer = {
  loadAnimation: (opts: {
    container: Element;
    renderer: string;
    loop: boolean;
    autoplay: boolean;
    path?: string;
    animationData?: unknown;
  }) => { destroy: () => void };
};

declare global {
  interface Window {
    lottie?: LottiePlayer;
  }
}

export function SpriteObject({
  obj,
  value,
  animClass,
  hideEmptyPlaceholder = false,
}: {
  obj: NormalizedGraphicObject;
  value?: CurrentTagValue;
  animClass: string;
  hideEmptyPlaceholder?: boolean;
}) {
  const spriteUrl = String(obj.style?.spriteUrl ?? obj.style?.imageDataUrl ?? '');
  const frameW = Number(obj.style?.frameWidth ?? 64);
  const frameH = Number(obj.style?.frameHeight ?? 64);
  const frameCount = Math.max(1, Number(obj.style?.frameCount ?? 8));
  const columns = Math.max(1, Number(obj.style?.columns ?? frameCount));
  const fps = Math.max(1, Number(obj.style?.fps ?? 12));
  const rows = Math.ceil(frameCount / columns);
  const threshold = Number(obj.style?.playThreshold ?? 0.5);
  const numVal = value?.value != null ? Number(value.value) : null;
  const playing = numVal == null || !Number.isFinite(threshold) || numVal >= threshold;
  const duration = frameCount / fps;

  if (!spriteUrl && hideEmptyPlaceholder) return null;

  const style: React.CSSProperties = {
    left: obj.x,
    top: obj.y,
    width: obj.width,
    height: obj.height,
    zIndex: obj.layer ?? 1,
    backgroundImage: spriteUrl ? `url("${spriteUrl}")` : undefined,
    backgroundSize: `${columns * frameW}px ${rows * frameH}px`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: '0 0',
    animation: spriteUrl && playing ? `rt-sprite-steps ${duration}s steps(${frameCount}) infinite` : undefined,
  };

  return (
    <div
      className={`rt-object rt-sprite${animClass}${!spriteUrl ? ' rt-sprite-empty' : ''}${!playing ? ' rt-sprite-paused' : ''}`}
      style={style}
      title={obj.name}
    >
      {!spriteUrl && <span className="rt-sprite-placeholder">Sprite</span>}
    </div>
  );
}

export function LottieObject({
  obj,
  value,
  animClass,
  hideEmptyPlaceholder = false,
}: {
  obj: NormalizedGraphicObject;
  value?: CurrentTagValue;
  animClass: string;
  hideEmptyPlaceholder?: boolean;
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const lottieUrl = String(obj.style?.lottieUrl ?? '');
  const loop = obj.style?.loop !== false;
  const autoplay = obj.style?.autoplay !== false;
  const threshold = Number(obj.style?.playThreshold ?? 0.5);
  const numVal = value?.value != null ? Number(value.value) : null;
  const shouldPlay = autoplay && (numVal == null || !Number.isFinite(threshold) || numVal >= threshold);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el || !lottieUrl) return undefined;
    let player: { destroy: () => void; play?: () => void; pause?: () => void } | null = null;
    let cancelled = false;

    void (async () => {
      try {
        await loadScriptOnce(
          'energylink-lottie-web',
          'https://cdnjs.cloudflare.com/ajax/libs/lottie-web/5.12.2/lottie.min.js',
        );
        if (cancelled || !window.lottie) return;
        const isJson = lottieUrl.trim().startsWith('{') || lottieUrl.endsWith('.json');
        let animationData: unknown;
        if (isJson && lottieUrl.trim().startsWith('{')) {
          animationData = JSON.parse(lottieUrl);
        } else if (isJson) {
          const res = await fetch(lottieUrl);
          animationData = await res.json();
        }
        player = window.lottie.loadAnimation({
          container: el,
          renderer: 'svg',
          loop,
          autoplay: shouldPlay,
          ...(animationData ? { animationData } : { path: lottieUrl }),
        });
      } catch {
        el.innerHTML = '<span class="rt-lottie-error">Lottie load failed</span>';
      }
    })();

    return () => {
      cancelled = true;
      player?.destroy();
    };
  }, [lottieUrl, loop, shouldPlay]);

  if (!lottieUrl && hideEmptyPlaceholder) return null;

  return (
    <div
      className={`rt-object rt-lottie${animClass}${!lottieUrl ? ' rt-lottie-empty' : ''}`}
      style={{ left: obj.x, top: obj.y, width: obj.width, height: obj.height, zIndex: obj.layer ?? 1 }}
      title={obj.name}
    >
      <div ref={containerRef} className="rt-lottie-host" style={{ width: '100%', height: '100%' }} />
      {!lottieUrl && <span className="rt-lottie-placeholder">Lottie</span>}
    </div>
  );
}

function cableToViewportLocal(
  cable: NormalizedGraphicObject,
  host: NormalizedGraphicObject,
): NormalizedGraphicObject {
  return cableToViewportLocal2d(cable, host);
}

function ViewportCableInlay({
  host,
  cables,
  valuesByTag,
}: {
  host: NormalizedGraphicObject;
  cables: NormalizedGraphicObject[];
  valuesByTag?: Map<string, CurrentTagValue>;
}) {
  if (cables.length === 0) return null;
  return (
    <svg
      className="rt-viewport-cable-inlay"
      viewBox={`0 0 ${host.width} ${host.height}`}
      width={host.width}
      height={host.height}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        overflow: 'visible',
        zIndex: 2,
      }}
    >
      {cables.map((cable) => {
        const local = cableToViewportLocal(cable, host);
        const flowTagId = cable.binding?.flowTagId ?? cable.binding?.tagId;
        const enableTagId = cable.binding?.enableTagId;
        return (
          <FlowPathSvg
            key={cable.id}
            obj={local}
            flowValue={flowTagId && valuesByTag ? valuesByTag.get(flowTagId) : undefined}
            enableValue={enableTagId && valuesByTag ? valuesByTag.get(enableTagId) : undefined}
            particleMode={cable.style?.cableParticles !== false}
          />
        );
      })}
    </svg>
  );
}

export function Viewport3dObject({
  obj,
  animClass,
  value,
  valuesByTag,
  hideEmptyPlaceholder = false,
  peerObjects = [],
}: {
  obj: NormalizedGraphicObject;
  animClass: string;
  value?: CurrentTagValue;
  valuesByTag?: Map<string, CurrentTagValue>;
  hideEmptyPlaceholder?: boolean;
  peerObjects?: NormalizedGraphicObject[];
}) {
  const inlayCables = React.useMemo(
    () => inlayCablesForViewport(obj, peerObjects),
    [obj, peerObjects],
  );
  const showInlay = inlayCables.length > 0 && obj.style?.viewportCableInlay !== false;
  const isFullScene = obj.type === 'scene3d';
  const hostRef = React.useRef<HTMLDivElement>(null);
  const glbUrl = String(obj.style?.glbUrl ?? '');
  const buildMode = String(obj.style?.sceneBuildMode ?? (glbUrl ? 'glb' : 'box'));
  const boxColor = String(obj.style?.boxColor ?? '#64748b');
  const boxDepth = Number(obj.style?.boxDepth ?? 40);
  const autoRotate = obj.style?.autoRotate !== false;
  const exposure = Number(obj.style?.exposure ?? 1);
  const cameraOrbit = resolveCameraOrbit(obj.style?.cameraPreset);
  /** Editor diagram: avoid N× model-viewer WebGL contexts — use box preview; GLB in Live / World layer */
  const editorBoxPreview = !hideEmptyPlaceholder && buildMode === 'glb' && glbUrl;

  React.useEffect(() => {
    if (buildMode === 'box' || editorBoxPreview || !glbUrl || !hostRef.current) return undefined;
    let cancelled = false;

    void (async () => {
      try {
        await loadScriptOnce(
          'energylink-model-viewer',
          'https://ajax.googleapis.com/ajax/libs/model-viewer/3.5.0/model-viewer.min.js',
          true,
        );
        if (cancelled || !hostRef.current) return;
        const mv = document.createElement('model-viewer');
        mv.setAttribute('src', glbUrl);
        mv.setAttribute('camera-controls', '');
        mv.setAttribute('camera-orbit', cameraOrbit);
        if (autoRotate) mv.setAttribute('auto-rotate', '');
        mv.setAttribute('shadow-intensity', '1');
        mv.setAttribute('exposure', String(exposure));
        mv.setAttribute('interaction-prompt', 'none');
        mv.style.width = '100%';
        mv.style.height = '100%';
        mv.style.background = 'transparent';
        hostRef.current.innerHTML = '';
        hostRef.current.appendChild(mv);
      } catch {
        if (hostRef.current) {
          hostRef.current.innerHTML = '<span class="rt-3d-error">3D model load failed</span>';
        }
      }
    })();

    return () => {
      cancelled = true;
      if (hostRef.current) hostRef.current.innerHTML = '';
    };
  }, [buildMode, editorBoxPreview, glbUrl, autoRotate, exposure, cameraOrbit]);

  const showChrome = obj.style?.statusEnabled === true || obj.style?.showValueOverlay === true;

  if (buildMode === 'box' || editorBoxPreview) {
    const faceImage = String(obj.style?.boxFaceImage ?? obj.style?.imageDataUrl ?? obj.imageDataUrl ?? '');
    const depthZ = Number(obj.style?.depthZ ?? 0);
    return (
      <div
        className={`rt-object rt-viewport3d rt-scene-box${isFullScene ? ' rt-scene3d-full' : ''}${animClass}`}
        style={{
          left: obj.x,
          top: obj.y,
          width: obj.width,
          height: obj.height,
          zIndex: (obj.layer ?? 1) + Math.round(depthZ),
          background: 'transparent',
          border: 'none',
          overflow: 'visible',
        }}
        title={obj.text || obj.name}
      >
        <SceneBox
          width={obj.width}
          height={obj.height}
          depth={boxDepthForObject(obj.width, obj.height, obj.style as Record<string, unknown>)}
          faceImage={faceImage || undefined}
          sideColor={boxColor}
          label={obj.text || obj.name}
          depthZ={depthZ}
        />
        {showInlay ? <ViewportCableInlay host={obj} cables={inlayCables} valuesByTag={valuesByTag} /> : null}
        {showChrome ? <EquipmentChrome obj={obj} valuesByTag={valuesByTag} primaryValue={value} /> : null}
      </div>
    );
  }

  if (buildMode === 'spline') {
    const splineUrl = String(obj.style?.splineUrl ?? '');
    if (!splineUrl && hideEmptyPlaceholder) return null;
    const splineAppRef = React.useRef<any>(null);

    // Reactively update Spline variables when valuesByTag changes
    React.useEffect(() => {
      if (!splineAppRef.current || !valuesByTag || !obj.binding?.splineMappings) return;
      const app = splineAppRef.current;
      Object.entries(obj.binding.splineMappings).forEach(([varName, tagId]) => {
        const val = valuesByTag.get(tagId)?.value;
        if (val != null) {
          app.setVariable(varName, Number(val));
        }
      });
    }, [valuesByTag, obj.binding?.splineMappings]);

    return (
      <div
        className={`rt-object rt-viewport3d rt-render-scene${animClass}${!splineUrl ? ' rt-viewport3d-empty' : ''}`}
        style={{ left: obj.x, top: obj.y, width: obj.width, height: obj.height, zIndex: obj.layer ?? 1, background: 'transparent', border: 'none' }}
        title={obj.name}
      >
        {splineUrl ? (
          <Suspense fallback={<span className="rt-viewport3d-placeholder">Loading Spline...</span>}>
            <Spline 
              scene={splineUrl} 
              style={{ width: '100%', height: '100%' }} 
              onLoad={(spline) => {
                splineAppRef.current = spline;
                // Init variables on load
                if (valuesByTag && obj.binding?.splineMappings) {
                  Object.entries(obj.binding.splineMappings).forEach(([varName, tagId]) => {
                    const val = valuesByTag.get(tagId)?.value;
                    if (val != null) spline.setVariable(varName, Number(val));
                  });
                }
              }}
            />
          </Suspense>
        ) : (
          <span className="rt-viewport3d-placeholder">Spline Component</span>
        )}
        {showChrome ? <EquipmentChrome obj={obj} valuesByTag={valuesByTag} primaryValue={value} /> : null}
      </div>
    );
  }

  if (!glbUrl && hideEmptyPlaceholder) return null;

  return (
    <div
      className={`rt-object rt-viewport3d rt-render-scene${isFullScene ? ' rt-scene3d-full' : ''}${animClass}${!glbUrl ? ' rt-viewport3d-empty' : ''}`}
      style={{ left: obj.x, top: obj.y, width: obj.width, height: obj.height, zIndex: obj.layer ?? 1, background: 'transparent', border: 'none' }}
      title={obj.name}
    >
      <div ref={hostRef} className="rt-viewport3d-host" style={{ position: 'relative', width: '100%', height: '100%' }} />
      {showInlay ? <ViewportCableInlay host={obj} cables={inlayCables} valuesByTag={valuesByTag} /> : null}
      {!glbUrl && <span className="rt-viewport3d-placeholder">เลือก GLB ใน Properties</span>}
      {showChrome ? <EquipmentChrome obj={obj} valuesByTag={valuesByTag} primaryValue={value} /> : null}
    </div>
  );
}
