import type { GraphicExportPackage, GraphicLayout, GraphicSummary } from '@energylink/shared-types';
import { GRAPHIC_LAYOUT_VERSION, GRAPHIC_PACKAGE_VERSION } from '@energylink/shared-types';
import { normalizeLayoutForSave } from './normalize';
import type { RawGraphicObject } from './types';
import type { GraphicAssetBundle } from '@energylink/shared-types';

export type GraphicImportResult =
  | { ok: true; package: GraphicExportPackage; warnings: string[] }
  | { ok: false; errors: string[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateLayout(layout: unknown): { layout: GraphicLayout | null; errors: string[] } {
  const errors: string[] = [];
  if (!isRecord(layout)) return { layout: null, errors: ['layout must be an object'] };
  if (layout.version !== GRAPHIC_LAYOUT_VERSION) errors.push(`layout.version must be ${GRAPHIC_LAYOUT_VERSION}`);
  if (!Array.isArray(layout.objects)) errors.push('layout.objects must be an array');
  if (errors.length) return { layout: null, errors };
  return {
    layout: {
      version: GRAPHIC_LAYOUT_VERSION,
      backgroundColor: typeof layout.backgroundColor === 'string' ? layout.backgroundColor : '#fbfdff',
      backgroundImage: typeof layout.backgroundImage === 'string' ? layout.backgroundImage : layout.backgroundImage === null ? null : undefined,
      objects: layout.objects as GraphicLayout['objects'],
    },
    errors: [],
  };
}

export function buildGraphicExportPackage(
  graphic: GraphicSummary,
  source?: GraphicExportPackage['source'],
  assets?: GraphicAssetBundle,
): GraphicExportPackage {
  const objects = normalizeLayoutForSave((graphic.layout?.objects ?? []) as RawGraphicObject[]);
  return {
    packageVersion: GRAPHIC_PACKAGE_VERSION,
    exportedAt: new Date().toISOString(),
    source: source ?? { projectId: graphic.projectId, graphicId: graphic.id, graphicName: graphic.name },
    assets: assets && assets.assets.length > 0 ? assets : undefined,
    graphic: {
      name: graphic.name,
      description: graphic.description ?? null,
      width: graphic.width,
      height: graphic.height,
      refreshIntervalMs: graphic.refreshIntervalMs,
      layout: {
        version: GRAPHIC_LAYOUT_VERSION,
        backgroundColor: graphic.layout?.backgroundColor ?? '#fbfdff',
        backgroundImage: graphic.layout?.backgroundImage ?? null,
        sceneScaleMmPerPx: graphic.layout?.sceneScaleMmPerPx,
        objects: objects as GraphicLayout['objects'],
      },
    },
  };
}

export function parseGraphicImportPackage(raw: unknown): GraphicImportResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!isRecord(raw)) return { ok: false, errors: ['File must be a JSON object'] };

  const pkgVersion = raw.packageVersion ?? raw.version;
  if (pkgVersion !== GRAPHIC_PACKAGE_VERSION) {
    warnings.push(`packageVersion ${String(pkgVersion)} — expected ${GRAPHIC_PACKAGE_VERSION}; attempting import anyway`);
  }

  let graphicPayload: Record<string, unknown> | null = null;
  if (isRecord(raw.graphic)) {
    graphicPayload = raw.graphic;
  } else if (raw.layout && typeof raw.name === 'string') {
    graphicPayload = raw;
    warnings.push('Legacy flat graphic JSON detected');
  } else {
    return { ok: false, errors: ['Missing graphic payload (graphic or legacy layout)'] };
  }

  const name = typeof graphicPayload.name === 'string' ? graphicPayload.name.trim() : '';
  if (!name) errors.push('graphic.name is required');

  const width = Number(graphicPayload.width);
  const height = Number(graphicPayload.height);
  if (!Number.isFinite(width) || width < 320) errors.push('graphic.width must be >= 320');
  if (!Number.isFinite(height) || height < 240) errors.push('graphic.height must be >= 240');

  const refreshIntervalMs = Number(graphicPayload.refreshIntervalMs ?? 1000);
  if (!Number.isFinite(refreshIntervalMs) || refreshIntervalMs < 250) errors.push('graphic.refreshIntervalMs must be >= 250');

  const { layout, errors: layoutErrors } = validateLayout(graphicPayload.layout);
  errors.push(...layoutErrors);
  if (errors.length || !layout) return { ok: false, errors };

  const pkg: GraphicExportPackage = {
    packageVersion: GRAPHIC_PACKAGE_VERSION,
    exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : new Date().toISOString(),
    source: isRecord(raw.source)
      ? {
          projectId: typeof raw.source.projectId === 'string' ? raw.source.projectId : undefined,
          graphicId: typeof raw.source.graphicId === 'string' ? raw.source.graphicId : undefined,
          graphicName: typeof raw.source.graphicName === 'string' ? raw.source.graphicName : undefined,
        }
      : undefined,
    assets: isRecord(raw.assets) && Array.isArray(raw.assets.assets)
      ? { version: 1, assets: raw.assets.assets as GraphicAssetBundle['assets'] }
      : undefined,
    graphic: {
      name,
      description: typeof graphicPayload.description === 'string' ? graphicPayload.description : null,
      width,
      height,
      refreshIntervalMs,
      layout,
    },
  };

  return { ok: true, package: pkg, warnings };
}

export function graphicPackageToCreateInput(pkg: GraphicExportPackage, overrides?: { name?: string; projectId?: string }) {
  return {
    projectId: overrides?.projectId,
    name: overrides?.name?.trim() || pkg.graphic.name,
    description: pkg.graphic.description,
    width: pkg.graphic.width,
    height: pkg.graphic.height,
    refreshIntervalMs: pkg.graphic.refreshIntervalMs,
    layout: pkg.graphic.layout,
  };
}

export function applyGraphicPackageToSummary(graphic: GraphicSummary, pkg: GraphicExportPackage): GraphicSummary {
  return {
    ...graphic,
    name: pkg.graphic.name,
    description: pkg.graphic.description ?? graphic.description,
    width: pkg.graphic.width,
    height: pkg.graphic.height,
    refreshIntervalMs: pkg.graphic.refreshIntervalMs,
    layout: pkg.graphic.layout,
  };
}
