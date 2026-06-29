import type { GraphicObjectDefinition } from '@energylink/shared-types';
import { hexForColorInput } from '../../../colorInput';
import { resolveImageUrl } from '../../../imageHelpers';
import { mergeStyle, styleNum, styleStr } from '../inspectorUtils';
import { SegmentedControl } from '../shared/SegmentedControl';
import { MediaPicker } from '../shared/MediaPicker';

export type ImageInspectorProps = {
  selected: GraphicObjectDefinition;
  onUpdate: (id: string, patch: Partial<GraphicObjectDefinition>) => void;
};

type FrameMode = 'free' | 'boxed';
type FitMode = 'contain' | 'cover' | 'fill' | 'none';

function frameMode(obj: GraphicObjectDefinition): FrameMode {
  return styleStr(obj, 'imageFrameMode', 'free') === 'boxed' ? 'boxed' : 'free';
}

export function ImageInspector({ selected, onUpdate }: ImageInspectorProps) {
  const setStyle = (patch: Record<string, string | number | boolean | undefined>) => {
    onUpdate(selected.id, { style: mergeStyle(selected, patch) });
  };

  const applyImage = (payload: { url: string; ref?: string; assetId?: string }) => {
    const stored = payload.ref ?? payload.url;
    onUpdate(selected.id, {
      imageDataUrl: stored,
      displayMode: 'image',
      imageId: payload.assetId,
      style: mergeStyle(selected, {
        imageDataUrl: stored,
        imageAssetRef: payload.ref,
        imageFrameMode: frameMode(selected),
        objectFit: styleStr(selected, 'objectFit', 'contain'),
      }),
    } as Partial<GraphicObjectDefinition>);
  };

  const clearImage = () => {
    const nextStyle = { ...selected.style };
    delete (nextStyle as Record<string, unknown>).imageDataUrl;
    delete (nextStyle as Record<string, unknown>).imageAssetRef;
    onUpdate(selected.id, {
      imageDataUrl: undefined,
      imageId: undefined,
      style: nextStyle,
    } as Partial<GraphicObjectDefinition>);
  };

  const mode = frameMode(selected);
  const fit = styleStr(selected, 'objectFit', 'contain') as FitMode;
  const opacity = styleNum(selected, 'mediaOpacity', 100);

  const setFrameMode = (next: FrameMode) => {
    if (next === 'free') {
      setStyle({
        imageFrameMode: 'free',
        transparentBg: true,
        fill: 'transparent',
        background: 'transparent',
        strokeWidth: 0,
        stroke: 'transparent',
        borderColor: 'transparent',
      });
    } else {
      setStyle({
        imageFrameMode: 'boxed',
        transparentBg: false,
        fill: styleStr(selected, 'fill', '#f8fafc'),
        background: styleStr(selected, 'background', '#f8fafc'),
        strokeWidth: styleNum(selected, 'strokeWidth', 1),
        stroke: styleStr(selected, 'stroke', '#cbd5e1'),
        borderColor: styleStr(selected, 'borderColor', '#cbd5e1'),
      });
    }
  };

  return (
    <section className="ins-sec ins-sec-premium">
      <h4>Image</h4>

      <MediaPicker
        label="Image File"
        kind="image"
        currentUrl={resolveImageUrl(selected)}
        emptyText="Drag image to canvas or upload below"
        onApply={applyImage}
        onClear={clearImage}
      />

      <label className="ins-field-label">Display Mode</label>
      <SegmentedControl<FrameMode>
        value={mode}
        options={[
          { value: 'free', label: 'Free Image' },
          { value: 'boxed', label: 'Boxed' },
        ]}
        onChange={setFrameMode}
      />
      <p className="ins-hint">
        {mode === 'free'
          ? 'No background/border — suitable for freeform PNG/SVG'
          : 'Adjustable box/background — suitable for cards/thumbnails'}
      </p>

      <label className="ins-field-label">Image Fit</label>
      <SegmentedControl<FitMode>
        value={fit}
        options={[
          { value: 'contain', label: 'Contain' },
          { value: 'cover', label: 'Cover' },
          { value: 'fill', label: 'Fill' },
          { value: 'none', label: 'None' },
        ]}
        onChange={(v) => setStyle({ objectFit: v })}
      />

      <label className="ins-row ins-row-range">
        <span>Opacity</span>
        <input
          type="range"
          min={10}
          max={100}
          value={opacity}
          onChange={(e) => setStyle({ mediaOpacity: Number(e.target.value) })}
        />
        <span className="ins-range-val">{opacity}%</span>
      </label>

      {mode === 'boxed' ? (
        <div className="ins-subsec">
          <div className="ins-subsec-title">Box and Background</div>
          <label className="ins-row">
            <span>Background</span>
            <input
              type="color"
              value={hexForColorInput(styleStr(selected, 'fill', '#f8fafc'), '#f8fafc')}
              onChange={(e) => setStyle({ fill: e.target.value, background: e.target.value, transparentBg: false })}
            />
          </label>
          <label className="ins-row">
            <span>Border</span>
            <input
              type="color"
              value={hexForColorInput(styleStr(selected, 'stroke', '#cbd5e1'), '#cbd5e1')}
              onChange={(e) => setStyle({ stroke: e.target.value, borderColor: e.target.value })}
            />
          </label>
          <label className="ins-row">
            <span>Border Width</span>
            <input
              type="number"
              min={0}
              max={24}
              value={styleNum(selected, 'strokeWidth', 1)}
              onChange={(e) => setStyle({ strokeWidth: Number(e.target.value) })}
            />
          </label>
          <label className="ins-row">
            <span>Border Radius</span>
            <input
              type="number"
              min={0}
              max={48}
              value={styleNum(selected, 'borderRadius', 0)}
              onChange={(e) => setStyle({ borderRadius: Number(e.target.value) })}
            />
          </label>
        </div>
      ) : null}
    </section>
  );
}
