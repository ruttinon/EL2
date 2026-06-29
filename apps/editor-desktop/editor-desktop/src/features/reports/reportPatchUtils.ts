import type { CSSProperties } from 'react';
import type { ReportObjectDefinition } from '@energylink/shared-types';

function syncTagFields(target: Partial<ReportObjectDefinition>) {
  if (target.tagId !== undefined) {
    target.sourceTagId = target.tagId || undefined;
  }
  if (target.sourceTagId !== undefined) {
    target.tagId = target.sourceTagId || undefined;
  }
  if (target.tagIds?.length) {
    const first = target.tagIds[0];
    target.tagId = first;
    target.sourceTagId = first;
  }
}

function normalizeStyle(
  object: ReportObjectDefinition,
  patchStyle: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!patchStyle) return undefined;
  const style = { ...(object.style ?? {}), ...patchStyle } as Record<string, unknown>;
  if (style.transparentBg === true) {
    style.background = 'transparent';
    style.fill = 'transparent';
    style.strokeWidth = 0;
    style.borderWidth = 0;
    style.stroke = 'transparent';
    style.borderColor = 'transparent';
  } else if (style.transparentBg === false && String(style.background ?? '').toLowerCase() === 'transparent') {
    style.background = '#ffffff';
    style.fill = '#ffffff';
  }
  if (typeof style.fill === 'string' && style.fill && !style.background) {
    style.background = style.fill;
  }
  if (typeof style.background === 'string' && style.background && !style.fill) {
    style.fill = style.background;
  }
  if (typeof style.stroke === 'string' && style.stroke && !style.borderColor) {
    style.borderColor = style.stroke;
  }
  if (typeof style.borderColor === 'string' && style.borderColor && !style.stroke) {
    style.stroke = style.borderColor;
  }
  const strokeWidth = style.strokeWidth ?? style.borderWidth;
  if (strokeWidth === 0 || strokeWidth === '0') {
    style.strokeWidth = 0;
    style.borderWidth = 0;
    if (!style.stroke || isTransparentColor(style.stroke)) style.stroke = 'transparent';
    if (!style.borderColor || isTransparentColor(style.borderColor)) style.borderColor = 'transparent';
  }
  return style;
}

/** Keep report preview bindings in sync with graphics editor fields. */
export function normalizeReportObjectPatch(
  object: ReportObjectDefinition,
  patch: Partial<ReportObjectDefinition>,
): Partial<ReportObjectDefinition> {
  const next: Partial<ReportObjectDefinition> = { ...patch };

  if (patch.tagIds !== undefined) {
    next.tagIds = patch.tagIds;
    next.binding = {
      ...(object.binding ?? {}),
      ...(patch.binding ?? {}),
      tagIds: patch.tagIds,
    };
  }

  if (patch.binding !== undefined) {
    next.binding = { ...(object.binding ?? {}), ...(patch.binding ?? {}), ...(next.binding ?? {}) };
    if (patch.binding.tagId !== undefined) {
      const tagId = patch.binding.tagId || undefined;
      next.tagId = tagId;
      next.sourceTagId = tagId;
    }
    if (patch.binding.deviceId !== undefined) {
      next.deviceId = patch.binding.deviceId || undefined;
    }
  }

  if (patch.props !== undefined) {
    next.props = { ...(object.props ?? {}), ...patch.props };
  }

  if (patch.formula !== undefined) {
    const formula = String(patch.formula);
    next.formula = formula;
    next.style = {
      ...(object.style ?? {}),
      ...(next.style as Record<string, unknown> | undefined),
      formula,
    };
  }

  if (patch.style !== undefined) {
    next.style = normalizeStyle(object, patch.style as Record<string, unknown>);
    const styleFormula = (next.style as Record<string, unknown> | undefined)?.formula;
    if (typeof styleFormula === 'string') {
      next.formula = styleFormula;
    }
  }

  syncTagFields(next);
  return next;
}

/** Default chrome for report field widgets (no box frame). */
export function reportChromelessFieldStyle(): Record<string, string | number | boolean> {
  return {
    transparentBg: true,
    background: 'transparent',
    fill: 'transparent',
    strokeWidth: 0,
    borderWidth: 0,
    stroke: 'transparent',
    borderColor: 'transparent',
  };
}

/** Apply a patch onto a report object with deep merge for nested fields. */
export function applyReportObjectPatch(
  object: ReportObjectDefinition,
  patch: Partial<ReportObjectDefinition>,
): ReportObjectDefinition {
  const normalized = normalizeReportObjectPatch(object, patch);
  return {
    ...object,
    ...normalized,
    formula: normalized.formula !== undefined ? normalized.formula : object.formula,
    style: normalized.style !== undefined ? normalized.style : object.style,
    binding: normalized.binding !== undefined ? normalized.binding : object.binding,
    props: normalized.props !== undefined ? normalized.props : object.props,
  };
}

export function resolveReportTagIds(object: ReportObjectDefinition): string[] {
  if (object.tagIds?.length) return object.tagIds.filter(Boolean) as string[];
  const single = object.tagId ?? object.sourceTagId ?? object.binding?.tagId;
  return single ? [String(single)] : [];
}

export function isTransparentColor(value: unknown): boolean {
  const raw = String(value ?? '').trim().toLowerCase();
  return !raw || raw === 'transparent' || raw === 'none';
}

export function pageBackgroundIsTransparent(color: string | undefined): boolean {
  return isTransparentColor(color);
}

/** Build mock tag values for report canvas preview. */
export function buildReportPreviewTagValues(
  object: ReportObjectDefinition,
  tags: Array<{ id: string; name: string; unit?: string | null; deviceId?: string }>,
): Map<string, { id: string; value: number; name: string; unit?: string | null }> {
  const mockValues = new Map<string, { id: string; value: number; name: string; unit?: string | null }>();
  for (const tagId of resolveReportTagIds(object)) {
    const tag = tags.find((t) => t.id === tagId);
    mockValues.set(tagId, { id: tagId, value: 1234.5, name: tag?.name || 'Tag', unit: tag?.unit });
  }
  const deviceId = object.deviceId ?? object.binding?.deviceId;
  if (deviceId) {
    const deviceTags = tags.filter((t) => t.deviceId === deviceId).slice(0, 12);
    deviceTags.forEach((tag, index) => {
      if (!mockValues.has(tag.id)) {
        mockValues.set(tag.id, { id: tag.id, value: 100 + index * 12.5, name: tag.name, unit: tag.unit });
      }
    });
  }
  return mockValues;
}

function styleNumber(style: Record<string, unknown>, key: string, fallback: number): number {
  const raw = style[key];
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : fallback;
}

/** Map report object style → canvas chrome (border, fill, typography). */
export function resolveReportObjectChromeStyle(object: ReportObjectDefinition): CSSProperties {
  const style = object.style ?? {};
  const transparent = style.transparentBg === true || isTransparentColor(style.background ?? style.fill);
  const strokeWidth = styleNumber(style as Record<string, unknown>, 'strokeWidth',
    styleNumber(style as Record<string, unknown>, 'borderWidth', 0));
  const borderColor = String(style.borderColor ?? style.stroke ?? '#94a3b8');
  const hasBorder = strokeWidth > 0 && !isTransparentColor(borderColor);

  let background: string;
  if (transparent) {
    background = 'transparent';
  } else if (object.type === 'line') {
    background = String(style.background ?? style.fill ?? style.stroke ?? '#0f172a');
  } else {
    background = String(style.background ?? style.fill ?? '#ffffff');
  }

  const padding = object.type === 'line' ? 0 : (object.type === 'rectangle' || object.type === 'shape' ? 0 : 8);

  return {
    color: typeof style.color === 'string' ? style.color : '#0f172a',
    background,
    fontSize: typeof style.fontSize === 'number' ? style.fontSize : 14,
    fontFamily: typeof style.fontFamily === 'string' ? style.fontFamily : undefined,
    fontWeight: typeof style.fontWeight === 'string' || typeof style.fontWeight === 'number' ? style.fontWeight : undefined,
    textAlign: (typeof style.align === 'string' ? style.align : 'left') as CSSProperties['textAlign'],
    opacity: typeof style.opacity === 'number' ? style.opacity : undefined,
    borderRadius: typeof style.borderRadius === 'number' ? style.borderRadius : (object.type === 'rectangle' ? 0 : 6),
    padding,
    border: hasBorder ? `${strokeWidth}px solid ${borderColor}` : 'none',
    boxSizing: 'border-box',
  };
}

/** Inline CSS for HTML export / preview windows. */
export function reportObjectStyleToCss(object: ReportObjectDefinition): string {
  const chrome = resolveReportObjectChromeStyle(object);
  const parts = [
    `left:${object.x}px`,
    `top:${object.y}px`,
    `width:${object.width}px`,
    `min-height:${object.height}px`,
    `color:${chrome.color ?? '#0f172a'}`,
    `background:${chrome.background ?? 'transparent'}`,
    `font-size:${chrome.fontSize ?? 14}px`,
    `text-align:${chrome.textAlign ?? 'left'}`,
    `border:${chrome.border ?? 'none'}`,
    `border-radius:${chrome.borderRadius ?? 0}px`,
    `padding:${chrome.padding ?? 0}px`,
    `box-sizing:border-box`,
    `overflow:hidden`,
  ];
  if (chrome.opacity != null) parts.push(`opacity:${chrome.opacity}`);
  if (chrome.fontFamily) parts.push(`font-family:${chrome.fontFamily}`);
  return parts.join(';');
}
