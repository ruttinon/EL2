import type { GraphicObjectDefinition } from '@energylink/shared-types';
import { resolveAssetRef, loadGraphicAssets } from '../../../graphicAssets';
import { mergeStyle, styleBool, styleStr } from '../inspectorUtils';
import { SegmentedControl } from '../shared/SegmentedControl';
import { MediaPicker } from '../shared/MediaPicker';

export type VideoInspectorProps = {
  selected: GraphicObjectDefinition;
  onUpdate: (id: string, patch: Partial<GraphicObjectDefinition>) => void;
};

type SourceMode = 'file' | 'url' | 'hls' | 'mjpeg' | 'rtsp';
type FrameMode = 'free' | 'boxed';
type FitMode = 'contain' | 'cover' | 'fill';

function resolveVideoUrl(obj: GraphicObjectDefinition): string {
  const raw = styleStr(obj, 'videoUrl', obj.text ?? '');
  if (!raw) return '';
  return resolveAssetRef(raw, loadGraphicAssets()) || raw;
}

function detectSourceMode(obj: GraphicObjectDefinition): SourceMode {
  const explicit = styleStr(obj, 'streamType', '');
  if (explicit === 'hls' || explicit === 'mjpeg' || explicit === 'rtsp') return explicit;
  if (explicit === 'file' && obj.style?.videoAssetRef) return 'file';
  const url = styleStr(obj, 'videoUrl', obj.text ?? '');
  if (url.startsWith('rtsp://')) return 'rtsp';
  if (url.includes('.m3u8')) return 'hls';
  if (obj.style?.videoAssetRef) return 'file';
  return url && !url.startsWith('data:') && !url.startsWith('asset://') ? 'url' : 'file';
}

export function VideoInspector({ selected, onUpdate }: VideoInspectorProps) {
  const setStyle = (patch: Record<string, string | number | boolean | undefined>) => {
    onUpdate(selected.id, { style: mergeStyle(selected, patch) });
  };

  const sourceMode = detectSourceMode(selected);
  const frame = styleStr(selected, 'mediaFrameMode', 'boxed') === 'free' ? 'free' : 'boxed';
  const fit = styleStr(selected, 'videoObjectFit', styleStr(selected, 'objectFit', 'contain')) as FitMode;
  const videoUrl = resolveVideoUrl(selected);
  const showFilePreview = Boolean(
    videoUrl && (videoUrl.startsWith('data:') || videoUrl.startsWith('asset://') || videoUrl.startsWith('blob:') || /\.(mp4|webm|mov)(\?|$)/i.test(videoUrl)),
  );

  const setSourceMode = (mode: SourceMode) => {
    const streamType = mode === 'url' ? 'file' : mode;
    setStyle({ streamType, videoSourceMode: mode });
  };

  const applyVideoFile = (payload: { url: string; ref?: string }) => {
    const stored = payload.ref ?? payload.url;
    onUpdate(selected.id, {
      text: stored,
      style: mergeStyle(selected, {
        videoUrl: stored,
        videoAssetRef: payload.ref,
        streamType: 'file',
        videoSourceMode: 'file',
      }),
    });
  };

  const clearVideoFile = () => {
    const nextStyle = { ...selected.style };
    delete (nextStyle as Record<string, unknown>).videoUrl;
    delete (nextStyle as Record<string, unknown>).videoAssetRef;
    onUpdate(selected.id, { text: '', style: nextStyle });
  };

  const setFrameMode = (next: FrameMode) => {
    if (next === 'free') {
      setStyle({
        mediaFrameMode: 'free',
        transparentBg: true,
        fill: 'transparent',
        background: 'transparent',
        strokeWidth: 0,
        stroke: 'transparent',
      });
    } else {
      setStyle({
        mediaFrameMode: 'boxed',
        transparentBg: false,
        fill: '#0f172a',
        background: '#0f172a',
      });
    }
  };

  return (
    <section className="ins-sec ins-sec-premium">
      <h4>Video</h4>

      <label className="ins-field-label">Source Type</label>
      <SegmentedControl<SourceMode>
        value={sourceMode}
        options={[
          { value: 'file', label: 'File' },
          { value: 'url', label: 'URL' },
          { value: 'hls', label: 'HLS' },
          { value: 'mjpeg', label: 'MJPEG' },
          { value: 'rtsp', label: 'RTSP' },
        ]}
        onChange={setSourceMode}
      />

      {sourceMode === 'file' ? (
        <MediaPicker
          label="Video File"
          kind="video"
          currentUrl={showFilePreview ? videoUrl : undefined}
          emptyText="Upload MP4, WebM, MOV…"
          onApply={applyVideoFile}
          onClear={clearVideoFile}
        />
      ) : (
        <label className="ins-row ins-row-stack">
          <span>
            {sourceMode === 'hls' ? 'HLS (.m3u8)'
              : sourceMode === 'mjpeg' ? 'MJPEG URL'
              : sourceMode === 'rtsp' ? 'RTSP URL'
              : 'Video URL'}
          </span>
          <input
            value={styleStr(selected, 'videoUrl', selected.text ?? '')}
            placeholder={
              sourceMode === 'rtsp' ? 'rtsp://…'
              : sourceMode === 'hls' ? 'https://…/playlist.m3u8'
              : 'https://…'
            }
            onChange={(e) => onUpdate(selected.id, {
              text: e.target.value,
              style: mergeStyle(selected, {
                videoUrl: e.target.value,
                streamType: sourceMode === 'url' ? 'file' : sourceMode,
              }),
            })}
          />
        </label>
      )}

      <label className="ins-field-label">Frame Style</label>
      <SegmentedControl<FrameMode>
        value={frame}
        options={[
          { value: 'free', label: 'Frameless' },
          { value: 'boxed', label: 'Boxed' },
        ]}
        onChange={setFrameMode}
      />

      <label className="ins-field-label">Object Fit</label>
      <SegmentedControl<FitMode>
        value={fit}
        options={[
          { value: 'contain', label: 'Contain' },
          { value: 'cover', label: 'Cover' },
          { value: 'fill', label: 'Fill' },
        ]}
        onChange={(v) => setStyle({ videoObjectFit: v, objectFit: v })}
      />

      <div className="ins-subsec">
        <div className="ins-subsec-title">Playback</div>
        <label className="ins-check">
          <input
            type="checkbox"
            checked={styleBool(selected, 'videoAutoplay', true)}
            onChange={(e) => setStyle({ videoAutoplay: e.target.checked })}
          />
          <span>Autoplay</span>
        </label>
        <label className="ins-check">
          <input
            type="checkbox"
            checked={styleBool(selected, 'videoMuted', true)}
            onChange={(e) => setStyle({ videoMuted: e.target.checked })}
          />
          <span>Muted (Required for autoplay)</span>
        </label>
        <label className="ins-check">
          <input
            type="checkbox"
            checked={styleBool(selected, 'videoLoop', true)}
            onChange={(e) => setStyle({ videoLoop: e.target.checked })}
          />
          <span>Loop</span>
        </label>
        <label className="ins-check">
          <input
            type="checkbox"
            checked={styleBool(selected, 'videoControls', false)}
            onChange={(e) => setStyle({ videoControls: e.target.checked })}
          />
          <span>Show Controls</span>
        </label>
      </div>
    </section>
  );
}
