import { getValueInspectorCaps } from './valueInspectorCaps';

/** Widget types with a dedicated design section — hide generic Appearance block. */
export function hidesGenericAppearance(type: string): boolean {
  if (type === 'clock') return true;
  if (type === 'image' || type === 'video') return true;
  if (type === 'trend' || type === 'echart') return true;
  if (getValueInspectorCaps(type)) return true;
  return false;
}

export type AppearanceLabels = {
  fill?: string;
  color?: string;
  stroke?: string;
  strokeWidth?: string;
  hint?: string;
};

export const APPEARANCE_LABELS: Partial<Record<string, AppearanceLabels>> = {
  gauge: {
    fill: 'พื้นหลัง',
    color: 'สีเข็ม / ตัวเลข',
    stroke: 'รางเกจ / ขอบ',
    strokeWidth: 'ความหนาขอบ',
  },
  progressbar: {
    fill: 'สีแถบ',
    stroke: 'ขอบ',
  },
  levelbar: {
    fill: 'สีแถบ',
    stroke: 'ขอบ',
  },
  button: {
    fill: 'สีปุ่ม',
    color: 'สีข้อความ',
    stroke: 'ขอบปุ่ม',
  },
  switch: {
    fill: 'สีพื้น (OFF)',
    stroke: 'ขอบ',
  },
  kpicard: {
    fill: 'พื้นการ์ด',
    color: 'สีตัวเลข',
  },
  multistate: {
    fill: 'พื้นหลัง',
    color: 'สีข้อความ',
    stroke: 'ขอบ',
  },
  statusbadge: {
    color: 'สีข้อความ (ถ้ามี)',
  },
  formulavalue: {
    fill: 'พื้นหลัง',
    color: 'สีผลลัพธ์',
  },
};

export function appearanceLabelsFor(type: string): AppearanceLabels {
  return APPEARANCE_LABELS[type] ?? {};
}
