import type { GraphicAsset, GraphicAssetBundle, GraphicExportPackage, GraphicLayout } from '@energylink/shared-types';
import type { RawGraphicObject } from './types';

const URL_KEYS = ['glbUrl', 'lottieUrl', 'spriteUrl', 'imageDataUrl', 'splineUrl'] as const;

function collectUrlsFromObject(obj: RawGraphicObject, urls: Set<string>) {
  if (obj.imageDataUrl) urls.add(obj.imageDataUrl);
  const style = obj.style ?? {};
  for (const key of URL_KEYS) {
    const val = style[key];
    if (typeof val === 'string' && val.trim()) urls.add(val.trim());
  }
}

export function collectLayoutAssetUrls(layout: GraphicLayout | undefined): string[] {
  const urls = new Set<string>();
  if (layout?.backgroundImage) urls.add(layout.backgroundImage);
  for (const obj of layout?.objects ?? []) {
    collectUrlsFromObject(obj as RawGraphicObject, urls);
  }
  return [...urls];
}

export function buildAssetBundleFromLibrary(
  layout: GraphicLayout | undefined,
  library: GraphicAsset[],
): GraphicAssetBundle {
  const usedUrls = new Set(collectLayoutAssetUrls(layout));
  const assets = library.filter((a) => usedUrls.has(a.url));
  return { version: 1, assets };
}

export function mergeAssetBundleIntoPackage(
  pkg: GraphicExportPackage,
  bundle: GraphicAssetBundle,
): GraphicExportPackage {
  return {
    ...pkg,
    assets: bundle.assets.length > 0 ? bundle : undefined,
  };
}

/** Replace bundled asset URLs after import (match by asset id name fallback) */
export function applyAssetBundleToLayout(
  layout: GraphicLayout,
  bundle: GraphicAssetBundle | undefined,
): GraphicLayout {
  if (!bundle?.assets?.length) return layout;
  const byUrl = new Map(bundle.assets.map((a) => [a.url, a]));
  const urlRemap = new Map<string, string>();
  for (const asset of bundle.assets) {
    urlRemap.set(asset.url, asset.url);
  }

  function remapUrl(url: string | null | undefined): string | null | undefined {
    if (!url) return url;
    return urlRemap.get(url) ?? url;
  }

  const objects = (layout.objects ?? []).map((obj) => {
    const style = { ...(obj.style ?? {}) };
    for (const key of URL_KEYS) {
      const val = style[key];
      if (typeof val === 'string' && byUrl.has(val)) {
        style[key] = val;
      }
    }
    let imageDataUrl = obj.imageDataUrl;
    if (imageDataUrl && byUrl.has(imageDataUrl)) imageDataUrl = imageDataUrl;
    return { ...obj, imageDataUrl, style };
  });

  return {
    ...layout,
    backgroundImage: remapUrl(layout.backgroundImage ?? undefined) ?? layout.backgroundImage,
    objects,
  };
}
