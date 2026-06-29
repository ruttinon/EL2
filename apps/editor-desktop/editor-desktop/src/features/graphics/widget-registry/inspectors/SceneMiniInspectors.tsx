import type { ReactNode } from 'react';
import { Upload, X } from 'lucide-react';
import type { GraphicObjectDefinition, GraphicSummary } from '@energylink/shared-types';
import { formatMemberIds, parseMemberIds } from '@energylink/graphics-runtime';
import { mergeStyle, readAsDataUrl, styleNum, styleStr } from '../../editor/inspector/inspectorUtils';
import { NavMiniInspector } from './ControlMiniInspectors';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="ins-sec ins-sec-premium">
      <h4>{title}</h4>
      {children}
    </section>
  );
}

export function GroupMiniInspector({
  selected,
  objects,
  onUpdate,
  onUngroupGroup,
}: {
  selected: GraphicObjectDefinition;
  objects: GraphicObjectDefinition[];
  onUpdate: (id: string, patch: Partial<GraphicObjectDefinition>) => void;
  onUngroupGroup?: (groupId: string) => void;
}) {
  const setStyle = (patch: Record<string, string | number | boolean | undefined>) => {
    onUpdate(selected.id, { style: mergeStyle(selected, patch) });
  };

  return (
    <Section title="Group (Group)">
      <select
        multiple
        size={6}
        className="ins-multi"
        value={parseMemberIds(selected.style?.memberIds)}
        onChange={(e) => {
          const ids = Array.from(e.target.selectedOptions).map((o) => o.value);
          setStyle({ memberIds: formatMemberIds(ids) });
        }}
      >
        {objects.filter((o) => o.id !== selected.id && o.type !== 'group').map((o) => (
          <option key={o.id} value={o.id}>{o.name ?? o.type}</option>
        ))}
      </select>
      <label className="ins-check">
        <input
          type="checkbox"
          checked={selected.style?.composite === true}
          onChange={(e) => setStyle({ composite: e.target.checked })}
        />
        <span>Composite equipment (Clickable + shared ports)</span>
      </label>
      {onUngroupGroup ? (
        <button type="button" className="ins-file-btn" onClick={() => onUngroupGroup(selected.id)}>
          Ungroup
        </button>
      ) : null}
    </Section>
  );
}

export function View3dMiniInspector({
  selected,
  onUpdate,
}: {
  selected: GraphicObjectDefinition;
  onUpdate: (id: string, patch: Partial<GraphicObjectDefinition>) => void;
}) {
  const pickGlb = async (file?: File | null) => {
    if (!file) return;
    const dataUrl = await readAsDataUrl(file);
    onUpdate(selected.id, {
      style: mergeStyle(selected, { glbUrl: dataUrl, sceneBuildMode: 'glb' }),
    });
  };

  const clearGlb = () => {
    const nextStyle = { ...selected.style };
    delete (nextStyle as Record<string, unknown>).glbUrl;
    nextStyle.sceneBuildMode = selected.type === 'scene3d' ? 'glb' : 'box';
    onUpdate(selected.id, { style: nextStyle });
  };

  const setStyle = (patch: Record<string, string | number | boolean | undefined>) => {
    onUpdate(selected.id, { style: mergeStyle(selected, patch) });
  };

  return (
    <Section title={selected.type === 'scene3d' ? '3D Scene Settings' : '3D View Angle'}>
      {selected.type === 'scene3d' ? (
        <p className="ins-hint">Full Page — Locks position to cover screen in Run mode</p>
      ) : null}
      {selected.style?.glbUrl ? (
        <div className="ins-media">
          <span className="ins-file-name">Model Loaded</span>
          <button type="button" className="ins-media-clear" title="DeleteModel" onClick={clearGlb}>
            <X size={14} />
          </button>
        </div>
      ) : (
        <div className="ins-empty">No Model — Select a .glb file</div>
      )}
      <label className="ins-file-btn">
        <Upload size={14} /> Select .glb/.gltf file…
        <input type="file" accept=".glb,.gltf,model/gltf-binary,model/gltf+json" hidden onChange={(e) => void pickGlb(e.target.files?.[0])} />
      </label>
      <label className="ins-check">
        <input
          type="checkbox"
          checked={selected.style?.autoRotate !== false}
          onChange={(e) => setStyle({ autoRotate: e.target.checked })}
        />
        <span>Auto Rotate</span>
      </label>
      <label className="ins-row">
        <span>Camera</span>
        <select
          value={styleStr(selected, 'cameraPreset', 'orbit')}
          onChange={(e) => setStyle({ cameraPreset: e.target.value })}
        >
          <option value="orbit">Orbit</option>
          <option value="top">Top</option>
          <option value="flat">Flat</option>
        </select>
      </label>
    </Section>
  );
}

export function IframeMiniInspector({
  selected,
  onUpdate,
}: {
  selected: GraphicObjectDefinition;
  onUpdate: (id: string, patch: Partial<GraphicObjectDefinition>) => void;
}) {
  return (
    <Section title="iFrame">
      <label className="ins-row ins-row-stack">
        <span>URL</span>
        <input
          value={styleStr(selected, 'iframeUrl', selected.text ?? '')}
          placeholder="https://example.com"
          onChange={(e) => onUpdate(selected.id, {
            text: e.target.value,
            style: mergeStyle(selected, { iframeUrl: e.target.value }),
          })}
        />
      </label>
    </Section>
  );
}

export function SpriteMiniInspector({
  selected,
  onUpdate,
}: {
  selected: GraphicObjectDefinition;
  onUpdate: (id: string, patch: Partial<GraphicObjectDefinition>) => void;
}) {
  const setStyle = (patch: Record<string, string | number | boolean | undefined>) => {
    onUpdate(selected.id, { style: mergeStyle(selected, patch) });
  };

  const pickSprite = async (file?: File | null) => {
    if (!file) return;
    const url = await readAsDataUrl(file);
    setStyle({ spriteUrl: url, imageDataUrl: url });
  };

  return (
    <Section title="Sprite Sheet">
      <label className="ins-file-btn">
        <Upload size={14} /> Upload spritesheet…
        <input type="file" accept="image/*" hidden onChange={(e) => void pickSprite(e.target.files?.[0])} />
      </label>
      <div className="ins-grid2">
        <label className="ins-row"><span>Frame W</span>
          <input type="number" min={1} value={styleNum(selected, 'frameWidth', 64)} onChange={(e) => setStyle({ frameWidth: Number(e.target.value) })} />
        </label>
        <label className="ins-row"><span>Frame H</span>
          <input type="number" min={1} value={styleNum(selected, 'frameHeight', 64)} onChange={(e) => setStyle({ frameHeight: Number(e.target.value) })} />
        </label>
        <label className="ins-row"><span>Frames</span>
          <input type="number" min={1} value={styleNum(selected, 'frameCount', 8)} onChange={(e) => setStyle({ frameCount: Number(e.target.value) })} />
        </label>
        <label className="ins-row"><span>FPS</span>
          <input type="number" min={1} value={styleNum(selected, 'fps', 12)} onChange={(e) => setStyle({ fps: Number(e.target.value) })} />
        </label>
        <label className="ins-row"><span>Play When ≥</span>
          <input type="number" step={0.1} value={styleNum(selected, 'playThreshold', 0.5)} onChange={(e) => setStyle({ playThreshold: Number(e.target.value) })} />
        </label>
      </div>
    </Section>
  );
}

export function LottieMiniInspector({
  selected,
  onUpdate,
}: {
  selected: GraphicObjectDefinition;
  onUpdate: (id: string, patch: Partial<GraphicObjectDefinition>) => void;
}) {
  const setStyle = (patch: Record<string, string | number | boolean | undefined>) => {
    onUpdate(selected.id, { style: mergeStyle(selected, patch) });
  };

  return (
    <Section title="Lottie">
      <label className="ins-row ins-row-stack">
        <span>URL / JSON</span>
        <input
          value={styleStr(selected, 'lottieUrl', '')}
          placeholder="https://…/anim.json"
          onChange={(e) => setStyle({ lottieUrl: e.target.value })}
        />
      </label>
      <label className="ins-check">
        <input type="checkbox" checked={selected.style?.loop !== false} onChange={(e) => setStyle({ loop: e.target.checked })} />
        <span>Loop</span>
      </label>
      <label className="ins-check">
        <input type="checkbox" checked={selected.style?.autoplay !== false} onChange={(e) => setStyle({ autoplay: e.target.checked })} />
        <span>Autoplay</span>
      </label>
      <label className="ins-row">
        <span>Play When tag ≥</span>
        <input type="number" step={0.1} value={styleNum(selected, 'playThreshold', 0.5)} onChange={(e) => setStyle({ playThreshold: Number(e.target.value) })} />
      </label>
    </Section>
  );
}

export function WallMiniInspector({
  selected,
  onUpdate,
}: {
  selected: GraphicObjectDefinition;
  onUpdate: (id: string, patch: Partial<GraphicObjectDefinition>) => void;
}) {
  const setStyle = (patch: Record<string, string | number | boolean | undefined>) => {
    onUpdate(selected.id, { style: mergeStyle(selected, patch) });
  };

  return (
    <Section title="Wall">
      <p className="ins-hint">Use Wall tool on canvas to draw.</p>
      <div className="ins-grid2">
        <label className="ins-row"><span>Height 3D</span>
          <input type="number" min={0} value={styleNum(selected, 'wallHeight3d', 80)} onChange={(e) => setStyle({ wallHeight3d: Number(e.target.value) })} />
        </label>
        <label className="ins-row"><span>Thickness</span>
          <input type="number" min={1} value={styleNum(selected, 'wallThickness', 16)} onChange={(e) => setStyle({ wallThickness: Number(e.target.value) })} />
        </label>
      </div>
    </Section>
  );
}

export function Cable3dMiniInspector({
  selected,
  objects,
  onUpdate,
}: {
  selected: GraphicObjectDefinition;
  objects: GraphicObjectDefinition[];
  onUpdate: (id: string, patch: Partial<GraphicObjectDefinition>) => void;
}) {
  const setStyle = (patch: Record<string, string | number | boolean | undefined>) => {
    onUpdate(selected.id, { style: mergeStyle(selected, patch) });
  };

  const wires = objects.filter((o) => o.type === 'flowpath' || o.type === 'pipe');

  return (
    <Section title="Cable 3D">
      <p className="ins-hint">Binds to a 2D line and syncs its position in Run mode.</p>
      <label className="ins-row">
        <span>Cable 2D</span>
        <select
          value={styleStr(selected, 'linkedWireId', '')}
          onChange={(e) => setStyle({ linkedWireId: e.target.value || undefined })}
        >
          <option value="">— Select flowpath/pipe —</option>
          {wires.map((w) => (
            <option key={w.id} value={w.id}>{w.name ?? w.id}</option>
          ))}
        </select>
      </label>
      <label className="ins-row">
        <span>Cable Color</span>
        <input
          type="color"
          value={styleStr(selected, 'flowColor', '#a78bfa')}
          onChange={(e) => setStyle({ flowColor: e.target.value })}
        />
      </label>
    </Section>
  );
}

export function Zone3dExtras({
  selected,
  onUpdate,
}: {
  selected: GraphicObjectDefinition;
  onUpdate: (id: string, patch: Partial<GraphicObjectDefinition>) => void;
}) {
  if (selected.type !== 'zone3d') return null;
  return (
    <Section title="Extrude 3D">
      <label className="ins-row">
        <span>Height extrude</span>
        <input
          type="number"
          min={0}
          value={styleNum(selected, 'zoneExtrudeHeight', styleNum(selected, 'wallHeight3d', 40))}
          onChange={(e) => onUpdate(selected.id, {
            style: mergeStyle(selected, { zoneExtrudeHeight: Number(e.target.value), wallHeight3d: Number(e.target.value) }),
          })}
        />
      </label>
    </Section>
  );
}

export function HotspotWithZone3d({
  selected,
  graphics,
  currentGraphicId,
  onUpdate,
}: {
  selected: GraphicObjectDefinition;
  graphics: GraphicSummary[];
  currentGraphicId: string | null;
  onUpdate: (id: string, patch: Partial<GraphicObjectDefinition>) => void;
}) {
  return (
    <>
      <Zone3dExtras selected={selected} onUpdate={onUpdate} />
      {selected.type === 'zone2d' || selected.type === 'zone3d' ? (
        <Section title="Zone">
          <label className="ins-row">
            <span>Zone Name</span>
            <input value={selected.text ?? ''} onChange={(e) => onUpdate(selected.id, { text: e.target.value })} />
          </label>
        </Section>
      ) : null}
      <NavMiniInspector selected={selected} graphics={graphics} currentGraphicId={currentGraphicId} onUpdate={onUpdate} />
      <p className="ins-hint">In Run mode, clicking this zone navigates to the selected screen.</p>
    </>
  );
}
