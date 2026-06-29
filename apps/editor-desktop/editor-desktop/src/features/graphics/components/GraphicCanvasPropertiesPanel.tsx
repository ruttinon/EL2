import { Icon } from '@iconify/react';
import type { GraphicObjectDefinition, GraphicSummary, UnifiedCameraPreset } from '@energylink/shared-types';
import { DEFAULT_MM_PER_PX } from '@energylink/graphics-runtime';

type CanvasImage = { id: string; name: string; dataUrl: string };

export type GraphicCanvasPropertiesPanelProps = {
  graphic: GraphicSummary;
  images: CanvasImage[];
  gridEnabled: boolean;
  cameraPreset: UnifiedCameraPreset;
  onGridChange: (enabled: boolean) => void;
  onCameraChange: (preset: UnifiedCameraPreset) => void;
  onUpdateGraphic: (updater: (graphic: GraphicSummary) => GraphicSummary) => void;
  syncScene3dObjects: (objects: GraphicObjectDefinition[], width: number, height: number) => GraphicObjectDefinition[];
};

export function GraphicCanvasPropertiesPanel({
  graphic,
  images,
  gridEnabled,
  cameraPreset,
  onGridChange,
  onCameraChange,
  onUpdateGraphic,
  syncScene3dObjects,
}: GraphicCanvasPropertiesPanelProps) {
  return (
    <div className="prop-card-group">
      <div className="prop-card-group-title">
        <Icon icon="solar:palette-bold-duotone" width="14" height="14" style={{ marginRight: 6 }} />
        Canvas Settings
      </div>
      <label>
        Name
        <input value={graphic.name} onChange={(e) => onUpdateGraphic((g) => ({ ...g, name: e.target.value }))} />
      </label>
      <label>
        Description
        <input value={graphic.description || ''} onChange={(e) => onUpdateGraphic((g) => ({ ...g, description: e.target.value }))} />
      </label>
      <div className="two-col">
        <label>
          Width
          <input
            type="number"
            min={320}
            value={graphic.width}
            onChange={(e) => {
              const width = Number(e.target.value);
              onUpdateGraphic((g) => ({
                ...g,
                width,
                layout: {
                  ...(g.layout || { version: 1, objects: [] }),
                  objects: syncScene3dObjects(g.layout?.objects ?? [], width, g.height),
                },
              }));
            }}
          />
        </label>
        <label>
          Height
          <input
            type="number"
            min={240}
            value={graphic.height}
            onChange={(e) => {
              const height = Number(e.target.value);
              onUpdateGraphic((g) => ({
                ...g,
                height,
                layout: {
                  ...(g.layout || { version: 1, objects: [] }),
                  objects: syncScene3dObjects(g.layout?.objects ?? [], g.width, height) as GraphicSummary['layout'] extends { objects?: infer O } ? O : never,
                },
              }));
            }}
          />
        </label>
      </div>
      <div className="two-col">
        <label>
          Refresh ms
          <input
            type="number"
            min={250}
            value={graphic.refreshIntervalMs}
            onChange={(e) => onUpdateGraphic((g) => ({ ...g, refreshIntervalMs: Number(e.target.value) }))}
          />
        </label>
        <label>
          Background Color
          <input
            value={graphic.layout?.backgroundColor || '#fbfdff'}
            onChange={(e) => onUpdateGraphic((g) => {
              const currentLayout = g.layout || { version: 1, backgroundColor: '#fbfdff', objects: [] };
              return { ...g, layout: { ...currentLayout, backgroundColor: e.target.value } };
            })}
          />
        </label>
      </div>
      <label style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '6px', cursor: 'pointer', marginTop: '10px', marginBottom: '14px' }}>
        <input type="checkbox" checked={gridEnabled} onChange={(e) => onGridChange(e.target.checked)} />
        <span>Grid 20px Snap</span>
      </label>
      <label>
        Scene scale (mm per pixel)
        <input
          type="number"
          min={1}
          max={500}
          value={Number(graphic.layout?.sceneScaleMmPerPx ?? DEFAULT_MM_PER_PX)}
          onChange={(e) => onUpdateGraphic((g) => {
            const currentLayout = g.layout || { version: 1, backgroundColor: '#fbfdff', objects: [] };
            return {
              ...g,
              layout: { ...currentLayout, sceneScaleMmPerPx: Number(e.target.value) || DEFAULT_MM_PER_PX },
            };
          })}
        />
      </label>
      <div className="prop-hint">Used when placing equipment from Scene Catalog at real-world size (default 10 mm/px).</div>
      <label>
        Default camera (Monitor / runtime)
        <select value={cameraPreset} onChange={(e) => onCameraChange(e.target.value as UnifiedCameraPreset)}>
          <option value="flat">Monitor (flat)</option>
          <option value="top">Top (floor plan)</option>
          <option value="orbit">Orbit 3D</option>
        </select>
      </label>
      <div className="prop-hint">Unified frame — 2D widgets และ 3D world อยู่ในเฟรมเดียว สลับมุมกล้องได้</div>
      <div style={{ borderTop: '1px solid #edf4f7', paddingTop: '12px' }}>
        <div className="prop-hint" style={{ fontWeight: 700, color: '#034f5a', marginBottom: '6px' }}>Canvas Background Image</div>
        {images.length === 0 ? (
          <div className="prop-hint" style={{ color: 'var(--color-warning, #f59e0b)' }}>
            No images in library. Please import at Setup → Assets.
          </div>
        ) : (
          <>
            <div className="image-picker-grid" style={{ marginBottom: '8px' }}>
              {images.map((img) => (
                <button
                  key={img.id}
                  type="button"
                  className={`image-picker-item ${graphic.layout?.backgroundImage === img.dataUrl ? 'selected' : ''}`}
                  onClick={() => onUpdateGraphic((g) => {
                    const currentLayout = g.layout || { version: 1, backgroundColor: '#fbfdff', objects: [] };
                    return { ...g, layout: { ...currentLayout, backgroundImage: img.dataUrl } };
                  })}
                  title={img.name}
                >
                  <img src={img.dataUrl} alt={img.name} />
                </button>
              ))}
            </div>
            {graphic.layout?.backgroundImage ? (
              <button
                type="button"
                className="btn danger tiny"
                style={{ width: '100%', fontSize: '11px', padding: '4px' }}
                onClick={() => onUpdateGraphic((g) => {
                  const currentLayout = g.layout || { version: 1, backgroundColor: '#fbfdff', objects: [] };
                  return { ...g, layout: { ...currentLayout, backgroundImage: null } };
                })}
              >
                Remove Background Image
              </button>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
