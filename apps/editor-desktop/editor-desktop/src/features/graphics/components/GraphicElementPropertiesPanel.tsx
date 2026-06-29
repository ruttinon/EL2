import React, { useState } from 'react';
import { Icon } from '@iconify/react';
import type { DeviceSummary, GraphicAsset, GraphicObjectDefinition, GraphicSummary, TagSummary } from '@energylink/shared-types';
import { DEFAULT_BUS_PORTS, DEFAULT_MM_PER_PX, resolveUnifiedLayer, type GraphicUnifiedLayer } from '@energylink/shared-types';
import {
  applySceneDefaultsToStyle,
  defaultPortsForType,
  dimensionsFromRealWorld,
  formatMemberIds,
  parseMemberIds,
  resolveCableEndpoints,
  resolveRenderMode,
  resolveWireEndpoints,
  validateFormulaSyntax,
} from '@energylink/graphics-runtime';
import { ElementQuickPanel } from '../ElementQuickPanel';
import { hexForColorInput } from '../colorInput';
import { allSymbols, symbolById } from '../graphicSymbols';
import { GraphicAssetPicker } from '../GraphicAssetPicker';
import type { ImageToGlbMode } from '../imageToGlb';
import { pickFlowStyle, type FlowStyleSnapshot } from '../../../api/editorRuntimeApi';
import { MIN_OBJECT_SIZE, type DisplayMode, type ExtendedObject, type ObjectDisplayExtra } from '../elementPanelTypes';

export type GraphicElementPropertiesPanelProps = {
  object: GraphicObjectDefinition | null;
  selectedExtra: ObjectDisplayExtra | null;
  elementPropMode: 'quick' | 'advanced';
  onElementPropModeChange: (mode: 'quick' | 'advanced') => void;
  selectedGraphic: GraphicSummary;
  graphics: GraphicSummary[];
  tags: TagSummary[];
  filteredBindingTags: TagSummary[];
  devices: DeviceSummary[];
  images: Array<{ id: string; name: string; dataUrl: string }>;
  model3dAssets: Array<{ id: string; name: string; url: string }>;
  splineAssets: Array<{ id: string; name: string; url: string }>;
  assets: GraphicAsset[];
  bindingDeviceId: string;
  onBindingDeviceChange: (id: string) => void;
  copiedFlowStyle: FlowStyleSnapshot | null;
  sceneScaleMmPerPx: number;
  onUpdate: (patch: Partial<GraphicObjectDefinition & ObjectDisplayExtra>) => void;
  onBindTag: (tagId: string) => void;
  onBindFlowTag: (tagId: string) => void;
  onBindEnableTag: (tagId: string) => void;
  onPickImage: (imageId: string) => void;
  onImportImage: () => void;
  onImportGlb: () => void;
  onConvertTo3dBox: () => void;
  onConvertToGlb: (mode: ImageToGlbMode) => void;
  onStartPathEdit: (objectId: string, message: string) => void;
  onSyncCable: () => void;
  onShowNotice: (notice: { kind: 'success' | 'error'; text: string }) => void;
  onCopyFlowStyle: (style: FlowStyleSnapshot) => void;
  onSetDisplayMode: (mode: DisplayMode) => void;
  onApplyGlbPorts: () => void;
  onWrapSelectionInGroup: () => void;
  onUngroupSelected: () => void;
  onMakeComposite: () => void;
  onDuplicateObject: () => void;
  onBringForward: () => void;
  onSendBackward: () => void;
  onDeleteObject: () => void;
  onAlignSelected: (align: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => void;
};

export function GraphicElementPropertiesPanel({
  object,
  selectedExtra,
  elementPropMode,
  onElementPropModeChange,
  selectedGraphic,
  graphics,
  tags,
  filteredBindingTags,
  devices,
  images,
  model3dAssets,
  splineAssets,
  assets,
  bindingDeviceId,
  onBindingDeviceChange,
  copiedFlowStyle,
  sceneScaleMmPerPx,
  onUpdate,
  onBindTag,
  onBindFlowTag,
  onBindEnableTag,
  onPickImage,
  onImportImage,
  onImportGlb,
  onConvertTo3dBox,
  onConvertToGlb,
  onStartPathEdit,
  onSyncCable,
  onShowNotice,
  onCopyFlowStyle,
  onSetDisplayMode,
  onApplyGlbPorts,
  onWrapSelectionInGroup,
  onUngroupSelected,
  onMakeComposite,
  onDuplicateObject,
  onBringForward,
  onSendBackward,
  onDeleteObject,
  onAlignSelected,
}: GraphicElementPropertiesPanelProps) {
  if (!object) {
    return (
      <div style={{ borderTop: '2px solid #edf4f7', paddingTop: '14px', marginTop: '14px', textAlign: 'center' }}>
        <p className="muted" style={{ fontSize: '12px' }}>Select an Element on the Canvas to configure its properties.</p>
      </div>
    );
  }
  const selectedObject = object;
  const [activeTab, setActiveTab] = useState<'general' | 'layout' | 'style' | 'data' | 'condition'>('general');

  return (
    <>
    {elementPropMode === 'quick' ? (
                  <ElementQuickPanel
                    object={selectedObject}
                    tags={filteredBindingTags}
                    images={images}
                    model3dAssets={model3dAssets}
                    splineAssets={splineAssets}
                    onUpdate={(patch) => onUpdate(patch as Partial<GraphicObjectDefinition & ObjectDisplayExtra>)}
                    onBindTag={onBindTag}
                    onBindFlowTag={onBindFlowTag}
                    onPickImage={onPickImage}
                    onImportImage={() => onImportImage()}
                    onImportGlb={() => onImportGlb()}
                    onConvertTo3dBox={onConvertTo3dBox}
                    onConvertToGlb={(mode) => void onConvertToGlb(mode)}
                    onDrawPath={() => { onStartPathEdit(selectedObject.id, 'คลิก canvas เพื่อเพิ่มจุด · Enter จบ · Esc ยกเลิก'); }}
                    onSyncCable={onSyncCable}
                    onShowAdvanced={() => onElementPropModeChange('advanced')}
                  />
                ) : (
                <div className="prop-section" style={{ borderTop: '2px solid #edf4f7', paddingTop: '14px', marginTop: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, alignItems: 'center' }}>
                    <b style={{ fontSize: 13 }}>Properties (Advanced)</b>
                    <button type="button" className="btn secondary tiny" onClick={() => onElementPropModeChange('quick')}>← กลับ Quick</button>
                  </div>
                  
                  <div className="prop-side-tabs" style={{ marginBottom: 12, display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 4 }}>
                    <button type="button" className={activeTab === 'general' ? 'active' : ''} onClick={() => setActiveTab('general')} style={{ flex: 1, padding: '4px 8px', fontSize: 11 }}>General</button>
                    <button type="button" className={activeTab === 'layout' ? 'active' : ''} onClick={() => setActiveTab('layout')} style={{ flex: 1, padding: '4px 8px', fontSize: 11 }}>Layout</button>
                    <button type="button" className={activeTab === 'style' ? 'active' : ''} onClick={() => setActiveTab('style')} style={{ flex: 1, padding: '4px 8px', fontSize: 11 }}>Style</button>
                    <button type="button" className={activeTab === 'data' ? 'active' : ''} onClick={() => setActiveTab('data')} style={{ flex: 1, padding: '4px 8px', fontSize: 11 }}>Data</button>
                    <button type="button" className={activeTab === 'condition' ? 'active' : ''} onClick={() => setActiveTab('condition')} style={{ flex: 1, padding: '4px 8px', fontSize: 11 }}>Condition</button>
                  </div>

                  {activeTab === 'general' && (
                    <div className="prop-card-group">
                      <div className="prop-card-group-title">
                        <Icon icon="solar:info-circle-bold-duotone" width="14" height="14" style={{ marginRight: 6 }} /> General Settings
                      </div>
                      <label>Name<input value={selectedObject.name} onChange={(event) => onUpdate({ name: event.target.value })} /></label>
                      <label>Text / Label<input value={selectedObject.text || ''} onChange={(event) => onUpdate({ text: event.target.value })} /></label>
                      <label style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
                        <input type="checkbox" checked={selectedObject.visible !== false} onChange={(e) => onUpdate({ visible: e.target.checked })} /> Visible on Canvas
                      </label>
                      <label style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                        <input type="checkbox" checked={selectedObject.locked === true} onChange={(e) => onUpdate({ locked: e.target.checked })} /> Lock Position
                      </label>
                    </div>
                  )}

                  {activeTab === 'layout' && (
                    <>
                      <div className="prop-card-group">
                        <div className="prop-card-group-title">
                          <Icon icon="solar:ruler-bold-duotone" width="14" height="14" style={{ marginRight: 6 }} /> Size & Position
                        </div>
                        <div className="two-col">
                          <label>X (Left)<input type="number" value={selectedObject.x} onChange={(event) => onUpdate({ x: Number(event.target.value) })} /></label>
                          <label>Y (Top)<input type="number" value={selectedObject.y} onChange={(event) => onUpdate({ y: Number(event.target.value) })} /></label>
                          <label>Width<input type="number" min={MIN_OBJECT_SIZE} value={selectedObject.width} onChange={(event) => onUpdate({ width: Number(event.target.value) })} /></label>
                          <label>Height<input type="number" min={MIN_OBJECT_SIZE} value={selectedObject.height} onChange={(event) => onUpdate({ height: Number(event.target.value) })} /></label>
                        </div>
                      </div>

                      {/* Actions & Layering */}
                      <div className="prop-card-group">
                        <div className="prop-card-group-title">
                          <Icon icon="solar:bolt-bold-duotone" width="14" height="14" style={{ marginRight: 6 }} /> Actions & Alignment
                        </div>

                        <div className="button-row compact" style={{ justifyContent: 'flex-start', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
                          <button className="btn secondary tiny" onClick={onWrapSelectionInGroup} title="Group selected object" style={{ fontSize: '11px', padding: '4px 8px' }}>
                            <Icon icon="solar:layers-minimalistic-bold-duotone" width="14" height="14" style={{ marginRight: 4, color: '#64748b', verticalAlign: 'middle' }} />
                            Group
                          </button>
                          <button className="btn secondary tiny" onClick={onDuplicateObject} title="Duplicate element" style={{ fontSize: '11px', padding: '4px 8px' }}>
                            <Icon icon="solar:copy-bold-duotone" width="14" height="14" style={{ marginRight: 4, color: '#6366f1', verticalAlign: 'middle' }} />
                            Duplicate
                          </button>
                          <button className="btn secondary tiny" onClick={onBringForward} title="Bring element to top layer" style={{ fontSize: '11px', padding: '4px 8px' }}>
                            <Icon icon="solar:arrow-up-circle-bold-duotone" width="14" height="14" style={{ marginRight: 4, color: '#10b981', verticalAlign: 'middle' }} />
                            Front
                          </button>
                          <button className="btn secondary tiny" onClick={onSendBackward} title="Send element to back layer" style={{ fontSize: '11px', padding: '4px 8px' }}>
                            <Icon icon="solar:arrow-down-circle-bold-duotone" width="14" height="14" style={{ marginRight: 4, color: '#ef4444', verticalAlign: 'middle' }} />
                            Back
                          </button>
                          <button className="btn danger tiny" onClick={onDeleteObject} title="Delete element" style={{ fontSize: '11px', padding: '4px 8px' }}>
                            <Icon icon="solar:trash-bin-trash-bold-duotone" width="14" height="14" style={{ marginRight: 4, color: '#fca5a5', verticalAlign: 'middle' }} />
                            Delete
                          </button>
                        </div>

                        <div className="prop-hint" style={{ marginBottom: '4px' }}>Canvas Alignment</div>
                        <div className="alignment-icon-grid">
                          <button className="btn-align-icon" onClick={() => onAlignSelected('left')} title="Align left edge">
                            <Icon icon="solar:align-left-bold-duotone" width="18" height="18" />
                          </button>
                          <button className="btn-align-icon" onClick={() => onAlignSelected('center')} title="Align horizontal center">
                            <Icon icon="solar:align-horizonal-center-bold-duotone" width="18" height="18" />
                          </button>
                          <button className="btn-align-icon" onClick={() => onAlignSelected('right')} title="Align right edge">
                            <Icon icon="solar:align-right-bold-duotone" width="18" height="18" />
                          </button>
                          <button className="btn-align-icon" onClick={() => onAlignSelected('top')} title="Align top edge">
                            <Icon icon="solar:align-top-bold-duotone" width="18" height="18" />
                          </button>
                          <button className="btn-align-icon" onClick={() => onAlignSelected('middle')} title="Align vertical middle">
                            <Icon icon="solar:align-vertical-center-bold-duotone" width="18" height="18" />
                          </button>
                          <button className="btn-align-icon" onClick={() => onAlignSelected('bottom')} title="Align bottom edge">
                            <Icon icon="solar:align-bottom-bold-duotone" width="18" height="18" />
                          </button>
                        </div>
                      </div>
                    </>
                  )}

                  {activeTab === 'style' && (
                    <>
                      {/* Scene Composition */}
                      <div className="prop-card-group">
                        <div className="prop-card-group-title">
                          <Icon icon="solar:cube-bold-duotone" width="14" height="14" style={{ marginRight: 6 }} /> Scene Composition
                        </div>
                        <label>Render Mode
                          <select
                            value={String(selectedObject.style?.renderMode ?? resolveRenderMode(selectedObject))}
                            onChange={(event) => onUpdate({ style: applySceneDefaultsToStyle(selectedObject.type, { ...selectedObject.style, renderMode: event.target.value }) })}
                          >
                            <option value="scene">Scene (no chrome)</option>
                            <option value="wire">Wire (line only)</option>
                            <option value="overlay">Overlay (transparent)</option>
                            <option value="panel">Panel (widget box)</option>
                          </select>
                        </label>
                        <label>Scene Layer
                          <select
                            value={String(selectedObject.style?.sceneLayer ?? 'overlay')}
                            onChange={(event) => onUpdate({ style: { ...selectedObject.style, sceneLayer: event.target.value } })}
                          >
                            <option value="background">Background</option>
                            <option value="scene">Scene 3D</option>
                            <option value="wiring">Wiring</option>
                            <option value="equipment">Equipment</option>
                            <option value="overlay">Data Overlay</option>
                          </select>
                        </label>
                        <label>Frame layer (unified)
                          <select
                            value={resolveUnifiedLayer(selectedObject)}
                            onChange={(event) => onUpdate({
                              style: {
                                ...selectedObject.style,
                                unifiedLayer: event.target.value as GraphicUnifiedLayer,
                              },
                            })}
                          >
                            <option value="diagram">Diagram — SLD / equipment</option>
                            <option value="hud">HUD — floats above 3D</option>
                            <option value="world">World — walls / 3D scene</option>
                          </select>
                        </label>
                        <div className="two-col">
                          <label>Real width (mm)<input type="number" min={1} value={Number(selectedObject.style?.realWidthMm ?? '') || ''} onChange={(event) => onUpdate({ style: { ...selectedObject.style, realWidthMm: event.target.value === '' ? undefined : Number(event.target.value) } })} /></label>
                          <label>Real height (mm)<input type="number" min={1} value={Number(selectedObject.style?.realHeightMm ?? '') || ''} onChange={(event) => onUpdate({ style: { ...selectedObject.style, realHeightMm: event.target.value === '' ? undefined : Number(event.target.value) } })} /></label>
                          <label>Floor level (optional)<input type="number" min={0} placeholder="all" value={selectedObject.style?.floorLevel != null ? Number(selectedObject.style.floorLevel) : ''} onChange={(event) => onUpdate({ style: { ...selectedObject.style, floorLevel: event.target.value === '' ? undefined : Number(event.target.value) } })} /></label>
                        </div>
                        <button
                          type="button"
                          className="btn secondary tiny"
                          style={{ marginTop: 6 }}
                          onClick={() => {
                            const rw = Number(selectedObject.style?.realWidthMm);
                            const rh = Number(selectedObject.style?.realHeightMm);
                            if (!rw || !rh) {
                              onShowNotice({ kind: 'error', text: 'Set real width and height (mm) first.' });
                              return;
                            }
                            const mmPerPx = sceneScaleMmPerPx;
                            const dims = dimensionsFromRealWorld(rw, rh, mmPerPx);
                            onUpdate({ width: dims.width, height: dims.height });
                            onShowNotice({ kind: 'success', text: `Resized to ${dims.width}×${dims.height}px from real size.` });
                          }}
                        >
                          Apply real-world scale to size
                        </button>
                        {['elecsymbol', 'image', 'viewport3d', 'hotspot'].includes(selectedObject.type) ? (
                          <label style={{ marginTop: 8 }}>Connection ports (id:x,y:label;…)
                            <input
                              value={String(selectedObject.style?.ports ?? defaultPortsForType(selectedObject.type))}
                              onChange={(event) => onUpdate({ style: { ...selectedObject.style, ports: event.target.value } })}
                              placeholder="out:0.92,0.5:Out;in:0.08,0.5:In"
                            />
                          </label>
                        ) : null}
                        {selectedObject.type === 'image' ? (
                          <GraphicAssetPicker
                            assets={assets}
                            kind="image"
                            label="Image from library"
                            value={String(selectedObject.style?.imageDataUrl ?? selectedExtra?.imageDataUrl ?? '')}
                            onChange={(url) => onUpdate({ imageDataUrl: url, style: { ...selectedObject.style, imageDataUrl: url }, displayMode: 'image' } as Partial<ExtendedObject>)}
                          />
                        ) : null}
                        {selectedObject.type === 'image' ? (
                          <label style={{ marginTop: 8 }}>Image fit
                            <select value={String(selectedObject.style?.objectFit ?? 'contain')} onChange={(event) => onUpdate({ style: { ...selectedObject.style, objectFit: event.target.value } })}>
                              <option value="contain">Contain</option>
                              <option value="cover">Cover</option>
                              <option value="fill">Fill</option>
                            </select>
                          </label>
                        ) : null}
                        {['viewport3d', 'scene3d'].includes(selectedObject.type) ? (
                          <>
                            <label style={{ marginTop: 8 }}>Camera preset
                              <select value={String(selectedObject.style?.cameraPreset ?? 'isometric')} onChange={(event) => onUpdate({ style: { ...selectedObject.style, cameraPreset: event.target.value } })}>
                                <option value="juddesk">Juddesk (45°)</option>
                                <option value="isometric">Isometric</option>
                                <option value="top">Top down</option>
                                <option value="free">Free orbit</option>
                              </select>
                            </label>
                            <button
                              type="button"
                              className="btn secondary tiny"
                              style={{ marginTop: 8 }}
                              onClick={() => void onApplyGlbPorts()}
                            >
                              Auto GLB ports
                            </button>
                          </>
                        ) : null}
                      </div>

                      {/* Appearance & Style */}
                      <div className="prop-card-group">
                        <div className="prop-card-group-title">
                          <Icon icon="solar:monitor-bold-duotone" width="14" height="14" style={{ marginRight: 6 }} /> Style & Display
                        </div>
                        
                        <div className="display-mode-toggle" style={{ marginBottom: '12px' }}>
                          <button
                            className={`mode-btn ${selectedExtra?.displayMode !== 'image' ? 'active' : ''}`}
                            onClick={() => onSetDisplayMode('text')}
                            title="Show text value"
                          >
                            <Icon icon="solar:text-bold-duotone" width="14" height="14" /> Text Mode
                          </button>
                          <button
                            className={`mode-btn ${selectedExtra?.displayMode === 'image' ? 'active' : ''}`}
                            onClick={() => onSetDisplayMode('image')}
                            title="Show image / device icon"
                          >
                            <Icon icon="solar:gallery-bold-duotone" width="14" height="14" /> Image Mode
                          </button>
                        </div>

                        {selectedExtra?.displayMode === 'image' && (
                          <div className="image-picker-section" style={{ borderBottom: '1px solid #edf4f7', paddingBottom: '10px', marginBottom: '10px' }}>
                            <div className="prop-hint">Library Assets (Setup → Assets)</div>
                            {images.length === 0 ? (
                              <div className="prop-hint" style={{ color: 'var(--color-warning, #f59e0b)' }}>
                                No images in library.
                              </div>
                            ) : (
                              <div className="image-picker-grid">
                                {images.map((img) => (
                                  <button
                                    key={img.id}
                                    className={`image-picker-item ${selectedExtra?.imageId === img.id ? 'selected' : ''}`}
                                    onClick={() => onPickImage(img.id)}
                                    title={img.name}
                                  >
                                    <img src={img.dataUrl} alt={img.name} />
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        <div className="two-col">
                          <label>Text Color<input type="color" value={String(selectedObject.style?.color ?? '#142033')} onChange={(event) => onUpdate({ style: { ...selectedObject.style, color: event.target.value } })} /></label>
                          <label>Background<input type="color" value={hexForColorInput(selectedObject.style?.background, '#ffffff')} onChange={(event) => onUpdate({ style: { ...selectedObject.style, background: event.target.value } })} /></label>
                          <label>Border<input type="color" value={hexForColorInput(selectedObject.style?.stroke, '#9fc4cc')} onChange={(event) => onUpdate({ style: { ...selectedObject.style, stroke: event.target.value } })} /></label>
                          <label>Font Size<input type="number" min={8} max={72} value={Number(selectedObject.style?.fontSize ?? 16)} onChange={(event) => onUpdate({ style: { ...selectedObject.style, fontSize: Number(event.target.value) } })} /></label>
                          <label>Opacity<input type="number" min={0} max={1} step={0.05} value={Number(selectedObject.style?.opacity ?? 1)} onChange={(event) => onUpdate({ style: { ...selectedObject.style, opacity: Number(event.target.value) } })} /></label>
                          <label>Rotation°<input type="number" min={-180} max={180} value={Number(selectedObject.style?.rotation ?? 0)} onChange={(event) => onUpdate({ style: { ...selectedObject.style, rotation: Number(event.target.value) } })} /></label>
                        </div>

                        {selectedObject.type === 'text' ? (
                          <label style={{ marginTop: 8 }}>Dynamic text — use {'{name}'}, {'{value}'}, {'{unit}'}
                            <input value={selectedObject.text || ''} onChange={(e) => onUpdate({ text: e.target.value })} placeholder="{name}: {value} {unit}" />
                          </label>
                        ) : null}

                        {selectedObject.type === 'group' ? (
                          <div style={{ marginTop: 10, borderTop: '1px solid #edf4f7', paddingTop: 10 }}>
                            <div className="prop-hint" style={{ fontWeight: 700, marginBottom: 6 }}>Group Members</div>
                            <select
                              multiple
                              size={6}
                              value={parseMemberIds(selectedObject.style?.memberIds)}
                              onChange={(e) => {
                                const ids = Array.from(e.target.selectedOptions).map((o) => o.value);
                                onUpdate({ style: { ...selectedObject.style, memberIds: formatMemberIds(ids) } });
                              }}
                              style={{ width: '100%' }}
                            >
                              {(selectedGraphic?.layout?.objects ?? []).filter((o) => o.id !== selectedObject.id && o.type !== 'group').map((o) => (
                                <option key={o.id} value={o.id}>{o.name} ({o.type})</option>
                              ))}
                            </select>
                            <button type="button" className="btn secondary tiny" style={{ marginTop: 6 }} onClick={onWrapSelectionInGroup}>
                              Create group around this object
                            </button>
                            <button type="button" className="btn secondary tiny" style={{ marginTop: 6, marginLeft: 6 }} onClick={onUngroupSelected}>
                              Ungroup
                            </button>
                            <button type="button" className="btn secondary tiny" style={{ marginTop: 6, marginLeft: 6 }} onClick={onMakeComposite}>
                              Make composite equipment
                            </button>
                            <label style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
                              <input type="checkbox" checked={selectedObject.style?.composite === true} onChange={(e) => onUpdate({ style: { ...selectedObject.style, composite: e.target.checked } })} />
                              Composite equipment (shared ports, clickable)
                            </label>
                          </div>
                        ) : null}

                        {(selectedObject.type === 'bussection' || selectedObject.type === 'feedlabel' || selectedObject.type === 'zone2d') && (
                          <div style={{ marginTop: 10, borderTop: '1px solid #edf4f7', paddingTop: 10 }}>
                            {selectedObject.type === 'bussection' && (
                              <>
                                <label>Bus Color<input type="color" value={hexForColorInput(selectedObject.style?.stroke, '#173047')} onChange={(e) => onUpdate({ style: { ...selectedObject.style, stroke: e.target.value } })} /></label>
                                <label>Ports (tap points)<textarea rows={2} value={String(selectedObject.style?.ports ?? DEFAULT_BUS_PORTS)} onChange={(e) => onUpdate({ style: { ...selectedObject.style, ports: e.target.value } })} /></label>
                              </>
                            )}
                            {selectedObject.type === 'feedlabel' && (
                              <>
                                <label>Label Prefix<input value={String(selectedObject.style?.labelPrefix ?? selectedObject.text ?? '')} onChange={(e) => onUpdate({ style: { ...selectedObject.style, labelPrefix: e.target.value } })} /></label>
                              </>
                            )}
                            {selectedObject.type === 'zone2d' && (
                              <>
                                <label>Zone Label<input value={String(selectedObject.style?.zoneLabel ?? selectedObject.text ?? '')} onChange={(e) => onUpdate({ style: { ...selectedObject.style, zoneLabel: e.target.value } })} /></label>
                                <label>Floor Level<input type="number" value={Number(selectedObject.style?.floorLevel ?? 0)} onChange={(e) => onUpdate({ style: { ...selectedObject.style, floorLevel: Number(e.target.value) } })} /></label>
                              </>
                            )}
                          </div>
                        )}

                        {selectedObject.type === 'piechart' && (
                          <label style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, borderTop: '1px solid #edf4f7', paddingTop: 8 }}>
                            <input type="checkbox" checked={selectedObject.style?.donut === true} onChange={(e) => onUpdate({ style: { ...selectedObject.style, donut: e.target.checked } })} />
                            Donut style
                          </label>
                        )}

                        {selectedObject.type === 'gauge' || selectedObject.type === 'levelbar' || selectedObject.type === 'slider' ? (
                          <div className="two-col" style={{ marginTop: '10px', borderTop: '1px solid #edf4f7', paddingTop: '10px' }}>
                            <label>Min Value<input type="number" value={Number(selectedObject.style?.min ?? 0)} onChange={(event) => onUpdate({ style: { ...selectedObject.style, min: Number(event.target.value) } })} /></label>
                            <label>Max Value<input type="number" value={Number(selectedObject.style?.max ?? 100)} onChange={(event) => onUpdate({ style: { ...selectedObject.style, max: Number(event.target.value) } })} /></label>
                          </div>
                        ) : null}

                        {selectedObject.type === 'led' ? (
                          <div className="two-col" style={{ marginTop: '10px', borderTop: '1px solid #edf4f7', paddingTop: '10px' }}>
                            <label>On Color<input type="color" value={String(selectedObject.style?.onColor ?? '#22c55e')} onChange={(event) => onUpdate({ style: { ...selectedObject.style, onColor: event.target.value } })} /></label>
                            <label>Off Color<input type="color" value={String(selectedObject.style?.offColor ?? '#94a3b8')} onChange={(event) => onUpdate({ style: { ...selectedObject.style, offColor: event.target.value } })} /></label>
                          </div>
                        ) : null}

                        {selectedObject.type === 'multistate' ? (
                          <div style={{ marginTop: '10px', borderTop: '1px solid #edf4f7', paddingTop: '10px' }}>
                            <label>States (comma separated, in value order)
                              <input
                                value={String(selectedObject.style?.states ?? 'Stopped,Running,Fault')}
                                onChange={(event) => onUpdate({ style: { ...selectedObject.style, states: event.target.value } })}
                              />
                            </label>
                          </div>
                        ) : null}

                        {selectedObject.type === 'navbutton' || selectedObject.type === 'hotspot' || selectedObject.type === 'zone3d' || selectedObject.type === 'zone2d' ? (
                          <div style={{ marginTop: '10px', borderTop: '1px solid #edf4f7', paddingTop: '10px' }}>
                            {selectedObject.type === 'zone3d' ? (
                              <>
                                <label>Zone Label
                                  <input
                                    value={String(selectedObject.style?.zoneLabel ?? selectedObject.text ?? '')}
                                    onChange={(event) => onUpdate({ text: event.target.value, style: { ...selectedObject.style, zoneLabel: event.target.value } })}
                                  />
                                </label>
                                <label style={{ marginTop: 8 }}>Extrude height (3D px)
                                  <input
                                    type="number"
                                    min={0}
                                    value={Number(selectedObject.style?.zoneExtrudeHeight ?? selectedObject.style?.wallHeight3d ?? 40)}
                                    onChange={(event) => onUpdate({ style: { ...selectedObject.style, zoneExtrudeHeight: Number(event.target.value) } })}
                                  />
                                </label>
                              </>
                            ) : null}
                            <label style={{ marginTop: selectedObject.type === 'zone3d' ? 8 : 0 }}>Target Graphic (drill-down)
                              <select
                                value={(selectedObject as ExtendedObject).navigateTo || ''}
                                onChange={(event) => onUpdate({ navigateTo: event.target.value } as Partial<GraphicObjectDefinition & ObjectDisplayExtra>)}
                              >
                                <option value="">— Select graphic —</option>
                                {graphics.filter((g) => g.id !== selectedGraphic.id).map((g) => (
                                  <option key={g.id} value={g.id}>{g.name}</option>
                                ))}
                              </select>
                            </label>
                            {selectedObject.type === 'hotspot' ? (
                              <label style={{ marginTop: 8 }}>Hotspot Action
                                <select
                                  value={String(selectedObject.style?.hotspotAction ?? 'tooltip')}
                                  onChange={(event) => onUpdate({ style: { ...selectedObject.style, hotspotAction: event.target.value } })}
                                >
                                  <option value="tooltip">Show tooltip</option>
                                  <option value="navigate">Navigate to graphic</option>
                                </select>
                              </label>
                            ) : null}
                          </div>
                        ) : null}

                        {selectedObject.type === 'clock' ? (
                          <div style={{ marginTop: 10, borderTop: '1px solid #edf4f7', paddingTop: 10 }}>
                            <label>Time source
                              <select
                                value={String(selectedObject.style?.clockFormat ?? 'local')}
                                onChange={(e) => onUpdate({ style: { ...selectedObject.style, clockFormat: e.target.value } })}
                              >
                                <option value="local">Local (browser)</option>
                                <option value="utc">UTC</option>
                                <option value="server">Server (Engine /api/time)</option>
                              </select>
                            </label>
                            <label style={{ marginTop: 8 }}>Display
                              <select
                                value={String(selectedObject.style?.clockTimeStyle ?? '24h')}
                                onChange={(e) => onUpdate({ style: { ...selectedObject.style, clockTimeStyle: e.target.value } })}
                              >
                                <option value="24h">24-hour</option>
                                <option value="12h">12-hour</option>
                              </select>
                            </label>
                            <div className="two-col" style={{ marginTop: 8 }}>
                              <label style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <input type="checkbox" checked={selectedObject.style?.showDate !== false} onChange={(e) => onUpdate({ style: { ...selectedObject.style, showDate: e.target.checked } })} />
                                Show date
                              </label>
                              <label style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <input type="checkbox" checked={selectedObject.style?.showSeconds !== false} onChange={(e) => onUpdate({ style: { ...selectedObject.style, showSeconds: e.target.checked } })} />
                                Show seconds
                              </label>
                            </div>
                          </div>
                        ) : null}

                        {selectedObject.type === 'tabbar' ? (
                          <label style={{ marginTop: 8 }}>Tabs (Label:GraphicId, comma-separated)
                            <input
                              value={String(selectedObject.style?.tabs ?? '')}
                              onChange={(event) => onUpdate({ style: { ...selectedObject.style, tabs: event.target.value } })}
                              placeholder="Home:graphic_id,Floor:other_id"
                            />
                          </label>
                        ) : null}

                        {selectedObject.type === 'sprite' ? (
                          <div style={{ marginTop: 10, borderTop: '1px solid #edf4f7', paddingTop: 10 }}>
                            <div className="prop-hint" style={{ marginBottom: 6 }}>Sprite Sheet (CSS steps animation)</div>
                            <label>Sprite URL
                              <input
                                value={String(selectedObject.style?.spriteUrl ?? '')}
                                onChange={(e) => onUpdate({ style: { ...selectedObject.style, spriteUrl: e.target.value } })}
                                placeholder="https://.../spritesheet.png"
                              />
                            </label>
                            <div className="image-picker-grid" style={{ marginTop: 8 }}>
                              {images.map((img) => (
                                <button
                                  key={img.id}
                                  type="button"
                                  className={`image-picker-item ${selectedObject.style?.spriteUrl === img.dataUrl ? 'selected' : ''}`}
                                  onClick={() => onUpdate({ style: { ...selectedObject.style, spriteUrl: img.dataUrl } })}
                                  title={img.name}
                                >
                                  <img src={img.dataUrl} alt={img.name} />
                                </button>
                              ))}
                            </div>
                            <div className="two-col" style={{ marginTop: 8 }}>
                              <label>Frame W<input type="number" min={8} value={Number(selectedObject.style?.frameWidth ?? 64)} onChange={(e) => onUpdate({ style: { ...selectedObject.style, frameWidth: Number(e.target.value) } })} /></label>
                              <label>Frame H<input type="number" min={8} value={Number(selectedObject.style?.frameHeight ?? 64)} onChange={(e) => onUpdate({ style: { ...selectedObject.style, frameHeight: Number(e.target.value) } })} /></label>
                              <label>Frames<input type="number" min={1} value={Number(selectedObject.style?.frameCount ?? 8)} onChange={(e) => onUpdate({ style: { ...selectedObject.style, frameCount: Number(e.target.value) } })} /></label>
                              <label>Columns<input type="number" min={1} value={Number(selectedObject.style?.columns ?? 8)} onChange={(e) => onUpdate({ style: { ...selectedObject.style, columns: Number(e.target.value) } })} /></label>
                              <label>FPS<input type="number" min={1} value={Number(selectedObject.style?.fps ?? 12)} onChange={(e) => onUpdate({ style: { ...selectedObject.style, fps: Number(e.target.value) } })} /></label>
                            </div>
                          </div>
                        ) : null}

                        {selectedObject.type === 'lottie' ? (
                          <div style={{ marginTop: 10, borderTop: '1px solid #edf4f7', paddingTop: 10 }}>
                            <div className="prop-hint" style={{ marginBottom: 6 }}>Lottie JSON animation</div>
                            <GraphicAssetPicker
                              assets={assets}
                              kind="lottie"
                              label="Lottie from library"
                              value={String(selectedObject.style?.lottieUrl ?? '')}
                              onChange={(url) => onUpdate({ style: { ...selectedObject.style, lottieUrl: url } })}
                            />
                            <label style={{ marginTop: 8 }}>Lottie URL
                              <input
                                value={String(selectedObject.style?.lottieUrl ?? '')}
                                onChange={(e) => onUpdate({ style: { ...selectedObject.style, lottieUrl: e.target.value } })}
                                placeholder="https://.../animation.json"
                              />
                            </label>
                            <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                              <label style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <input type="checkbox" checked={selectedObject.style?.loop !== false} onChange={(e) => onUpdate({ style: { ...selectedObject.style, loop: e.target.checked } })} />
                                Loop
                              </label>
                              <label style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <input type="checkbox" checked={selectedObject.style?.autoplay !== false} onChange={(e) => onUpdate({ style: { ...selectedObject.style, autoplay: e.target.checked } })} />
                                Autoplay
                              </label>
                            </div>
                          </div>
                        ) : null}

                        {selectedObject.type === 'video' ? (
                          <div style={{ marginTop: 10, borderTop: '1px solid #edf4f7', paddingTop: 10 }}>
                            <div className="prop-hint" style={{ marginBottom: 6 }}>Video / stream URL</div>
                            <label>Stream type
                              <select
                                value={String(selectedObject.style?.streamType ?? 'file')}
                                onChange={(e) => onUpdate({ style: { ...selectedObject.style, streamType: e.target.value } })}
                              >
                                <option value="file">File / MP4 URL</option>
                                <option value="mjpeg">MJPEG / IP camera snapshot</option>
                                <option value="hls">HLS (.m3u8)</option>
                                <option value="rtsp">RTSP (Engine bridge)</option>
                              </select>
                            </label>
                            <label style={{ marginTop: 8 }}>{String(selectedObject.style?.streamType ?? 'file') === 'rtsp' ? 'RTSP URL' : 'Video URL'}
                              <input
                                value={String(selectedObject.style?.videoUrl ?? selectedObject.text ?? '')}
                                onChange={(e) => onUpdate({ style: { ...selectedObject.style, videoUrl: e.target.value }, text: e.target.value })}
                                placeholder={String(selectedObject.style?.streamType ?? 'file') === 'rtsp' ? 'rtsp://user:pass@192.168.1.50/stream1' : 'https://.../stream.mjpg or .m3u8'}
                              />
                            </label>
                            {String(selectedObject.style?.streamType ?? 'file') === 'rtsp' ? (
                              <div className="prop-hint" style={{ marginTop: 6 }}>
                                Requires ffmpeg on Engine host. Runtime calls <code>POST /api/stream/rtsp/start</code> and plays HLS (fallback MJPEG).
                              </div>
                            ) : null}
                          </div>
                        ) : null}

                        {['viewport3d', 'scene3d'].includes(selectedObject.type) ? (
                          <div style={{ marginTop: 10, borderTop: '1px solid #edf4f7', paddingTop: 10 }}>
                            <div className="prop-hint" style={{ marginBottom: 6 }}>3D GLB model</div>
                            <GraphicAssetPicker
                              assets={assets}
                              kind="model3d"
                              label="3D model from library"
                              value={String(selectedObject.style?.glbUrl ?? '')}
                              onChange={(url) => onUpdate({ style: { ...selectedObject.style, glbUrl: url } })}
                            />
                            <label style={{ marginTop: 8 }}>GLB URL (or paste)
                              <input
                                value={String(selectedObject.style?.glbUrl ?? '')}
                                onChange={(e) => onUpdate({ style: { ...selectedObject.style, glbUrl: e.target.value } })}
                                placeholder="https://.../model.glb"
                              />
                            </label>
                            <label style={{ marginTop: 8 }}>Exposure
                              <input type="number" step="0.1" min={0.1} max={3} value={Number(selectedObject.style?.exposure ?? 1)} onChange={(e) => onUpdate({ style: { ...selectedObject.style, exposure: Number(e.target.value) } })} />
                            </label>
                            <label style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
                              <input type="checkbox" checked={selectedObject.style?.autoRotate !== false} onChange={(e) => onUpdate({ style: { ...selectedObject.style, autoRotate: e.target.checked } })} />
                              Auto-rotate
                            </label>
                          </div>
                        ) : null}

                        {selectedObject.type === 'headerfooter' ? (
                          <div style={{ marginTop: 10, borderTop: '1px solid #edf4f7', paddingTop: 10 }}>
                            <div className="prop-hint" style={{ marginBottom: 6 }}>Header / Footer Configuration</div>
                            <label>Type
                              <select
                                value={String(selectedObject.style?.headerFooterType ?? 'header')}
                                onChange={(e) => onUpdate({ style: { ...selectedObject.style, headerFooterType: e.target.value } })}
                              >
                                <option value="header">Header (หัวกระดาษ)</option>
                                <option value="footer">Footer (ท้ายกระดาษ)</option>
                              </select>
                            </label>
                            <label style={{ marginTop: 8 }}>Document Title
                              <input
                                value={selectedObject.text || ''}
                                onChange={(e) => onUpdate({ text: e.target.value })}
                                placeholder="e.g., Monthly Energy Report"
                              />
                            </label>
                          </div>
                        ) : null}

                        {selectedObject.type === 'qrcode' ? (
                          <div style={{ marginTop: 10, borderTop: '1px solid #edf4f7', paddingTop: 10 }}>
                            <div className="prop-hint" style={{ marginBottom: 6 }}>QR Code Configuration</div>
                            <label>QR Code URL / Text
                              <input
                                value={String(selectedObject.style?.qrUrl ?? selectedObject.text ?? '')}
                                onChange={(e) => onUpdate({ style: { ...selectedObject.style, qrUrl: e.target.value }, text: e.target.value })}
                                placeholder="https://energylink.co/report/123"
                              />
                            </label>
                          </div>
                        ) : null}

                        {selectedObject.type === 'signature' ? (
                          <div style={{ marginTop: 10, borderTop: '1px solid #edf4f7', paddingTop: 10 }}>
                            <div className="prop-hint" style={{ marginBottom: 6 }}>Signature Configuration</div>
                            <label>Signee Label
                              <input
                                value={selectedObject.text || ''}
                                onChange={(e) => onUpdate({ text: e.target.value })}
                                placeholder="e.g., Approved By / Checked By"
                              />
                            </label>
                          </div>
                        ) : null}

                        {selectedObject.type === 'variable' ? (
                          <div style={{ marginTop: 10, borderTop: '1px solid #edf4f7', paddingTop: 10 }}>
                            <div className="prop-hint" style={{ marginBottom: 6 }}>Variable Text Configuration</div>
                            <label>Variable Pattern
                              <input
                                value={selectedObject.text || ''}
                                onChange={(e) => onUpdate({ text: e.target.value })}
                                placeholder="{project_name} / {report_date} / {author}"
                              />
                            </label>
                            <div className="prop-hint" style={{ marginTop: 6, fontSize: '11px', color: '#64748b' }}>
                              Available tokens: <code>{'{project_name}'}</code>, <code>{'{report_date}'}</code>, <code>{'{author}'}</code>.
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </>
                  )}

                  {activeTab === 'data' && (
                    <>
                      {/* Device → Tag Binding */}
                      {['energysummary', 'demandsummary', 'powerquality', 'toutable'].includes(selectedObject.type) ? (
                        <div className="prop-card-group">
                          <div className="prop-card-group-title">
                            <Icon icon="solar:tag-bold-duotone" width="14" height="14" style={{ marginRight: 6 }} /> Report Data Binding
                          </div>
                          <label>Filter tags by Device
                            <select
                              value={bindingDeviceId}
                              onChange={(event) => {
                                onBindingDeviceChange(event.target.value);
                              }}
                            >
                              <option value="">— All Devices —</option>
                              {devices.filter((dev) => dev.type !== 'converter').map((dev) => (
                                <option key={dev.id} value={dev.id}>{dev.name} ({dev.type})</option>
                              ))}
                            </select>
                          </label>

                          {(() => {
                            const getOptions = (currentValue: string) => {
                              const list = [...filteredBindingTags];
                              if (currentValue && !list.some((t) => t.id === currentValue)) {
                                const found = tags.find((t) => t.id === currentValue);
                                if (found) list.push(found);
                              }
                              return list;
                            };

                            if (selectedObject.type === 'energysummary') {
                              return (
                                <>
                                  <label>Active Energy Tag (kWh)
                                    <select
                                      value={String(selectedObject.style?.tagActive ?? '')}
                                      onChange={(e) => onUpdate({ style: { ...selectedObject.style, tagActive: e.target.value || undefined } })}
                                    >
                                      <option value="">— Select tag —</option>
                                      {getOptions(String(selectedObject.style?.tagActive ?? '')).map((tag) => (
                                        <option key={tag.id} value={tag.id}>{tag.name}{tag.unit ? ` (${tag.unit})` : ''}</option>
                                      ))}
                                    </select>
                                  </label>

                                  <label>Reactive Energy Tag (kVARh)
                                    <select
                                      value={String(selectedObject.style?.tagReactive ?? '')}
                                      onChange={(e) => onUpdate({ style: { ...selectedObject.style, tagReactive: e.target.value || undefined } })}
                                    >
                                      <option value="">— Select tag —</option>
                                      {getOptions(String(selectedObject.style?.tagReactive ?? '')).map((tag) => (
                                        <option key={tag.id} value={tag.id}>{tag.name}{tag.unit ? ` (${tag.unit})` : ''}</option>
                                      ))}
                                    </select>
                                  </label>

                                  <label>Apparent Energy Tag (kVAh)
                                    <select
                                      value={String(selectedObject.style?.tagApparent ?? '')}
                                      onChange={(e) => onUpdate({ style: { ...selectedObject.style, tagApparent: e.target.value || undefined } })}
                                    >
                                      <option value="">— Select tag —</option>
                                      {getOptions(String(selectedObject.style?.tagApparent ?? '')).map((tag) => (
                                        <option key={tag.id} value={tag.id}>{tag.name}{tag.unit ? ` (${tag.unit})` : ''}</option>
                                      ))}
                                    </select>
                                  </label>
                                </>
                              );
                            }

                            if (selectedObject.type === 'demandsummary') {
                              return (
                                <>
                                  <label>Peak Demand Tag (kW)
                                    <select
                                      value={String(selectedObject.style?.tagPeak ?? '')}
                                      onChange={(e) => onUpdate({ style: { ...selectedObject.style, tagPeak: e.target.value || undefined } })}
                                    >
                                      <option value="">— Select tag —</option>
                                      {getOptions(String(selectedObject.style?.tagPeak ?? '')).map((tag) => (
                                        <option key={tag.id} value={tag.id}>{tag.name}{tag.unit ? ` (${tag.unit})` : ''}</option>
                                      ))}
                                    </select>
                                  </label>

                                  <label>Peak Demand Time Tag
                                    <select
                                      value={String(selectedObject.style?.tagPeakTime ?? '')}
                                      onChange={(e) => onUpdate({ style: { ...selectedObject.style, tagPeakTime: e.target.value || undefined } })}
                                    >
                                      <option value="">— Select tag —</option>
                                      {getOptions(String(selectedObject.style?.tagPeakTime ?? '')).map((tag) => (
                                        <option key={tag.id} value={tag.id}>{tag.name}{tag.unit ? ` (${tag.unit})` : ''}</option>
                                      ))}
                                    </select>
                                  </label>
                                </>
                              );
                            }

                            if (selectedObject.type === 'powerquality') {
                              return (
                                <>
                                  <label>Power Factor Tag
                                    <select
                                      value={String(selectedObject.style?.tagPf ?? '')}
                                      onChange={(e) => onUpdate({ style: { ...selectedObject.style, tagPf: e.target.value || undefined } })}
                                    >
                                      <option value="">— Select tag —</option>
                                      {getOptions(String(selectedObject.style?.tagPf ?? '')).map((tag) => (
                                        <option key={tag.id} value={tag.id}>{tag.name}{tag.unit ? ` (${tag.unit})` : ''}</option>
                                      ))}
                                    </select>
                                  </label>

                                  <label>THD Voltage Tag (%)
                                    <select
                                      value={String(selectedObject.style?.tagThdv ?? '')}
                                      onChange={(e) => onUpdate({ style: { ...selectedObject.style, tagThdv: e.target.value || undefined } })}
                                    >
                                      <option value="">— Select tag —</option>
                                      {getOptions(String(selectedObject.style?.tagThdv ?? '')).map((tag) => (
                                        <option key={tag.id} value={tag.id}>{tag.name}{tag.unit ? ` (${tag.unit})` : ''}</option>
                                      ))}
                                    </select>
                                  </label>

                                  <label>THD Current Tag (%)
                                    <select
                                      value={String(selectedObject.style?.tagThdi ?? '')}
                                      onChange={(e) => onUpdate({ style: { ...selectedObject.style, tagThdi: e.target.value || undefined } })}
                                    >
                                      <option value="">— Select tag —</option>
                                      {getOptions(String(selectedObject.style?.tagThdi ?? '')).map((tag) => (
                                        <option key={tag.id} value={tag.id}>{tag.name}{tag.unit ? ` (${tag.unit})` : ''}</option>
                                      ))}
                                    </select>
                                  </label>
                                </>
                              );
                            }

                            if (selectedObject.type === 'toutable') {
                              return (
                                <div className="prop-hint" style={{ marginTop: 6, color: '#475569' }}>
                                  Time of Use Table displays Peak, Off-Peak, and Holiday rates from the billing engine. No direct SCADA tag bindings required.
                                </div>
                              );
                            }

                            return null;
                          })()}
                        </div>
                      ) : (
                        <div className="prop-card-group">
                          <div className="prop-card-group-title">
                            <Icon icon="solar:tag-bold-duotone" width="14" height="14" style={{ marginRight: 6 }} /> Data Binding
                          </div>
                          <label>Device
                            <select value={bindingDeviceId} onChange={(event) => { onBindingDeviceChange(event.target.value); onBindTag(''); }}>
                              <option value="">— All Devices —</option>
                              {devices.map((dev) => (
                                <option key={dev.id} value={dev.id}>{dev.name} ({dev.type})</option>
                              ))}
                            </select>
                          </label>
                          <label>Tag
                            <select
                              value={selectedObject.binding?.tagId || ''}
                              onChange={(event) => onBindTag(event.target.value)}
                            >
                              <option value="">— No tag binding —</option>
                              {filteredBindingTags.map((tag) => (
                                <option key={tag.id} value={tag.id}>{tag.name}{tag.unit ? ` (${tag.unit})` : ''}</option>
                              ))}
                            </select>
                          </label>
                          {selectedObject.binding?.tagName && (
                            <div className="prop-hint" style={{ marginTop: '6px' }}>
                              <span style={{ opacity: 0.7 }}>Bound: {selectedObject.binding.tagName}</span>
                              {selectedObject.binding.unit && <span style={{ opacity: 0.5 }}> · {selectedObject.binding.unit}</span>}
                            </div>
                          )}
                        </div>
                      )}

                      {(selectedObject.type === 'flowpath' || selectedObject.type === 'cable3d' || selectedObject.type === 'pipe' || selectedObject.type === 'elecsymbol') && (
                        <div className="prop-card-group">
                          <div className="prop-card-group-title">
                            <Icon icon="solar:bolt-circle-bold-duotone" width="14" height="14" style={{ marginRight: 6 }} /> SLD / Single-Line
                          </div>
                          {selectedObject.type === 'flowpath' && (
                            <>
                              {(() => {
                                const ep = resolveWireEndpoints(selectedObject.style);
                                if (!ep.fromObjectId && !ep.toObjectId) return null;
                                const fromName = selectedGraphic?.layout?.objects?.find((o) => o.id === ep.fromObjectId)?.name ?? ep.fromObjectId;
                                const toName = selectedGraphic?.layout?.objects?.find((o) => o.id === ep.toObjectId)?.name ?? ep.toObjectId;
                                return (
                                  <div className="prop-hint" style={{ marginBottom: 8, padding: '6px 8px', background: '#f0f9ff', borderRadius: 6, border: '1px solid #bae6fd' }}>
                                    <Icon icon="solar:link-round-bold-duotone" width="14" height="14" style={{ marginRight: 4, verticalAlign: 'middle', color: '#0ea5e9' }} />
                                    Port wire: <strong>{fromName}</strong> ({ep.fromPortId}) → <strong>{toName}</strong> ({ep.toPortId})
                                  </div>
                                );
                              })()}
                              <label>Flow Tag (A, kW, kWh)
                                <select
                                  value={selectedObject.binding?.flowTagId || selectedObject.binding?.tagId || ''}
                                  onChange={(event) => onBindFlowTag(event.target.value)}
                                >
                                  <option value="">— Select tag —</option>
                                  {filteredBindingTags.map((tag) => (
                                    <option key={tag.id} value={tag.id}>{tag.name}{tag.unit ? ` (${tag.unit})` : ''}</option>
                                  ))}
                                </select>
                              </label>
                              <label>Enable Tag (breaker closed)
                                <select
                                  value={selectedObject.binding?.enableTagId || ''}
                                  onChange={(event) => onBindEnableTag(event.target.value)}
                                >
                                  <option value="">— Optional —</option>
                                  {filteredBindingTags.map((tag) => (
                                    <option key={tag.id} value={tag.id}>{tag.name}</option>
                                  ))}
                                </select>
                              </label>
                              <div className="two-col">
                                <label>Flow Threshold<input type="number" step="0.1" value={Number(selectedObject.style?.flowThreshold ?? 0.5)} onChange={(e) => onUpdate({ style: { ...selectedObject.style, flowThreshold: Number(e.target.value) } })} /></label>
                                <label>Speed<input type="number" step="0.1" min={0.2} value={Number(selectedObject.style?.flowSpeed ?? 1)} onChange={(e) => onUpdate({ style: { ...selectedObject.style, flowSpeed: Number(e.target.value) } })} /></label>
                                <label>Flow Color<input type="color" value={String(selectedObject.style?.flowColor ?? '#22d3ee')} onChange={(e) => onUpdate({ style: { ...selectedObject.style, flowColor: e.target.value } })} /></label>
                                <label>Idle Color<input type="color" value={String(selectedObject.style?.idleColor ?? '#94a3b8')} onChange={(e) => onUpdate({ style: { ...selectedObject.style, idleColor: e.target.value } })} /></label>
                                <label>Overload (Alarm High)<input type="number" step="0.1" placeholder="off" value={selectedObject.style?.flowAlarmHigh != null ? Number(selectedObject.style.flowAlarmHigh) : ''} onChange={(e) => onUpdate({ style: { ...selectedObject.style, flowAlarmHigh: e.target.value === '' ? undefined : Number(e.target.value) } })} /></label>
                                <label>Alarm Color<input type="color" value={String(selectedObject.style?.alarmColor ?? '#ef4444')} onChange={(e) => onUpdate({ style: { ...selectedObject.style, alarmColor: e.target.value } })} /></label>
                              </div>
                              <div className="prop-hint">ลากจุดวงกลมบนเส้นเพื่อปรับ path · ค่าเกิน Overload → เส้นแดงเรืองแสง</div>
                              <label style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
                                <input
                                  type="checkbox"
                                  checked={selectedObject.style?.showFeedLabel === true}
                                  onChange={(e) => onUpdate({ style: { ...selectedObject.style, showFeedLabel: e.target.checked } })}
                                />
                                Show feeder label on wire
                              </label>
                              <label>Label prefix
                                <input
                                  value={String(selectedObject.style?.labelPrefix ?? selectedObject.text ?? selectedObject.name ?? '')}
                                  onChange={(e) => onUpdate({ style: { ...selectedObject.style, labelPrefix: e.target.value } })}
                                  placeholder="Feed A"
                                />
                              </label>
                              <label>Path Points (x,y;...)
                                <textarea
                                  rows={3}
                                  value={String(selectedObject.style?.pathPoints ?? '')}
                                  onChange={(e) => onUpdate({ style: { ...selectedObject.style, pathPoints: e.target.value } })}
                                  placeholder="0,24;280,24"
                                />
                              </label>
                              <div className="button-row compact" style={{ gap: 6, marginTop: 6 }}>
                                <button type="button" className="btn secondary tiny" onClick={() => { onStartPathEdit(selectedObject.id, 'Click canvas to add path points.'); }}>
                                  Draw Path
                                </button>
                                <button type="button" className="btn secondary tiny" onClick={() => onUpdate({ style: { ...selectedObject.style, pathPoints: `0,${Math.round(selectedObject.height / 2)};${selectedObject.width},${Math.round(selectedObject.height / 2)}` } })}>
                                  Reset Line
                                </button>
                                <button type="button" className="btn danger tiny" onClick={() => onUpdate({ style: { ...selectedObject.style, pathPoints: '' } })}>
                                  Clear
                                </button>
                                <button type="button" className="btn secondary tiny" onClick={() => { onCopyFlowStyle(pickFlowStyle(selectedObject.style as Record<string, unknown>));  }}>
                                  Copy Style
                                </button>
                                <button type="button" className="btn secondary tiny" disabled={!copiedFlowStyle} onClick={() => { if (!copiedFlowStyle) return; onUpdate({ style: { ...selectedObject.style, ...copiedFlowStyle } }); onShowNotice({ kind: 'success', text: 'Flow path style pasted.' }); }}>
                                  Paste Style
                                </button>
                              </div>
                            </>
                          )}
                          {selectedObject.type === 'pipe' && (
                            <>
                              <label>Flow Tag
                                <select
                                  value={selectedObject.binding?.flowTagId || selectedObject.binding?.tagId || ''}
                                  onChange={(event) => onBindFlowTag(event.target.value)}
                                >
                                  <option value="">— Select tag —</option>
                                  {filteredBindingTags.map((tag) => (
                                    <option key={tag.id} value={tag.id}>{tag.name}{tag.unit ? ` (${tag.unit})` : ''}</option>
                                  ))}
                                </select>
                              </label>
                              <label>Enable Tag
                                <select
                                  value={selectedObject.binding?.enableTagId || ''}
                                  onChange={(event) => onBindEnableTag(event.target.value)}
                                >
                                  <option value="">— Optional —</option>
                                  {filteredBindingTags.map((tag) => (
                                    <option key={tag.id} value={tag.id}>{tag.name}</option>
                                  ))}
                                </select>
                              </label>
                              <div className="two-col">
                                <label>Pipe Width<input type="number" min={4} max={48} value={Number(selectedObject.style?.pipeWidth ?? 14)} onChange={(e) => onUpdate({ style: { ...selectedObject.style, pipeWidth: Number(e.target.value) } })} /></label>
                                <label>Flow Threshold<input type="number" step="0.1" value={Number(selectedObject.style?.flowThreshold ?? 0.5)} onChange={(e) => onUpdate({ style: { ...selectedObject.style, flowThreshold: Number(e.target.value) } })} /></label>
                                <label>Fill<input type="color" value={String(selectedObject.style?.fill ?? '#06b6d4')} onChange={(e) => onUpdate({ style: { ...selectedObject.style, fill: e.target.value } })} /></label>
                                <label>Wall<input type="color" value={String(selectedObject.style?.pipeWall ?? '#0e7490')} onChange={(e) => onUpdate({ style: { ...selectedObject.style, pipeWall: e.target.value } })} /></label>
                                <label>Flow Color<input type="color" value={String(selectedObject.style?.flowColor ?? '#22d3ee')} onChange={(e) => onUpdate({ style: { ...selectedObject.style, flowColor: e.target.value } })} /></label>
                                <label>Speed<input type="number" step="0.1" min={0.2} value={Number(selectedObject.style?.flowSpeed ?? 1)} onChange={(e) => onUpdate({ style: { ...selectedObject.style, flowSpeed: Number(e.target.value) } })} /></label>
                              </div>
                              <label>Path Points (x,y;...)
                                <textarea
                                  rows={3}
                                  value={String(selectedObject.style?.pathPoints ?? '')}
                                  onChange={(e) => onUpdate({ style: { ...selectedObject.style, pathPoints: e.target.value } })}
                                />
                              </label>
                              <div className="button-row compact" style={{ gap: 6, marginTop: 6 }}>
                                <button type="button" className="btn secondary tiny" onClick={() => { onStartPathEdit(selectedObject.id, 'Click canvas to edit pipe path.'); }}>
                                  Draw Path
                                </button>
                                <button type="button" className="btn secondary tiny" onClick={() => onUpdate({ style: { ...selectedObject.style, pathPoints: `0,${Math.round(selectedObject.height / 2)};${selectedObject.width},${Math.round(selectedObject.height / 2)}` } })}>
                                  Reset Line
                                </button>
                              </div>
                            </>
                          )}
                          {selectedObject.type === 'cable3d' && (
                            <>
                              {(() => {
                                const ep = resolveCableEndpoints(selectedObject.style);
                                if (!ep.fromObjectId && !ep.toObjectId) return null;
                                const fromName = selectedGraphic?.layout?.objects?.find((o) => o.id === ep.fromObjectId)?.name ?? ep.fromObjectId;
                                const toName = selectedGraphic?.layout?.objects?.find((o) => o.id === ep.toObjectId)?.name ?? ep.toObjectId;
                                return (
                                  <div className="prop-hint" style={{ marginBottom: 8, padding: '6px 8px', background: '#f5f3ff', borderRadius: 6, border: '1px solid #ddd6fe' }}>
                                    <Icon icon="solar:link-circle-bold-duotone" width="14" height="14" style={{ marginRight: 4, verticalAlign: 'middle', color: '#7c3aed' }} />
                                    Cable 3D: <strong>{fromName}</strong> ({ep.fromPortId}) → <strong>{toName}</strong> ({ep.toPortId})
                                  </div>
                                );
                              })()}
                              <label>Linked 2D Wire (flowpath)
                                <select
                                  value={String(selectedObject.style?.linkedWireId ?? '')}
                                  onChange={(e) => onUpdate({ style: { ...selectedObject.style, linkedWireId: e.target.value || undefined } })}
                                >
                                  <option value="">— None —</option>
                                  {(selectedGraphic?.layout?.objects ?? []).filter((o) => o.type === 'flowpath').map((w) => (
                                    <option key={w.id} value={w.id}>{w.name}</option>
                                  ))}
                                </select>
                              </label>
                              <div className="button-row compact" style={{ gap: 6, marginBottom: 8 }}>
                                <button
                                  type="button"
                                  className="btn secondary tiny"
                                  disabled={!selectedObject.style?.linkedWireId}
                                  onClick={onSyncCable}
                                >
                                  Sync from Wire
                                </button>
                              </div>
                              <label>Flow Tag (A, kW, kWh)
                                <select
                                  value={selectedObject.binding?.flowTagId || selectedObject.binding?.tagId || ''}
                                  onChange={(event) => onBindFlowTag(event.target.value)}
                                >
                                  <option value="">— Select tag —</option>
                                  {filteredBindingTags.map((tag) => (
                                    <option key={tag.id} value={tag.id}>{tag.name}{tag.unit ? ` (${tag.unit})` : ''}</option>
                                  ))}
                                </select>
                              </label>
                              <div className="two-col">
                                <label>Flow Threshold<input type="number" step="0.1" value={Number(selectedObject.style?.flowThreshold ?? 0.5)} onChange={(e) => onUpdate({ style: { ...selectedObject.style, flowThreshold: Number(e.target.value) } })} /></label>
                                <label>Speed<input type="number" step="0.1" min={0.2} value={Number(selectedObject.style?.flowSpeed ?? 1)} onChange={(e) => onUpdate({ style: { ...selectedObject.style, flowSpeed: Number(e.target.value) } })} /></label>
                                <label>Flow Color<input type="color" value={String(selectedObject.style?.flowColor ?? '#a78bfa')} onChange={(e) => onUpdate({ style: { ...selectedObject.style, flowColor: e.target.value } })} /></label>
                                <label>Idle Color<input type="color" value={String(selectedObject.style?.idleColor ?? '#64748b')} onChange={(e) => onUpdate({ style: { ...selectedObject.style, idleColor: e.target.value } })} /></label>
                                <label>Cable Radius<input type="number" step="0.5" min={1} value={Number(selectedObject.style?.cableRadius ?? 3)} onChange={(e) => onUpdate({ style: { ...selectedObject.style, cableRadius: Number(e.target.value) } })} /></label>
                                <label>Stroke Width<input type="number" step="1" min={2} value={Number(selectedObject.style?.strokeWidth ?? 6)} onChange={(e) => onUpdate({ style: { ...selectedObject.style, strokeWidth: Number(e.target.value) } })} /></label>
                              </div>
                              <label style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
                                <input
                                  type="checkbox"
                                  checked={selectedObject.style?.showFeedLabel === true}
                                  onChange={(e) => onUpdate({ style: { ...selectedObject.style, showFeedLabel: e.target.checked } })}
                                />
                                Show feeder label on cable
                              </label>
                              <label>Label prefix
                                <input
                                  value={String(selectedObject.style?.labelPrefix ?? selectedObject.text ?? selectedObject.name ?? '')}
                                  onChange={(e) => onUpdate({ style: { ...selectedObject.style, labelPrefix: e.target.value } })}
                                />
                              </label>
                              <label>Path 3D (x,y,z;...)
                                <textarea
                                  rows={3}
                                  value={String(selectedObject.style?.path3d ?? '')}
                                  onChange={(e) => onUpdate({ style: { ...selectedObject.style, path3d: e.target.value } })}
                                  placeholder="0,24,0;140,24,40;280,24,0"
                                />
                              </label>
                              <label>Projected Path (2D preview)
                                <textarea
                                  rows={2}
                                  value={String(selectedObject.style?.pathPoints ?? '')}
                                  onChange={(e) => onUpdate({ style: { ...selectedObject.style, pathPoints: e.target.value } })}
                                  placeholder="0,24;280,24"
                                />
                              </label>
                              <div className="button-row compact" style={{ gap: 6, marginTop: 6 }}>
                                <button type="button" className="btn secondary tiny" onClick={() => { onStartPathEdit(selectedObject.id, 'Click canvas to add path points.'); }}>
                                  Draw Path
                                </button>
                                <button type="button" className="btn secondary tiny" onClick={() => onUpdate({ style: { ...selectedObject.style, pathPoints: `0,${Math.round(selectedObject.height / 2)};${selectedObject.width},${Math.round(selectedObject.height / 2)}` } })}>
                                  Reset Line
                                </button>
                              </div>
                            </>
                          )}
                          {selectedObject.type === 'elecsymbol' && (
                            <>
                              <label>Symbol Type
                                <select
                                  value={String(selectedObject.style?.symbolId ?? 'breaker')}
                                  onChange={(e) => onUpdate({ style: { ...selectedObject.style, symbolId: e.target.value } })}
                                >
                                  <option value="breaker">Breaker</option>
                                  <option value="disconnect">Disconnect</option>
                                  <option value="transformer">Transformer</option>
                                  <option value="bus">Bus Bar</option>
                                  <option value="meter">Meter</option>
                                  <option value="motor">Motor</option>
                                  <option value="ct">CT (Current Transformer)</option>
                                  <option value="pt">PT (Potential Transformer)</option>
                                  <option value="generator">Generator</option>
                                  <option value="ats">ATS (Auto Transfer)</option>
                                  <option value="door">Door</option>
                                  <option value="lamp">Lamp</option>
                                </select>
                              </label>
                              <label>Custom Symbol (Setup → Symbols)
                                <select
                                  value={String(selectedObject.style?.customSymbolId ?? '')}
                                  onChange={(e) => {
                                    const sym = symbolById(allSymbols(), e.target.value);
                                    onUpdate({
                                      style: {
                                        ...selectedObject.style,
                                        customSymbolId: e.target.value || undefined,
                                        customSymbolSvg: sym?.svgContent,
                                        symbolId: e.target.value ? undefined : (selectedObject.style?.symbolId ?? 'breaker'),
                                      },
                                    });
                                  }}
                                >
                                  <option value="">— Built-in symbol —</option>
                                  {allSymbols().map((s) => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                  ))}
                                </select>
                              </label>
                              <label>Tooltip Tags (comma-separated tag IDs)
                                <input
                                  value={String(selectedObject.style?.tooltipTagIds ?? '')}
                                  onChange={(e) => onUpdate({ style: { ...selectedObject.style, tooltipTagIds: e.target.value } })}
                                  placeholder="tagId1,tagId2"
                                />
                              </label>
                              <label>Drill-down
                                <select
                                  value={String(selectedObject.style?.drillDown ?? '')}
                                  onChange={(e) => onUpdate({ style: { ...selectedObject.style, drillDown: e.target.value || undefined } })}
                                >
                                  <option value="">None</option>
                                  <option value="graphic">Graphic (use navigateTo)</option>
                                  <option value="device">Device (use deviceId)</option>
                                </select>
                              </label>
                              <label>States (comma-separated)
                                <input
                                  value={String(selectedObject.style?.states ?? 'open,closed,trip')}
                                  onChange={(e) => onUpdate({ style: { ...selectedObject.style, states: e.target.value } })}
                                />
                              </label>
                              <div className="prop-hint">Bind State Tag above: 0=open, 1=closed, 2=trip</div>
                            </>
                          )}
                        </div>
                      )}

                      {selectedObject.type === 'feedlabel' && (
                        <div className="prop-card-group">
                          <div className="prop-card-group-title">
                            <Icon icon="solar:tag-bold-duotone" width="14" height="14" style={{ marginRight: 6 }} /> Flow Settings
                          </div>
                          <label>Flow / Live Tag
                            <select value={selectedObject.binding?.flowTagId || selectedObject.binding?.tagId || ''} onChange={(e) => onBindFlowTag(e.target.value)}>
                              <option value="">— Select tag —</option>
                              {filteredBindingTags.map((tag) => <option key={tag.id} value={tag.id}>{tag.name}</option>)}
                            </select>
                          </label>
                        </div>
                      )}

                      {selectedObject.type === 'piechart' && (
                        <div className="prop-card-group">
                          <div className="prop-card-group-title">
                            <Icon icon="solar:tag-bold-duotone" width="14" height="14" style={{ marginRight: 6 }} /> Pie Chart Data
                          </div>
                          <div className="prop-hint">Pie Tags (multi-select)</div>
                          <select
                            multiple
                            size={6}
                            value={(selectedObject as ExtendedObject).tagIds || selectedObject.binding?.tagIds || []}
                            onChange={(e) => {
                              const tagIds = Array.from(e.target.selectedOptions).map((o) => o.value);
                              onUpdate({ tagIds, binding: { ...selectedObject.binding, tagIds } } as Partial<ExtendedObject>);
                            }}
                            style={{ width: '100%' }}
                          >
                            {tags.map((tag) => (
                              <option key={tag.id} value={tag.id}>{tag.name}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      {selectedObject.type === 'kpicard' && (
                        <div className="prop-card-group">
                          <div className="prop-card-group-title">
                            <Icon icon="solar:tag-bold-duotone" width="14" height="14" style={{ marginRight: 6 }} /> KPI Delta
                          </div>
                          <label>Delta % Tag (optional)
                            <select
                              value={String(selectedObject.style?.deltaTagId ?? '')}
                              onChange={(e) => onUpdate({ style: { ...selectedObject.style, deltaTagId: e.target.value || undefined } })}
                            >
                              <option value="">— None —</option>
                              {tags.map((tag) => (
                                <option key={tag.id} value={tag.id}>{tag.name}</option>
                              ))}
                            </select>
                          </label>
                        </div>
                      )}

                      {(selectedObject.type === 'trend' || selectedObject.type === 'sparkline') && (
                        <div className="prop-card-group">
                          <div className="prop-card-group-title">
                            <Icon icon="solar:tag-bold-duotone" width="14" height="14" style={{ marginRight: 6 }} /> Trend Data
                          </div>
                          <label>Trend Period
                            <select
                              value={String(selectedObject.style?.period ?? '24h')}
                              onChange={(event) => onUpdate({ style: { ...selectedObject.style, period: event.target.value } })}
                            >
                              <option value="1h">Last 1 hour</option>
                              <option value="24h">Last 24 hours</option>
                              <option value="7d">Last 7 days</option>
                            </select>
                          </label>
                          {selectedObject.type === 'trend' ? (
                            <>
                              <div className="prop-hint" style={{ marginTop: 10 }}>Trend Tags (multi-select for overlay)</div>
                              <select
                                multiple
                                size={6}
                                value={(selectedObject as ExtendedObject).tagIds || selectedObject.binding?.tagIds || (selectedObject.binding?.tagId ? [selectedObject.binding.tagId] : [])}
                                onChange={(e) => {
                                  const tagIds = Array.from(e.target.selectedOptions).map((o) => o.value);
                                  onUpdate({
                                    tagIds,
                                    binding: { ...selectedObject.binding, tagIds, tagId: tagIds[0] ?? null },
                                  } as Partial<ExtendedObject>);
                                }}
                                style={{ width: '100%' }}
                              >
                                {tags.map((tag) => (
                                  <option key={tag.id} value={tag.id}>{tag.name}</option>
                                ))}
                              </select>
                              <label style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
                                <input
                                  type="checkbox"
                                  checked={selectedObject.style?.showLegend !== false}
                                  onChange={(e) => onUpdate({ style: { ...selectedObject.style, showLegend: e.target.checked } })}
                                />
                                Show legend
                              </label>
                            </>
                          ) : null}
                        </div>
                      )}

                      {selectedObject.type === 'formulavalue' && (
                        <div className="prop-card-group">
                          <div className="prop-card-group-title">
                            <Icon icon="solar:tag-bold-duotone" width="14" height="14" style={{ marginRight: 6 }} /> Formula Configuration
                          </div>
                          <div className="prop-hint">Formula Tags (A, B, C… by order)</div>
                          <select
                            multiple
                            size={6}
                            value={(selectedObject as ExtendedObject).tagIds || selectedObject.binding?.tagIds || (selectedObject.binding?.tagId ? [selectedObject.binding.tagId] : [])}
                            onChange={(e) => {
                              const tagIds = Array.from(e.target.selectedOptions).map((o) => o.value);
                              onUpdate({
                                tagIds,
                                binding: { ...selectedObject.binding, tagIds, tagId: tagIds[0] ?? null },
                              } as Partial<ExtendedObject>);
                            }}
                            style={{ width: '100%' }}
                          >
                            {tags.map((tag) => (
                              <option key={tag.id} value={tag.id}>{tag.name}</option>
                            ))}
                          </select>
                          <label style={{ marginTop: 8 }}>Formula (use A, B or {'{tagId}'})
                            <input
                              value={String(selectedObject.style?.formula ?? 'A + B')}
                              onChange={(e) => onUpdate({ style: { ...selectedObject.style, formula: e.target.value } })}
                            />
                          </label>
                          {(() => {
                            const tagIds = (selectedObject as ExtendedObject).tagIds || selectedObject.binding?.tagIds || (selectedObject.binding?.tagId ? [selectedObject.binding.tagId] : []);
                            const check = validateFormulaSyntax(String(selectedObject.style?.formula ?? ''), tagIds);
                            return !check.ok ? (
                              <div className="prop-hint" style={{ color: '#dc2626', marginTop: 6 }}>{check.error}</div>
                            ) : (
                              <div className="prop-hint" style={{ color: '#16a34a', marginTop: 6 }}>Formula OK</div>
                            );
                          })()}
                          <div className="two-col" style={{ marginTop: 8 }}>
                            <label>Decimals<input type="number" min={0} max={6} value={Number(selectedObject.style?.decimalPlaces ?? 2)} onChange={(e) => onUpdate({ style: { ...selectedObject.style, decimalPlaces: Number(e.target.value) } })} /></label>
                            <label>Unit<input value={String(selectedObject.style?.unit ?? '')} onChange={(e) => onUpdate({ style: { ...selectedObject.style, unit: e.target.value } })} /></label>
                          </div>
                        </div>
                      )}

                      {selectedObject.type === 'statusbadge' && (
                        <div className="prop-card-group">
                          <div className="prop-card-group-title">
                            <Icon icon="solar:tag-bold-duotone" width="14" height="14" style={{ marginRight: 6 }} /> Badge Data
                          </div>
                          <label>Status Tag
                            <select
                              value={selectedObject.binding?.tagId ?? ''}
                              onChange={(e) => onUpdate({ binding: { ...selectedObject.binding, tagId: e.target.value || null, tagName: tags.find((t) => t.id === e.target.value)?.name } })}
                            >
                              <option value="">— Select tag —</option>
                              {tags.map((tag) => (
                                <option key={tag.id} value={tag.id}>{tag.name}</option>
                              ))}
                            </select>
                          </label>
                          <label style={{ marginTop: 8 }}>Badge Map (value:Label:#color)
                            <input
                              value={String(selectedObject.style?.badgeMap ?? '0:Stop:#94a3b8,1:Run:#22c55e,2:Fault:#ef4444')}
                              onChange={(e) => onUpdate({ style: { ...selectedObject.style, badgeMap: e.target.value } })}
                            />
                          </label>
                          <label style={{ marginTop: 8 }}>Alarm Badge Color
                            <input type="color" value={String(selectedObject.style?.alarmBadgeColor ?? '#ef4444')} onChange={(e) => onUpdate({ style: { ...selectedObject.style, alarmBadgeColor: e.target.value } })} />
                          </label>
                        </div>
                      )}

                      {(selectedObject.type === 'tagtable' || selectedObject.type === 'alarmtable') && (
                        <div className="prop-card-group">
                          <div className="prop-card-group-title">
                            <Icon icon="solar:tag-bold-duotone" width="14" height="14" style={{ marginRight: 6 }} /> Table Configuration
                          </div>
                          <label>Filter by Device
                            <select
                              value={(selectedObject as ExtendedObject).deviceId || ''}
                              onChange={(event) => onUpdate({ deviceId: event.target.value || undefined, binding: { ...selectedObject.binding, deviceId: event.target.value || undefined } } as Partial<ExtendedObject>)}
                            >
                              <option value="">— All devices —</option>
                              {devices.map((dev) => (
                                <option key={dev.id} value={dev.id}>{dev.name}</option>
                              ))}
                            </select>
                          </label>
                          <label style={{ marginTop: 8 }}>Max Rows
                            <input
                              type="number"
                              min={3}
                              max={50}
                              value={Number(selectedObject.style?.maxRows ?? 10)}
                              onChange={(event) => onUpdate({ style: { ...selectedObject.style, maxRows: Number(event.target.value) } })}
                            />
                          </label>
                          {selectedObject.type === 'tagtable' && (
                            <>
                              <label style={{ marginTop: 8 }}>Columns (comma: name,value,unit,quality,device)
                                <input
                                  value={String(selectedObject.style?.columns ?? 'name,value,unit')}
                                  onChange={(event) => onUpdate({ style: { ...selectedObject.style, columns: event.target.value } })}
                                />
                              </label>
                              <label style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
                                <input
                                  type="checkbox"
                                  checked={selectedObject.style?.exportCsv === true}
                                  onChange={(e) => onUpdate({ style: { ...selectedObject.style, exportCsv: e.target.checked } })}
                                />
                                Show CSV export button
                              </label>
                            </>
                          )}
                        </div>
                      )}

                      {selectedObject.type === 'barchart' && (
                        <div className="prop-card-group">
                          <div className="prop-card-group-title">
                            <Icon icon="solar:tag-bold-duotone" width="14" height="14" style={{ marginRight: 6 }} /> Bar Chart Data
                          </div>
                          <div className="prop-hint" style={{ marginBottom: 6 }}>Bar Chart Tags (multi-select)</div>
                          <select
                            multiple
                            size={6}
                            value={(selectedObject as ExtendedObject).tagIds || selectedObject.binding?.tagIds || []}
                            onChange={(event) => {
                              const tagIds = Array.from(event.target.selectedOptions).map((o) => o.value);
                              onUpdate({ tagIds, binding: { ...selectedObject.binding, tagIds } } as Partial<ExtendedObject>);
                            }}
                            style={{ width: '100%' }}
                          >
                            {tags.map((tag) => (
                              <option key={tag.id} value={tag.id}>{tag.name} ({tag.deviceName ?? tag.deviceId})</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </>
                  )}

                  {activeTab === 'condition' && (
                    <>
                      {/* Visibility Logic */}
                      <div className="prop-card-group">
                        <div className="prop-card-group-title">
                          <Icon icon="solar:eye-bold-duotone" width="14" height="14" style={{ marginRight: 6 }} /> Visibility Logic
                        </div>
                        <label>When Tag (optional)
                          <select
                            value={String(selectedObject.style?.visibleWhenTag ?? '')}
                            onChange={(e) => onUpdate({ style: { ...selectedObject.style, visibleWhenTag: e.target.value || undefined } })}
                          >
                            <option value="">— None —</option>
                            {tags.map((tag) => (
                              <option key={tag.id} value={tag.id}>{tag.name}</option>
                            ))}
                          </select>
                        </label>
                        <div className="two-col">
                          <label>Operator
                            <select value={String(selectedObject.style?.visibleWhenOp ?? '>')} onChange={(e) => onUpdate({ style: { ...selectedObject.style, visibleWhenOp: e.target.value } })}>
                              <option value=">">{'>'}</option>
                              <option value="<">{'<'}</option>
                              <option value=">=">{'>='}</option>
                              <option value="<=">{'<='}</option>
                              <option value="==">==</option>
                              <option value="!=">!=</option>
                            </select>
                          </label>
                          <label>Threshold<input type="number" value={Number(selectedObject.style?.visibleWhenValue ?? 0)} onChange={(e) => onUpdate({ style: { ...selectedObject.style, visibleWhenValue: Number(e.target.value) } })} /></label>
                        </div>
                        <label style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
                          <input type="checkbox" checked={selectedObject.style?.blinkWhenAlarm === true} onChange={(e) => onUpdate({ style: { ...selectedObject.style, blinkWhenAlarm: e.target.checked } })} />
                          Blink when alarm on bound tag
                        </label>
                      </div>

                      {/* Write Control */}
                      {(selectedObject.type === 'button' || selectedObject.type === 'switch' || selectedObject.type === 'slider') ? (
                        <div className="prop-card-group">
                          <div className="prop-card-group-title">
                            <Icon icon="solar:bolt-bold-duotone" width="14" height="14" style={{ marginRight: 6 }} /> Write Control
                          </div>
                          {selectedObject.type === 'button' ? (
                            <label>Write Value<input value={String(selectedObject.style?.writeValue ?? '')} onChange={(e) => onUpdate({ style: { ...selectedObject.style, writeValue: e.target.value } })} placeholder="e.g. 1 or true" /></label>
                          ) : null}
                          {selectedObject.type === 'switch' ? (
                            <div className="two-col">
                              <label>ON Value<input value={String(selectedObject.style?.writeOnValue ?? 1)} onChange={(e) => onUpdate({ style: { ...selectedObject.style, writeOnValue: e.target.value } })} /></label>
                              <label>OFF Value<input value={String(selectedObject.style?.writeOffValue ?? 0)} onChange={(e) => onUpdate({ style: { ...selectedObject.style, writeOffValue: e.target.value } })} /></label>
                            </div>
                          ) : null}
                          {selectedObject.type === 'slider' ? (
                            <label>Step<input type="number" min={0.1} value={Number(selectedObject.style?.step ?? 1)} onChange={(e) => onUpdate({ style: { ...selectedObject.style, step: Number(e.target.value) } })} /></label>
                          ) : null}
                          <label>Enable When Tag<input value={String(selectedObject.style?.enabledWhenTag ?? '')} onChange={(e) => onUpdate({ style: { ...selectedObject.style, enabledWhenTag: e.target.value } })} placeholder="optional" /></label>
                          <div className="two-col">
                            <label>Enable Op
                              <select value={String(selectedObject.style?.enabledWhenOp ?? '==')} onChange={(e) => onUpdate({ style: { ...selectedObject.style, enabledWhenOp: e.target.value } })}>
                                <option value="==">==</option>
                                <option value="!=">!=</option>
                                <option value=">">{'>'}</option>
                                <option value="<">{'<'}</option>
                              </select>
                            </label>
                            <label>Enable Value<input type="number" value={Number(selectedObject.style?.enabledWhenValue ?? 1)} onChange={(e) => onUpdate({ style: { ...selectedObject.style, enabledWhenValue: Number(e.target.value) } })} /></label>
                          </div>
                          <label style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
                            <input type="checkbox" checked={selectedObject.style?.confirmWrite === true} onChange={(e) => onUpdate({ style: { ...selectedObject.style, confirmWrite: e.target.checked } })} />
                            Confirm before write
                          </label>
                          <label style={{ marginTop: 6 }}>Interlock Tag (block write when active)
                            <select
                              value={String(selectedObject.style?.interlockTagId ?? '')}
                              onChange={(e) => onUpdate({ style: { ...selectedObject.style, interlockTagId: e.target.value || undefined } })}
                            >
                              <option value="">— None —</option>
                              {tags.map((tag) => (
                                <option key={tag.id} value={tag.id}>{tag.name}</option>
                              ))}
                            </select>
                          </label>
                          <label style={{ marginTop: 6 }}>Interlock block when value
                            <input
                              value={String(selectedObject.style?.interlockBlockWhen ?? '1')}
                              onChange={(e) => onUpdate({ style: { ...selectedObject.style, interlockBlockWhen: e.target.value } })}
                              placeholder="1"
                            />
                          </label>
                        </div>
                      ) : null}

                      {/* Conditional Colors / Alarms */}
                      {(selectedObject.type === 'value' || selectedObject.type === 'gauge' || selectedObject.type === 'alarmtable') && (
                        <div className="prop-card-group">
                          <div className="prop-card-group-title">
                            <Icon icon="solar:bell-bing-bold-duotone" width="14" height="14" style={{ marginRight: 6 }} /> Alarm & Threshold Limits
                          </div>
                          {selectedObject.type === 'alarmtable' ? (
                            <>
                              <label>Severity filter
                                <select
                                  value={String(selectedObject.style?.alarmSeverityFilter ?? 'all')}
                                  onChange={(event) => onUpdate({ style: { ...selectedObject.style, alarmSeverityFilter: event.target.value } })}
                                >
                                  <option value="all">All</option>
                                  <option value="critical">Critical</option>
                                  <option value="high">High</option>
                                  <option value="warning">Warning</option>
                                  <option value="info">Info</option>
                                </select>
                              </label>
                              <label style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
                                <input
                                  type="checkbox"
                                  checked={selectedObject.style?.alarmSound === true}
                                  onChange={(e) => onUpdate({ style: { ...selectedObject.style, alarmSound: e.target.checked } })}
                                />
                                Beep on new alarm (runtime)
                              </label>
                            </>
                          ) : (
                            <div className="two-col">
                              <label>Threshold High<input type="number" value={selectedObject.style?.thresholdHigh != null ? Number(selectedObject.style.thresholdHigh) : ''} onChange={(e) => onUpdate({ style: { ...selectedObject.style, thresholdHigh: e.target.value === '' ? undefined : Number(e.target.value) } })} /></label>
                              <label>Threshold Low<input type="number" value={selectedObject.style?.thresholdLow != null ? Number(selectedObject.style.thresholdLow) : ''} onChange={(e) => onUpdate({ style: { ...selectedObject.style, thresholdLow: e.target.value === '' ? undefined : Number(e.target.value) } })} /></label>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
                )}
    </>
  );
}
