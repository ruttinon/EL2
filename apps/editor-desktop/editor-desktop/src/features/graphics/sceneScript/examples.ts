import type { SceneScriptV1 } from './types';

/** ห้อง MCC — กำแพง 4 ด้านสร้างอัตโนมัติจาก room + ตู้ GLB + bus + meter */
export const MCC_ROOM_EXAMPLE: SceneScriptV1 = {
  version: 1,
  name: 'MCC Room Example',
  mmPerPx: 10,
  room: {
    widthMm: 6000,
    depthMm: 4000,
    label: 'ห้อง MCC',
    floorColor: '#e2e8f0',
    walls: true,
    wallThicknessMm: 200,
    wallHeight3d: 80,
  },
  equipment: [
    {
      id: 'bus_main',
      kind: 'bus',
      name: 'Main Bus',
      xMm: 400,
      yMm: 400,
      widthMm: 5200,
      heightMm: 40,
    },
    {
      id: 'mcc1',
      kind: 'mcc',
      name: 'MCC-1',
      xMm: 600,
      yMm: 800,
      widthMm: 800,
      heightMm: 2000,
      depthMm: 600,
      color: '#475569',
      breakerRows: 8,
      breakerCols: 1,
      generateGlb: true,
    },
    {
      id: 'mcc2',
      kind: 'mcc',
      name: 'MCC-2',
      xMm: 1600,
      yMm: 800,
      widthMm: 800,
      heightMm: 2000,
      depthMm: 600,
      color: '#64748b',
      breakerRows: 8,
      generateGlb: true,
    },
    {
      id: 'xfmr1',
      kind: 'transformer',
      name: 'TR-01',
      xMm: 2800,
      yMm: 1200,
      widthMm: 500,
      heightMm: 600,
    },
    {
      id: 'meter1',
      kind: 'meter',
      name: 'Main Meter',
      xMm: 3600,
      yMm: 900,
      tagName: 'MAIN_KWH',
    },
  ],
  wires: [
    { from: 'bus_main.out', to: 'mcc1.in' },
    { from: 'mcc1.out', to: 'meter1.in' },
    { from: 'bus_main.tap2', to: 'mcc2.in' },
  ],
};

/** ห้อง Panel — ตู้ distribution 2 ลูก */
export const PANEL_ROOM_EXAMPLE: SceneScriptV1 = {
  version: 1,
  name: 'Panel Room',
  mmPerPx: 10,
  room: {
    widthMm: 4000,
    depthMm: 3000,
    label: 'ห้อง MDB',
    floorColor: '#f1f5f9',
    walls: true,
    wallThicknessMm: 200,
  },
  equipment: [
    {
      id: 'mdb1',
      kind: 'panel',
      name: 'MDB-1',
      xMm: 500,
      yMm: 600,
      widthMm: 600,
      heightMm: 1800,
      depthMm: 400,
      color: '#334155',
      breakerRows: 6,
      breakerCols: 2,
    },
    {
      id: 'mdb2',
      kind: 'panel',
      name: 'MDB-2',
      xMm: 1400,
      yMm: 600,
      widthMm: 600,
      heightMm: 1800,
      depthMm: 400,
      color: '#475569',
      breakerRows: 6,
      breakerCols: 2,
    },
    {
      id: 'meter_in',
      kind: 'meter',
      name: 'Incomer Meter',
      xMm: 2500,
      yMm: 500,
      tagName: 'INCOMER_KWH',
    },
    {
      id: 'brk_main',
      kind: 'breaker',
      name: 'Main CB',
      xMm: 2500,
      yMm: 900,
    },
  ],
  wires: [
    { from: 'brk_main.out', to: 'mdb1.in' },
    { from: 'brk_main.out', to: 'mdb2.in' },
  ],
};

export const SCENE_SCRIPT_EXAMPLES: Array<{ id: string; label: string; script: SceneScriptV1 }> = [
  { id: 'mcc-room', label: 'ห้อง MCC (ตู้ + bus + meter)', script: MCC_ROOM_EXAMPLE },
  { id: 'panel-room', label: 'ห้อง MDB (ตู้ panel 2 ลูก)', script: PANEL_ROOM_EXAMPLE },
];

export function exampleScriptJson(id: string): string {
  const ex = SCENE_SCRIPT_EXAMPLES.find((e) => e.id === id);
  return JSON.stringify(ex?.script ?? MCC_ROOM_EXAMPLE, null, 2);
}
