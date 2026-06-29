import { useMemo, useRef, useState } from 'react';
import { Upload, Trash2, Image as ImageIcon, Film, Box, File } from 'lucide-react';
import type { GraphicAsset, GraphicAssetKind } from '@energylink/shared-types';
import {
  acceptFilterForKind,
  assetKindFromFile,
  assetsByKind,
  importMediaFileToAsset,
  importModelFileToAsset,
  loadGraphicAssets,
  saveGraphicAssets,
} from '../graphicAssets';

type AssetFilter = 'all' | GraphicAssetKind;

const FILTERS: { id: AssetFilter; label: string }[] = [
  { id: 'all', label: 'ทั้งหมด' },
  { id: 'image', label: 'รูป' },
  { id: 'video', label: 'วิดีโอ' },
  { id: 'model3d', label: '3D' },
  { id: 'svg', label: 'SVG' },
];

function kindIcon(kind: GraphicAssetKind) {
  if (kind === 'video') return Film;
  if (kind === 'model3d') return Box;
  if (kind === 'image' || kind === 'svg') return ImageIcon;
  return File;
}

function formatSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export type AssetLibraryPanelProps = {
  onAssetsChange?: () => void;
};

export function AssetLibraryPanel({ onAssetsChange }: AssetLibraryPanelProps) {
  const [filter, setFilter] = useState<AssetFilter>('all');
  const [assets, setAssets] = useState<GraphicAsset[]>(() => loadGraphicAssets());
  const fileRef = useRef<HTMLInputElement>(null);

  const visible = useMemo(() => {
    if (filter === 'all') return assets;
    return assetsByKind(assets, filter);
  }, [assets, filter]);

  const refresh = () => {
    const next = loadGraphicAssets();
    setAssets(next);
    onAssetsChange?.();
  };

  const uploadFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    for (const file of [...files]) {
      const kind = assetKindFromFile(file);
      if (!kind) continue;
      try {
        if (kind === 'model3d') await importModelFileToAsset(file);
        else if (kind === 'image' || kind === 'video' || kind === 'svg') {
          const mediaKind = kind === 'svg' ? 'svg' : kind;
          await importMediaFileToAsset(file, mediaKind);
        }
      } catch {
        /* skip unsupported */
      }
    }
    refresh();
  };

  const removeAsset = (id: string) => {
    const next = assets.filter((a) => a.id !== id);
    saveGraphicAssets(next);
    setAssets(next);
    onAssetsChange?.();
  };

  return (
    <div className="asset-lib">
      <div className="asset-lib-head">
        <p className="asset-lib-desc">Central Media Library — reuse in image/video/widget</p>
        <button type="button" className="ins-file-btn ins-file-btn-primary asset-lib-upload" onClick={() => fileRef.current?.click()}>
          <Upload size={14} /> Upload…
        </button>
        <input
          ref={fileRef}
          type="file"
          multiple
          hidden
          accept={acceptFilterForKind('all')}
          onChange={(e) => void uploadFiles(e.target.files)}
        />
      </div>

      <div className="ins-seg asset-lib-filters">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            className={filter === f.id ? 'active' : ''}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="asset-lib-list">
        {visible.length === 0 ? (
          <p className="ins-empty">ยังไม่มีไฟล์ — อัปโหลดรูป วิดีโอ หรือ GLB</p>
        ) : (
          visible.map((a) => {
            const Icon = kindIcon(a.kind);
            const isVisual = a.kind === 'image' || a.kind === 'svg' || a.kind === 'video';
            return (
              <div key={a.id} className="asset-lib-row">
                <div className="asset-lib-thumb">
                  {isVisual && a.kind !== 'video' ? (
                    <img src={a.url} alt="" />
                  ) : a.kind === 'video' ? (
                    <video src={a.url} muted playsInline />
                  ) : (
                    <Icon size={20} />
                  )}
                </div>
                <div className="asset-lib-meta">
                  <div className="asset-lib-name">{a.name}</div>
                  <div className="asset-lib-sub">{a.kind} · {formatSize(a.fileSize)}</div>
                </div>
                <button type="button" className="asset-lib-del" title="ลบ" onClick={() => removeAsset(a.id)}>
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
