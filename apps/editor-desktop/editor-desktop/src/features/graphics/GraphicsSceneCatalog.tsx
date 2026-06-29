import { Icon } from '@iconify/react';
import type { GraphicAsset, GraphicObjectType } from '@energylink/shared-types';

export type SceneCatalogImage = { id: string; name: string; dataUrl: string };

export type SceneCatalogDropPayload =
  | { kind: 'image'; name: string; dataUrl: string; realWidthMm?: number; realHeightMm?: number }
  | { kind: 'model3d'; name: string; glbUrl: string; realWidthMm?: number; realHeightMm?: number }
  | { kind: 'spline'; name: string; splineUrl: string; realWidthMm?: number; realHeightMm?: number }
  | { kind: 'type'; type: GraphicObjectType; name: string; realWidthMm?: number; realHeightMm?: number; symbolId?: string; style?: Record<string, unknown> };

export const SCENE_CATALOG_MIME = 'application/energylink-scene-asset';

export const SCENE_CATALOG_PRESETS: Array<{
  id: string;
  label: string;
  icon: string;
  color: string;
  payload: SceneCatalogDropPayload;
}> = [
  {
    id: 'floor-tile',
    label: 'Floor Tile',
    icon: 'solar:floor-bold-duotone',
    color: '#94a3b8',
    payload: { kind: 'type', type: 'rectangle', name: 'Floor', realWidthMm: 5000, realHeightMm: 5000 },
  },
  {
    id: 'meter-panel',
    label: 'Meter Panel',
    icon: 'solar:electric-refueling-bold-duotone',
    color: '#0ea5e9',
    payload: { kind: 'type', type: 'elecsymbol', name: 'Meter', symbolId: 'meter', realWidthMm: 400, realHeightMm: 600 },
  },
  {
    id: 'breaker',
    label: 'Breaker',
    icon: 'solar:plug-circle-bold-duotone',
    color: '#f59e0b',
    payload: { kind: 'type', type: 'elecsymbol', name: 'Breaker', symbolId: 'breaker', realWidthMm: 100, realHeightMm: 200 },
  },
  {
    id: 'transformer',
    label: 'Transformer',
    icon: 'solar:transmission-bold-duotone',
    color: '#8b5cf6',
    payload: { kind: 'type', type: 'elecsymbol', name: 'Transformer', symbolId: 'transformer', realWidthMm: 120, realHeightMm: 120 },
  },
  {
    id: 'power-line',
    label: 'Power Line',
    icon: 'solar:routing-2-bold-duotone',
    color: '#22d3ee',
    payload: { kind: 'type', type: 'flowpath', name: 'Power Line', realWidthMm: 2000, realHeightMm: 40 },
  },
  {
    id: 'motor',
    label: 'Motor',
    icon: 'solar:settings-bold-duotone',
    color: '#10b981',
    payload: { kind: 'type', type: 'elecsymbol', name: 'Motor', symbolId: 'motor', realWidthMm: 80, realHeightMm: 80 },
  },
  {
    id: 'ats-switch',
    label: 'ATS',
    icon: 'solar:transfer-horizontal-bold-duotone',
    color: '#f59e0b',
    payload: { kind: 'type', type: 'elecsymbol', name: 'ATS', symbolId: 'ats', realWidthMm: 120, realHeightMm: 160 },
  },
  {
    id: 'generator',
    label: 'Generator',
    icon: 'solar:bolt-circle-bold-duotone',
    color: '#22c55e',
    payload: { kind: 'type', type: 'elecsymbol', name: 'Generator', symbolId: 'generator', realWidthMm: 100, realHeightMm: 100 },
  },
  {
    id: 'disconnect',
    label: 'Disconnect',
    icon: 'solar:plug-circle-bold-duotone',
    color: '#94a3b8',
    payload: { kind: 'type', type: 'elecsymbol', name: 'Disconnect', symbolId: 'disconnect', realWidthMm: 80, realHeightMm: 160 },
  },
  {
    id: 'echart-line',
    label: 'Line Chart (ECharts)',
    icon: 'solar:graph-up-bold-duotone',
    color: '#087c8b',
    payload: { kind: 'type', type: 'echart', name: 'Line Chart', realWidthMm: 800, realHeightMm: 600, style: { echartType: 'line' } },
  },
  {
    id: 'echart-bar',
    label: 'Bar Chart (ECharts)',
    icon: 'solar:chart-square-bold-duotone',
    color: '#f59e0b',
    payload: { kind: 'type', type: 'echart', name: 'Bar Chart', realWidthMm: 800, realHeightMm: 600, style: { echartType: 'bar' } },
  },
  {
    id: 'echart-pie',
    label: 'Pie Chart (ECharts)',
    icon: 'solar:pie-chart-bold-duotone',
    color: '#8b5cf6',
    payload: { kind: 'type', type: 'echart', name: 'Pie Chart', realWidthMm: 600, realHeightMm: 600, style: { echartType: 'pie' } },
  },
  {
    id: 'gauge-speedometer',
    label: 'Gauge (Speedometer)',
    icon: 'solar:speedometer-bold-duotone',
    color: '#ef4444',
    payload: { kind: 'type', type: 'gauge', name: 'Gauge', realWidthMm: 600, realHeightMm: 600, style: { gaugeStyle: 'speedometer' } },
  },
];

export function parseSceneCatalogDrop(raw: string): SceneCatalogDropPayload | null {
  try {
    const data = JSON.parse(raw) as SceneCatalogDropPayload;
    if (data.kind === 'image' && data.dataUrl) return data;
    if (data.kind === 'model3d' && data.glbUrl) return data;
    if (data.kind === 'spline' && data.splineUrl) return data;
    if (data.kind === 'type' && data.type) return data;
    return null;
  } catch {
    return null;
  }
}

export function GraphicsSceneCatalog({
  images,
  model3dAssets = [],
  splineAssets = [],
  onDragStart,
  onImportImage,
}: {
  images: SceneCatalogImage[];
  model3dAssets?: GraphicAsset[];
  splineAssets?: GraphicAsset[];
  onDragStart: (payload: SceneCatalogDropPayload) => void;
  onImportImage?: () => void;
}) {
  function handleDrag(e: React.DragEvent, payload: SceneCatalogDropPayload) {
    e.dataTransfer.setData(SCENE_CATALOG_MIME, JSON.stringify(payload));
    e.dataTransfer.effectAllowed = 'copy';
    onDragStart(payload);
  }

  return (
    <div className="scene-catalog">
      <div className="scene-catalog-hint">
        ลากรูป = 2D บน canvas · โมเดล 3D ใช้ <b>Import HTML</b> หรือ <b>Import GLB</b> ·
        {onImportImage ? (
          <button type="button" className="btn-link" onClick={onImportImage}>เลือกไฟล์</button>
        ) : null}
      </div>
      <div className="scene-catalog-section-title">Equipment presets</div>
      <div className="scene-catalog-grid">
        {SCENE_CATALOG_PRESETS.map((item) => (
          <div
            key={item.id}
            className="scene-catalog-card"
            draggable
            onDragStart={(e) => handleDrag(e, item.payload)}
            title={`Drag ${item.label} to canvas`}
          >
            <Icon icon={item.icon} width="28" height="28" style={{ color: item.color }} />
            <span>{item.label}</span>
          </div>
        ))}
      </div>
      {images.length > 0 ? (
        <>
          <div className="scene-catalog-section-title">Images</div>
          <div className="scene-catalog-images">
            {images.map((img) => (
              <div
                key={img.id}
                className="scene-catalog-image-card"
                draggable
                onDragStart={(e) => handleDrag(e, {
                  kind: 'image',
                  name: img.name,
                  dataUrl: img.dataUrl,
                  realWidthMm: 800,
                  realHeightMm: 600,
                })}
                title={`Drag ${img.name}`}
              >
                <img src={img.dataUrl} alt={img.name} />
                <span>{img.name}</span>
              </div>
            ))}
          </div>
        </>
      ) : null}
      {images.length === 0 ? (
        <p className="scene-catalog-empty">Import image in "Media" tab or Setup → Assets</p>
      ) : null}
    </div>
  );
}
