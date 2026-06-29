/**
 * Utility functions extracted from ElementQuickPanel to avoid
 * Vite Fast Refresh "inconsistent component exports" warning.
 * A .tsx file should only export React components, not plain functions.
 */
import { DEFAULT_BUS_PORTS, DEFAULT_ELEC_PORTS } from '@energylink/shared-types';
import { defaultPortsForType } from '@energylink/graphics-runtime';

export function objectNeedsPorts(type: string): boolean {
  return ['elecsymbol', 'image', 'viewport3d', 'scene3d'].includes(type);
}

export function defaultPortsHint(type: string): string {
  if (type === 'elecsymbol') return 'T, B, L, R';
  if (type === 'image' || type === 'viewport3d' || type === 'scene3d') return 'T, B, L, R, C';
  return '';
}

export function toolHintFor(activeTool: string): string {
  if (activeTool === 'select') return 'คลิกเลือก / ลากกรอบคลุม';
  if (activeTool === 'wire') return 'Wire: คลิก port ฟ้า (Out) → port ส้ม (In)';
  if (activeTool === 'cable3d') return 'Cable 3D: คลิก port ต้นทาง → port ปลายทาง';
  if (activeTool === 'wall') return 'Wall: คลิกจุดเริ่ม → จุดจบ (ต่อเนื่องได้, Escape ยกเลิก)';
  if (activeTool === 'room') return 'Room: คลิกมุม 3+ จุด — คลิกใกล้จุดแรกหรือ Enter เพื่อปิด (Escape ยกเลิก)';
  if (activeTool === 'measure') return 'Measure: คลิก 2 จุดเพื่อวัดระยะ px (Escape ยกเลิก)';
  if (activeTool === 'door') return 'Door: คลิกบนผนังเพื่อวางประตู (snap อัตโนมัติ)';
  if (activeTool === 'window') return 'Window: คลิกบนผนังเพื่อวางหน้าต่าง (snap อัตโนมัติ)';
  if (activeTool === 'pan') return 'ลากเพื่อเลื่อนจอ (Click and drag to pan)';
  if (activeTool === 'text') return 'คลิกพื้นที่ว่างเพื่อวางตัวอักษร';
  return 'คลิกบน canvas เพื่อวางวัตถุ';
}

export function toolHintFor3d(activeTool: string): string {
  if (activeTool === 'zone3d') return '3D: คลิกพื้น floor เพื่อวาง Room Zone';
  if (activeTool === 'wall') return 'Wall: คลิกจุดเริ่ม → จุดจบ (ผนังยกขึ้น 3D ทันที) · Select/Pan เพื่อหมุนมุมมอง';
  if (activeTool === 'door') return '3D: คลิกบนผนัง (ghost plan) เพื่อวางประตู';
  if (activeTool === 'window') return '3D: คลิกบนผนัง (ghost plan) เพื่อวางหน้าต่าง';
  if (activeTool === 'cable3d' || activeTool === 'wire') return '3D: สายและ pipe แสดงเป็นท่อ WebGL — Select/Pan แล้วลากหมุนมุม';
  if (activeTool === 'pan') return '3D: ลากบน canvas เพื่อหมุนมุมมอง · scroll ซูม';
  if (activeTool === 'select') return '3D: ลากหมุนมุมมอง · scroll ซูม · เลือก HUD widget ได้';
  return '3D: ลากหมุนมุมมอง · scroll ซูม';
}
