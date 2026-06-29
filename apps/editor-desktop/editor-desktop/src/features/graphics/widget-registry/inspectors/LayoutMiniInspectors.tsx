import type { ReactNode } from 'react';
import type { DeviceSummary, GraphicObjectDefinition, TagSummary } from '@energylink/shared-types';
import { defaultPolygonPoints } from '@energylink/graphics-runtime';
import { inferDeviceFlowTag } from '@energylink/widget-registry';
import { hexForColorInput } from '../../colorInput';
import { mergeStyle, styleNum, styleStr } from '../../editor/inspector/inspectorUtils';
import { ImageInspector } from '../../editor/inspector/widgets/ImageInspector';
import { VideoInspector } from '../../editor/inspector/widgets/VideoInspector';
import { DeviceTagBinding } from './DeviceTagBinding';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="ins-sec ins-sec-premium">
      <h4>{title}</h4>
      {children}
    </section>
  );
}

const SHAPE_TYPES = new Set(['text', 'rectangle', 'circle', 'polygon', 'line', 'bussection', 'panel']);

export function ShapeMiniInspector({
  selected,
  onUpdate,
}: {
  selected: GraphicObjectDefinition;
  onUpdate: (id: string, patch: Partial<GraphicObjectDefinition>) => void;
}) {
  if (!SHAPE_TYPES.has(selected.type)) return null;

  const setStyle = (patch: Record<string, string | number | boolean | undefined>) => {
    onUpdate(selected.id, { style: mergeStyle(selected, patch) });
  };

  return (
    <Section title="Shape">
      {selected.type === 'polygon' ? (
        <label className="ins-row">
          <span>Sides</span>
          <select
            value={String(styleNum(selected, 'polygonSides', 3))}
            onChange={(e) => {
              const sides = Math.max(3, Math.min(12, Number(e.target.value)));
              const pts = defaultPolygonPoints(selected.x, selected.y, selected.width, selected.height, sides);
              setStyle({ polygonSides: sides, polygonPoints: pts });
            }}
          >
            {[3, 4, 5, 6, 8, 12].map((n) => (
              <option key={n} value={n}>{n} Angle</option>
            ))}
          </select>
        </label>
      ) : null}

      {selected.type === 'line' ? (
        <>
          <label className="ins-row">
            <span>ColorLine</span>
            <input
              type="color"
              value={hexForColorInput(styleStr(selected, 'stroke', '#475569'), '#475569')}
              onChange={(e) => setStyle({ stroke: e.target.value, background: e.target.value })}
            />
          </label>
          <label className="ins-row">
            <span>Thickness</span>
            <input
              type="number"
              min={1}
              max={48}
              value={styleNum(selected, 'strokeWidth', 2)}
              onChange={(e) => {
                const sw = Math.max(1, Number(e.target.value));
                onUpdate(selected.id, {
                  height: Math.max(12, sw + 4),
                  style: mergeStyle(selected, {
                    strokeWidth: sw,
                    background: styleStr(selected, 'stroke', '#475569'),
                  }),
                });
              }}
            />
          </label>
          <label className="ins-row">
            <span>Format</span>
            <select value={styleStr(selected, 'lineDash', 'solid')} onChange={(e) => setStyle({ lineDash: e.target.value })}>
              <option value="solid">Solid</option>
              <option value="dashed">Dashed</option>
              <option value="dotted">Dotted</option>
            </select>
          </label>
          <label className="ins-row">
            <span>Line Cap</span>
            <select value={styleStr(selected, 'lineCap', 'round')} onChange={(e) => setStyle({ lineCap: e.target.value })}>
              <option value="round">Round</option>
              <option value="butt">Square</option>
              <option value="square">Projecting</option>
            </select>
          </label>
        </>
      ) : null}

      {selected.type === 'rectangle' || selected.type === 'panel' ? (
        <label className="ins-row">
          <span>Border Radius</span>
          <input
            type="number"
            min={0}
            value={styleNum(selected, 'borderRadius', selected.type === 'panel' ? 8 : 0)}
            onChange={(e) => setStyle({ borderRadius: Number(e.target.value) })}
          />
        </label>
      ) : null}

      {selected.type === 'circle' ? (
        <label className="ins-check">
          <input
            type="checkbox"
            checked={selected.style?.lockAspectRatio !== false}
            onChange={(e) => setStyle({ lockAspectRatio: e.target.checked })}
          />
          <span>Lock 1:1 (Circle)</span>
        </label>
      ) : null}

      {selected.type === 'text' ? (
        <label className="ins-row">
          <span>Align</span>
          <select value={styleStr(selected, 'align', 'center')} onChange={(e) => setStyle({ align: e.target.value })}>
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
          </select>
        </label>
      ) : null}

      {selected.type === 'bussection' ? (
        <p className="ins-hint">Bus has tap ports — Use Wire tool to draw lines starting from the bus.</p>
      ) : null}
    </Section>
  );
}

export function FlowPathMiniInspector({
  selected,
  devices,
  tags,
  onUpdate,
  onStartPathEdit,
}: {
  selected: GraphicObjectDefinition;
  devices: DeviceSummary[];
  tags: TagSummary[];
  onUpdate: (id: string, patch: Partial<GraphicObjectDefinition>) => void;
  onStartPathEdit?: (objectId: string) => void;
}) {
  const setStyle = (patch: Record<string, string | number | boolean | undefined>) => {
    onUpdate(selected.id, { style: mergeStyle(selected, patch) });
  };

  const bindFlowTag = (tagId: string | undefined) => {
    const tag = tags.find((t) => t.id === tagId);
    onUpdate(selected.id, {
      flowTagId: tagId,
      tagId: tagId ?? selected.tagId,
      deviceId: tag ? (tag.deviceId ?? tag.device_id) ?? selected.deviceId : selected.deviceId,
      binding: { ...selected.binding, flowTagId: tagId, tagId: tagId ?? selected.binding?.tagId },
    });
  };

  const bindDevice = (deviceId: string | undefined) => {
    const flowTagId = deviceId ? inferDeviceFlowTag(tags, deviceId) : undefined;
    onUpdate(selected.id, {
      deviceId,
      flowTagId,
      tagId: flowTagId ?? (deviceId ? undefined : selected.tagId),
      binding: {
        ...selected.binding,
        flowTagId,
        tagId: flowTagId ?? (deviceId ? undefined : selected.binding?.tagId),
      },
    });
  };

  const scopedTags = selected.deviceId ? tags.filter((t) => (t.deviceId ?? t.device_id) === selected.deviceId) : tags;
  const flowTag = selected.flowTagId ?? selected.binding?.flowTagId ?? selected.tagId ?? '';

  return (
    <Section title={selected.type === 'pipe' ? 'Pipe' : 'Flow Path'}>
      {onStartPathEdit ? (
        <button type="button" className="ins-file-btn" onClick={() => onStartPathEdit(selected.id)}>
          Edit Path Points
        </button>
      ) : (
        <p className="ins-hint">Double-click on canvas to edit path points.</p>
      )}
      {devices.length > 0 ? (
        <>
          <label className="ins-row">
            <span>Device</span>
            <select value={selected.deviceId ?? ''} onChange={(e) => bindDevice(e.target.value || undefined)}>
              <option value="">—</option>
              {devices.map((d) => (
                <option key={d.id} value={d.id}>{d.name ?? d.id}</option>
              ))}
            </select>
          </label>
          <label className="ins-row">
            <span>Flow Tag</span>
            <select value={flowTag} onChange={(e) => bindFlowTag(e.target.value || undefined)}>
              <option value="">—</option>
              {scopedTags.map((t) => (
                <option key={t.id} value={t.id}>{t.name ?? t.id}</option>
              ))}
            </select>
          </label>
        </>
      ) : (
        <DeviceTagBinding
          selected={selected}
          devices={devices}
          tags={tags}
          onUpdate={onUpdate}
          inferTag={inferDeviceFlowTag}
          tagLabel="Flow Tag"
        />
      )}
      <div className="ins-grid2">
        <label className="ins-row">
          <span>Flow Color</span>
          <input
            type="color"
            value={hexForColorInput(styleStr(selected, 'flowColor', '#22d3ee'), '#22d3ee')}
            onChange={(e) => setStyle({ flowColor: e.target.value })}
          />
        </label>
        <label className="ins-row">
          <span>Idle Color</span>
          <input
            type="color"
            value={hexForColorInput(styleStr(selected, 'idleColor', '#94a3b8'), '#94a3b8')}
            onChange={(e) => setStyle({ idleColor: e.target.value })}
          />
        </label>
        <label className="ins-row">
          <span>Threshold</span>
          <input
            type="number"
            step={0.1}
            value={styleNum(selected, 'flowThreshold', 0.5)}
            onChange={(e) => setStyle({ flowThreshold: Number(e.target.value) })}
          />
        </label>
        <label className="ins-row">
          <span>Thickness</span>
          <input
            type="number"
            min={1}
            max={24}
            value={styleNum(selected, 'strokeWidth', 4)}
            onChange={(e) => setStyle({ strokeWidth: Number(e.target.value) })}
          />
        </label>
      </div>
    </Section>
  );
}

export function ImageMiniInspector({
  selected,
  onUpdate,
}: {
  selected: GraphicObjectDefinition;
  onUpdate: (id: string, patch: Partial<GraphicObjectDefinition>) => void;
}) {
  return <ImageInspector selected={selected} onUpdate={onUpdate} />;
}

export function VideoMiniInspector({
  selected,
  onUpdate,
}: {
  selected: GraphicObjectDefinition;
  onUpdate: (id: string, patch: Partial<GraphicObjectDefinition>) => void;
}) {
  return <VideoInspector selected={selected} onUpdate={onUpdate} />;
}
