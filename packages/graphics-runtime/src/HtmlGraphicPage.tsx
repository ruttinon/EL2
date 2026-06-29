import React from 'react';
import type { CurrentTagValue } from './types';
import type { WriteTagOptions } from './objectLogic';
import type { GraphicLayout, GraphicPickedAnchor } from '@energylink/shared-types';
import {
  externalPageUsesUrl,
  injectEnergyLinkSdk,
  resolveExternalPageHtml,
} from './htmlPage';
import { htmlAnchorsFromIframeMessage, type HtmlAnchorMap } from './htmlAnchors';

export type { HtmlAnchorMap, HtmlAnchorPosition } from './htmlAnchors';

export type HtmlGraphicPageProps = {
  layout: GraphicLayout;
  width: number;
  height: number;
  currentValues?: CurrentTagValue[];
  resolveAssetRef?: (ref: string) => string;
  onWriteTag?: (tagId: string, tagName: string, dataType: string, options?: WriteTagOptions) => void;
  interactive?: boolean;
  className?: string;
  onAnchorsChange?: (anchors: HtmlAnchorMap) => void;
  /** Enable click-to-pick anchor mode inside iframe (editor 3D pick). */
  anchorPickMode?: boolean;
  /** Persisted editor-picked anchors restored on load. */
  pickedAnchors?: GraphicPickedAnchor[];
  onAnchorPicked?: (anchor: GraphicPickedAnchor) => void;
};

export function HtmlGraphicPage({
  layout,
  width,
  height,
  currentValues = [],
  resolveAssetRef,
  onWriteTag,
  interactive = true,
  className = '',
  onAnchorsChange,
  anchorPickMode = false,
  pickedAnchors = [],
  onAnchorPicked,
}: HtmlGraphicPageProps) {
  const iframeRef = React.useRef<HTMLIFrameElement>(null);
  const valuesByTag = React.useMemo(
    () => new Map(currentValues.map((v) => [v.id, v])),
    [currentValues],
  );

  const url = layout.externalPage?.url?.trim() ?? '';
  const useUrl = externalPageUsesUrl(layout);
  const rawHtml = resolveExternalPageHtml(layout, resolveAssetRef);
  const srcdoc = useUrl ? undefined : injectEnergyLinkSdk(rawHtml);
  const iframeSrc = useUrl && url.startsWith('http') ? url : undefined;

  React.useEffect(() => {
    const win = iframeRef.current?.contentWindow;
    if (!win || useUrl) return;
    for (const v of currentValues) {
      win.postMessage(
        {
          type: 'EL_TAG_UPDATE',
          tagId: v.id,
          value: v.value,
          unit: v.unit,
          quality: v.quality,
          name: v.name,
        },
        '*',
      );
    }
  }, [currentValues, useUrl]);

  const requestAnchors = React.useCallback(() => {
    const win = iframeRef.current?.contentWindow;
    if (!win || useUrl) return;
    win.postMessage({ type: 'EL_REQUEST_ANCHORS' }, '*');
  }, [useUrl]);

  React.useEffect(() => {
    requestAnchors();
  }, [requestAnchors, srcdoc, iframeSrc]);

  React.useEffect(() => {
    const win = iframeRef.current?.contentWindow;
    if (!win || useUrl) return;
    win.postMessage({ type: 'EL_PICK_MODE', enabled: anchorPickMode }, '*');
  }, [anchorPickMode, useUrl, srcdoc, iframeSrc]);

  React.useEffect(() => {
    const win = iframeRef.current?.contentWindow;
    if (!win || useUrl) return;
    const send = () => {
      if (pickedAnchors.length > 0) {
        win.postMessage({ type: 'EL_RESTORE_PICKED_ANCHORS', anchors: pickedAnchors }, '*');
      }
      win.postMessage({ type: 'EL_REQUEST_ANCHORS' }, '*');
    };
    send();
    const t = window.setTimeout(send, 120);
    return () => window.clearTimeout(t);
  }, [pickedAnchors, useUrl, srcdoc, iframeSrc]);

  React.useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.source !== iframeRef.current?.contentWindow) return;
      const msg = event.data as {
        type?: string;
        tagId?: string;
        value?: unknown;
        requestId?: string;
        anchors?: Array<{ id?: string; x?: number; y?: number; label?: string }>;
        anchor?: GraphicPickedAnchor;
      };
      if (!msg || typeof msg !== 'object') return;

      if (msg.type === 'EL_ANCHORS' && onAnchorsChange) {
        const win = iframeRef.current?.contentWindow;
        onAnchorsChange(
          htmlAnchorsFromIframeMessage(
            msg.anchors,
            win?.innerWidth ?? width,
            win?.innerHeight ?? height,
            width,
            height,
          ),
        );
        return;
      }

      if (msg.type === 'EL_ANCHOR_PICKED' && msg.anchor && onAnchorPicked) {
        const win = iframeRef.current?.contentWindow;
        const iw = win?.innerWidth ?? width;
        const ih = win?.innerHeight ?? height;
        const sx = width / (iw > 0 ? iw : width);
        const sy = height / (ih > 0 ? ih : height);
        onAnchorPicked({
          ...msg.anchor,
          x: msg.anchor.x * sx,
          y: msg.anchor.y * sy,
        });
        return;
      }

      if (!interactive) return;

      if (msg.type === 'EL_READ' && msg.tagId && msg.requestId) {
        const v = valuesByTag.get(msg.tagId);
        event.source?.postMessage(
          {
            type: 'EL_READ_RESULT',
            requestId: msg.requestId,
            tagId: msg.tagId,
            value: v?.value ?? null,
          },
          { targetOrigin: '*' },
        );
        return;
      }

      if (msg.type === 'EL_WRITE' && msg.tagId && onWriteTag) {
        const v = valuesByTag.get(msg.tagId);
        onWriteTag(msg.tagId, v?.name ?? msg.tagId, v?.dataType ?? 'float', {
          presetValue: msg.value as string | number | boolean,
        });
      }
    }

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [interactive, onWriteTag, valuesByTag, onAnchorsChange, onAnchorPicked, width, height]);

  return (
    <div
      className={`rt-html-page${className ? ` ${className}` : ''}`}
      style={{
        width,
        height,
        position: 'relative',
        overflow: 'hidden',
        background: '#0f172a',
        pointerEvents: interactive || anchorPickMode ? 'auto' : 'none',
      }}
    >
      <iframe
        ref={iframeRef}
        title="HTML Graphic Page"
        src={iframeSrc}
        srcDoc={srcdoc}
        sandbox="allow-scripts allow-same-origin allow-forms"
        onLoad={requestAnchors}
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          display: 'block',
          pointerEvents: interactive || anchorPickMode ? 'auto' : 'none',
        }}
      />
    </div>
  );
}
