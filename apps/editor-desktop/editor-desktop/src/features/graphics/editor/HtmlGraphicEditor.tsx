import { useRef } from 'react';
import { Upload, Globe, Code2, Activity, Play, Pencil } from 'lucide-react';
import type { GraphicSummary, GraphicExternalPage } from '@energylink/shared-types';
import type { CurrentTagValue, RuntimeAlarm, WriteTagOptions } from '@energylink/graphics-runtime';
import { HtmlGraphicPage } from '@energylink/graphics-runtime';
import { buildExternalPageFromHtmlFile, resolveAssetRef } from '../graphicAssets';

type Props = {
  graphic: GraphicSummary;
  zoom: number;
  livePreview: boolean;
  runMode: boolean;
  liveValues: CurrentTagValue[];
  liveAlarms: RuntimeAlarm[];
  onReplaceHtml: (externalPage: GraphicExternalPage) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onToggleLive: () => void;
  onToggleRun: () => void;
  onWriteTag?: (tagId: string, tagName: string, dataType: string, options?: WriteTagOptions) => void;
};

export function HtmlGraphicEditor({
  graphic,
  zoom,
  livePreview,
  runMode,
  liveValues,
  onReplaceHtml,
  onToggleLive,
  onToggleRun,
  onWriteTag,
  onZoomIn,
  onZoomOut,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const width = graphic.width || 1366;
  const height = graphic.height || 768;
  const runtimeActive = livePreview || runMode;

  const pickHtml = async (file?: File | null) => {
    if (!file) return;
    const ext = buildExternalPageFromHtmlFile(file);
    onReplaceHtml(await ext);
  };

  return (
    <div className="ge-html-editor">
      <div className="ge-html-toolbar">
        <span className="ge-html-badge"><Globe size={14} /> HTML Page</span>
        <button type="button" className="ge-icon-btn" title="Replace HTML file" onClick={() => fileRef.current?.click()}>
          <Upload size={18} /> Replace HTML
        </button>
        <button type="button" onClick={onZoomOut} title="Zoom out">−</button>
        <span>{Math.round(zoom * 100)}%</span>
        <button type="button" onClick={onZoomIn} title="Zoom in">+</button>
        <button
          type="button"
          className={`ge-live-btn${livePreview && !runMode ? ' active ge-live-on' : ''}`}
          onClick={onToggleLive}
          disabled={runMode}
        >
          <Activity size={16} /> Live
        </button>
        <button type="button" className={`ge-run-btn${runMode ? ' active ge-run-on' : ''}`} onClick={onToggleRun}>
          {runMode ? <Pencil size={16} /> : <Play size={16} />}
          {runMode ? 'Edit' : 'Run'}
        </button>
        <span className="ge-html-hint">
          <Code2 size={14} /> ใช้ <code>EnergyLink.readTag</code> / <code>EnergyLink.subscribe</code> / <code>EnergyLink.write</code> ใน HTML
        </span>
      </div>

      <div className="ge-html-stage-wrap" style={{ width: width * zoom, height: height * zoom }}>
        <div className="ge-html-stage" style={{ width, height, transform: `scale(${zoom})`, transformOrigin: 'top left' }}>
          <HtmlGraphicPage
            layout={graphic.layout}
            width={width}
            height={height}
            currentValues={runtimeActive ? liveValues : []}
            resolveAssetRef={resolveAssetRef}
            onWriteTag={runMode ? onWriteTag : undefined}
            interactive={runMode}
            className="ge-html-page-inner"
          />
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept=".html,.htm,text/html"
        hidden
        onChange={(e) => void pickHtml(e.target.files?.[0]).finally(() => { e.target.value = ''; })}
      />
    </div>
  );
}
