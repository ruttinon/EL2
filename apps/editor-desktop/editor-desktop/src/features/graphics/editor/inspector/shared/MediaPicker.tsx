import { useMemo } from 'react';
import { Upload, X } from 'lucide-react';
import type { GraphicAssetKind } from '@energylink/shared-types';
import {
  acceptFilterForKind,
  assetsByKind,
  importMediaFileToAsset,
  importModelFileToAsset,
  loadGraphicAssets,
  resolveAssetRef,
} from '../../../graphicAssets';

export type MediaPickerProps = {
  label: string;
  kind: GraphicAssetKind;
  /** Resolved display URL */
  currentUrl?: string;
  emptyText?: string;
  onApply: (payload: { url: string; ref?: string; assetId?: string }) => void;
  onClear: () => void;
};

const IMAGE_ACCEPT =
  'image/png,image/jpeg,image/jpg,image/webp,image/gif,image/bmp,image/x-icon,image/svg+xml,.png,.jpg,.jpeg,.webp,.gif,.bmp,.ico,.svg';

const VIDEO_ACCEPT =
  'video/mp4,video/webm,video/ogg,video/quicktime,video/x-msvideo,.mp4,.webm,.mov,.avi,.mkv,.ogv';

export function mediaAcceptForKind(kind: GraphicAssetKind): string {
  if (kind === 'image' || kind === 'svg') return IMAGE_ACCEPT;
  if (kind === 'video') return VIDEO_ACCEPT;
  if (kind === 'model3d') return '.glb,.gltf,model/gltf-binary,model/gltf+json';
  return acceptFilterForKind(kind);
}

export function MediaPicker({
  label,
  kind,
  currentUrl,
  emptyText = 'No file',
  onApply,
  onClear,
}: MediaPickerProps) {
  const library = useMemo(() => {
    const assets = loadGraphicAssets();
    const kinds = kind === 'svg' ? ['image', 'svg'] as const : [kind];
    return kinds.flatMap((k) => assetsByKind(assets, k));
  }, [kind, currentUrl]);

  const pickFile = async (file?: File | null) => {
    if (!file) return;
    if (kind === 'model3d') {
      const { ref, url, assetId } = await importModelFileToAsset(file);
      onApply({ url, ref: ref !== url ? ref : undefined, assetId });
    } else {
      const importKind = kind === 'svg' ? 'svg' : kind === 'video' ? 'video' : 'image';
      const { ref, url, assetId } = await importMediaFileToAsset(file, importKind);
      onApply({ url, ref: ref !== url ? ref : undefined, assetId });
    }
  };

  const pickFromLibrary = (assetId: string) => {
    const asset = library.find((a) => a.id === assetId);
    if (!asset) return;
    const ref = `asset://${asset.id}`;
    onApply({ url: resolveAssetRef(ref) || asset.url, ref, assetId: asset.id });
  };

  const isVideo = kind === 'video';

  return (
    <div className="ins-media-block">
      <div className="ins-media-block-label">{label}</div>
      {currentUrl ? (
        <div className="ins-media ins-media-lg">
          {isVideo ? (
            <video className="ins-thumb ins-thumb-video" src={currentUrl} muted playsInline />
          ) : (
            <img className="ins-thumb ins-thumb-lg" src={currentUrl} alt="" />
          )}
          <button type="button" className="ins-media-clear" title="Remove" onClick={onClear}>
            <X size={14} />
          </button>
        </div>
      ) : (
        <div className="ins-empty ins-empty-media">{emptyText}</div>
      )}

      <label className="ins-file-btn ins-file-btn-primary">
        <Upload size={14} /> Upload from device…
        <input
          type="file"
          accept={mediaAcceptForKind(kind)}
          hidden
          onChange={(e) => void pickFile(e.target.files?.[0])}
        />
      </label>

      {library.length > 0 ? (
        <label className="ins-row ins-row-stack">
          <span>Media Library</span>
          <select
            value=""
            onChange={(e) => {
              if (e.target.value) pickFromLibrary(e.target.value);
            }}
          >
            <option value="">— Select from library —</option>
            {library.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </label>
      ) : null}

      <p className="ins-hint">
        {kind === 'video'
          ? 'Supports MP4, WebM, MOV, AVI, MKV and stream links'
          : kind === 'model3d'
          ? 'Supports GLB, GLTF 3D Models'
          : 'Supports PNG, JPG, WebP, GIF, SVG, BMP, ICO'}
      </p>
    </div>
  );
}
