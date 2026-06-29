import type React from 'react';
import type { CurrentTagValue, NormalizedGraphicObject } from './types';

function numOrNull(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Pick status image URL from tag value and configured online/offline/fault images. */
export function resolveStatusImageUrl(
  obj: NormalizedGraphicObject,
  valuesByTag?: Map<string, CurrentTagValue>,
): string | undefined {
  if (obj.style?.statusEnabled !== true || !valuesByTag) return undefined;
  const tagId = String(obj.style?.statusTagId ?? obj.tagId ?? '');
  if (!tagId) return undefined;
  const val = numOrNull(valuesByTag.get(tagId)?.value);
  const online = String(obj.style?.statusImageOnline ?? '');
  const offline = String(obj.style?.statusImageOffline ?? '');
  const fault = String(obj.style?.statusImageFault ?? '');
  if (val === null) return offline || undefined;
  if (val >= 2 && fault) return fault;
  if (val === 1 || val > 0) return online || undefined;
  return offline || undefined;
}

export function resolveOverlayTagValue(
  obj: NormalizedGraphicObject,
  primary?: CurrentTagValue,
  valuesByTag?: Map<string, CurrentTagValue>,
): CurrentTagValue | undefined {
  if (obj.style?.showValueOverlay !== true) return undefined;
  const tagId = String(obj.style?.valueOverlayTagId ?? obj.tagId ?? '');
  if (!tagId) return primary;
  return valuesByTag?.get(tagId) ?? primary;
}

export function formatOverlayValue(
  obj: NormalizedGraphicObject,
  tagVal?: CurrentTagValue,
): string {
  if (!tagVal || tagVal.value == null) return '--';
  const dp = typeof obj.style?.decimalPlaces === 'number' ? obj.style.decimalPlaces : 2;
  const n = Number(tagVal.value);
  if (!Number.isFinite(n)) return String(tagVal.value);
  const unit = tagVal.unit ?? (obj.style?.unit as string | undefined) ?? '';
  return `${n.toFixed(dp)}${unit ? ` ${unit}` : ''}`;
}

type EquipmentChromeProps = {
  obj: NormalizedGraphicObject;
  valuesByTag?: Map<string, CurrentTagValue>;
  primaryValue?: CurrentTagValue;
};

/** Status badge + value overlay for equipment image / 3D viewports. */
export function EquipmentChrome({ obj, valuesByTag, primaryValue }: EquipmentChromeProps) {
  const showStatus = obj.style?.statusEnabled === true;
  const showValue = obj.style?.showValueOverlay === true;
  if (!showStatus && !showValue) return null;

  const tagVal = resolveOverlayTagValue(obj, primaryValue, valuesByTag);
  const statusTagId = String(obj.style?.statusTagId ?? obj.tagId ?? '');
  const statusVal = statusTagId && valuesByTag ? valuesByTag.get(statusTagId) : undefined;
  const statusNum = numOrNull(statusVal?.value);
  const pos = obj.style?.valueOverlayPosition === 'top' ? 'top' : 'bottom';

  let badgeLabel = '';
  let badgeColor = '#94a3b8';
  if (showStatus) {
    if (statusNum === null) {
      badgeLabel = 'N/A';
      badgeColor = '#94a3b8';
    } else if (statusNum >= 2) {
      badgeLabel = 'FAULT';
      badgeColor = '#ef4444';
    } else if (statusNum === 1 || statusNum > 0) {
      badgeLabel = 'ON';
      badgeColor = '#22c55e';
    } else {
      badgeLabel = 'OFF';
      badgeColor = '#64748b';
    }
  }

  return (
    <>
      {showStatus ? (
        <span
          className="rt-equipment-status"
          style={{ background: badgeColor }}
          title={statusVal?.name ?? statusTagId}
        >
          {badgeLabel}
        </span>
      ) : null}
      {showValue ? (
        <span className={`rt-equipment-value rt-equipment-value-${pos}`}>
          {formatOverlayValue(obj, tagVal)}
        </span>
      ) : null}
    </>
  );
}

export function withEquipmentPosition(style: React.CSSProperties): React.CSSProperties {
  return { ...style, position: 'relative', overflow: 'visible' };
}
