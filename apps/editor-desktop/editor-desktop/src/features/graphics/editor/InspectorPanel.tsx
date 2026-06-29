import { useState } from 'react';
import { ArrowUpToLine, ArrowDownToLine, Trash2, Eye, EyeOff, Lock, LockOpen } from 'lucide-react';
import type { GraphicObjectDefinition, TagSummary, DeviceSummary, GraphicSummary } from '@energylink/shared-types';
import type { HtmlAnchorMap } from '@energylink/graphics-runtime';
import { inspectorTypeLabel } from './objectCatalog';
import { isRegistryWidget } from '@energylink/widget-registry';
import { InspectorComposer } from '../widget-registry/InspectorComposer';

type Tab = 'design' | 'layers';

export type InspectorPanelProps = {
  objects: GraphicObjectDefinition[];
  selected: GraphicObjectDefinition | null;
  tags: TagSummary[];
  devices: DeviceSummary[];
  graphics: GraphicSummary[];
  currentGraphicId: string | null;
  canvasBg: string;
  isHtmlPage?: boolean;
  htmlAnchors?: HtmlAnchorMap;
  onCanvasBg: (color: string) => void;
  onSelect: (id: string | null) => void;
  onUpdate: (id: string, patch: Partial<GraphicObjectDefinition>) => void;
  onRemove: (id: string) => void;
  onReorder: (id: string, dir: 'front' | 'back') => void;
  onWrapInGroup?: (aroundId: string) => void;
  onUngroupGroup?: (groupId: string) => void;
  onStartPathEdit?: (objectId: string) => void;
  renderCanvasProps?: () => React.ReactNode;
  renderCustomInspector?: (selected: GraphicObjectDefinition) => React.ReactNode;
  /** When true, render custom inspector below registry inspector (report designer). */
  stackCustomInspector?: boolean;
  /** When true, skip registry inspector and render only the custom inspector. */
  preferCustomInspector?: boolean;
  /** Shown at top of Design tab (e.g. report page background). */
  pinnedInspectorHeader?: React.ReactNode;
  className?: string;
};

function styleNum(obj: GraphicObjectDefinition, key: string, fallback: number): number {
  const v = obj.style?.[key];
  return typeof v === 'number' ? v : fallback;
}
function styleStr(obj: GraphicObjectDefinition, key: string, fallback: string): string {
  const v = obj.style?.[key];
  return typeof v === 'string' ? v : fallback;
}

export function InspectorPanel(props: InspectorPanelProps) {
  const { objects, selected, tags, devices, graphics, currentGraphicId, canvasBg, isHtmlPage = false, htmlAnchors, renderCanvasProps, renderCustomInspector, stackCustomInspector = false, preferCustomInspector = false, pinnedInspectorHeader, onCanvasBg, onSelect, onUpdate, onRemove, onReorder, onWrapInGroup, onUngroupGroup, onStartPathEdit } = props;
  const [tab, setTab] = useState<Tab>('design');

  const sortedLayers = [...objects].sort((a, b) => (b.layer ?? 0) - (a.layer ?? 0));
  const usesRegistryInspector = selected ? isRegistryWidget(selected.type) : false;

  return (
    <aside className={`ins-panel ${props.className || ''}`.trim()}>
      <div className="ins-tabs">
        <button className={tab === 'design' ? 'active' : ''} onClick={() => setTab('design')}>Design</button>
        <button className={tab === 'layers' ? 'active' : ''} onClick={() => setTab('layers')}>
          Layers <span className="ins-count">{objects.length}</span>
        </button>
      </div>

      {tab === 'design' ? (
        <div className="ins-body">
          {pinnedInspectorHeader}
          {!selected ? (
            <>
              {renderCanvasProps ? renderCanvasProps() : (
                <>
                  <div className="ins-empty">Select a widget on the canvas or from the Layers tab &middot; Media library is in the "Media" tab on the left</div>
                  <section className="ins-sec ins-canvas-sec">
                    <h4>Canvas</h4>
                    <label className="ins-row">
                      <span>Background</span>
                      <input type="color" value={canvasBg} onChange={(e) => onCanvasBg(e.target.value)} />
                    </label>
                  </section>
                </>
              )}
            </>
          ) : (
            <>
              <div className="ins-selection-banner">
                {inspectorTypeLabel(selected.type)}
                <span>·</span>
                {selected.name ?? selected.id.slice(-6)}
                <div className="ins-sec-actions ins-sec-actions-inline">
                  <button type="button" title="Bring to front" onClick={() => onReorder(selected.id, 'front')}>
                    <ArrowUpToLine size={16} />
                  </button>
                  <button type="button" title="Send to back" onClick={() => onReorder(selected.id, 'back')}>
                    <ArrowDownToLine size={16} />
                  </button>
                  <button type="button" className="danger" title="Delete" onClick={() => onRemove(selected.id)}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              {!stackCustomInspector ? (
              <section className="ins-sec">
                <div className="ins-sec-head">
                  <h4>{inspectorTypeLabel(selected.type)}</h4>
                  <div className="ins-sec-actions">
                    <button title="Bring to front" onClick={() => onReorder(selected.id, 'front')}>
                      <ArrowUpToLine size={16} />
                    </button>
                    <button title="Send to back" onClick={() => onReorder(selected.id, 'back')}>
                      <ArrowDownToLine size={16} />
                    </button>
                    <button className="danger" title="Delete" onClick={() => onRemove(selected.id)}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <label className="ins-row">
                  <span>Name</span>
                  <input value={selected.name ?? ''} onChange={(e) => onUpdate(selected.id, { name: e.target.value })} />
                </label>
                <div className="ins-grid2" style={{ marginTop: 8 }}>
                  <label className="ins-row"><span>X</span><input type="number" value={selected.x} onChange={(e) => onUpdate(selected.id, { x: Number(e.target.value) })} /></label>
                  <label className="ins-row"><span>Y</span><input type="number" value={selected.y} onChange={(e) => onUpdate(selected.id, { y: Number(e.target.value) })} /></label>
                  <label className="ins-row"><span>W</span><input type="number" value={selected.width} onChange={(e) => onUpdate(selected.id, { width: Number(e.target.value) })} /></label>
                  <label className="ins-row"><span>H</span><input type="number" value={selected.height} onChange={(e) => onUpdate(selected.id, { height: Number(e.target.value) })} /></label>
                </div>
              </section>
              ) : null}

              {preferCustomInspector && renderCustomInspector ? (
                renderCustomInspector(selected)
              ) : usesRegistryInspector ? (
                <>
                  <InspectorComposer
                    selected={selected}
                    tags={tags}
                    devices={devices}
                    graphics={graphics}
                    currentGraphicId={currentGraphicId}
                    objects={objects}
                    onUngroupGroup={onUngroupGroup}
                    onStartPathEdit={onStartPathEdit}
                    onUpdate={onUpdate}
                    hiddenGroups={stackCustomInspector ? ['layout', 'transform'] : undefined}
                  />
                  {stackCustomInspector && renderCustomInspector ? renderCustomInspector(selected) : null}
                </>
              ) : renderCustomInspector ? (
                renderCustomInspector(selected)
              ) : (
                <div className="ins-empty">No properties available for this widget</div>
              )}
            </>
          )}

          {selected && !stackCustomInspector ? (
            <section className="ins-sec ins-canvas-sec">
              <h4>Canvas</h4>
              <label className="ins-row">
                <span>Background</span>
                <input type="color" value={canvasBg} onChange={(e) => onCanvasBg(e.target.value)} />
              </label>
            </section>
          ) : null}
        </div>
      ) : (
        <div className="ins-body">
          {sortedLayers.length === 0 ? (
            <div className="ins-empty">No Object Selected</div>
          ) : (
            <ul className="ins-layers">
              {sortedLayers.map((o) => (
                <li
                  key={o.id}
                  className={`ins-layer${o.id === selected?.id ? ' active' : ''}`}
                  onClick={() => onSelect(o.id)}
                >
                  <button
                    className="ins-layer-vis"
                    title={o.visible === false ? 'Show' : 'Hide'}
                    onClick={(e) => { e.stopPropagation(); onUpdate(o.id, { visible: o.visible === false }); }}
                  >
                    {o.visible === false ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                  <span className="ins-layer-name">{o.name ?? o.type}</span>
                  <span className="ins-layer-type">{o.type}</span>
                  <button
                    className="ins-layer-lock"
                    title={o.locked ? 'Unlock' : 'Lock'}
                    onClick={(e) => { e.stopPropagation(); onUpdate(o.id, { locked: !o.locked }); }}
                  >
                    {o.locked ? <Lock size={16} /> : <LockOpen size={16} />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </aside>
  );
}
