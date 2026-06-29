/** Shared short Thai labels for report designer UI */
export const REPORT_PERIOD_OPTIONS = [
  { value: '', label: 'ตามรายงาน' },
  { value: 'daily', label: 'รายวัน' },
  { value: 'weekly', label: 'รายสัปดาห์' },
  { value: 'monthly', label: 'รายเดือน' },
  { value: 'yearly', label: 'รายปี' },
] as const;

export const REPORT_RANGE_OPTIONS = [
  { value: 'today', label: 'วันนี้' },
  { value: 'this_week', label: 'สัปดาห์นี้' },
  { value: 'this_month', label: 'เดือนนี้' },
  { value: 'last_month', label: 'เดือนที่แล้ว' },
  { value: 'this_year', label: 'ปีนี้' },
  { value: 'last_year', label: 'ปีที่แล้ว' },
  { value: 'custom', label: 'กำหนดเอง' },
] as const;

export const FIELD_METRIC_OPTIONS = [
  { value: 'live', label: 'ปัจจุบัน' },
  { value: 'last', label: 'ล่าสุด' },
  { value: 'first', label: 'เริ่มต้น' },
  { value: 'usage', label: 'ใช้ไป' },
] as const;
