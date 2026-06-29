export type RoomPrefabPoint = { x: number; y: number };

export type RoomPrefabDef = {
  id: string;
  label: string;
  sub: string;
  icon: string;
  color: string;
  zoneLabel: string;
  width: number;
  height: number;
  floorFill?: string;
};

export const ROOM_PREFABS: RoomPrefabDef[] = [
  {
    id: 'office',
    label: 'Office',
    sub: '400×300',
    icon: 'solar:case-round-bold-duotone',
    color: '#94a3b8',
    zoneLabel: 'Office',
    width: 400,
    height: 300,
  },
  {
    id: 'mcc-room',
    label: 'MCC Room',
    sub: '500×400',
    icon: 'solar:server-square-bold-duotone',
    color: '#0ea5e9',
    zoneLabel: 'MCC',
    width: 500,
    height: 400,
    floorFill: '#cbd5e1',
  },
  {
    id: 'lab',
    label: 'Lab',
    sub: '360×280',
    icon: 'solar:test-tube-bold-duotone',
    color: '#8b5cf6',
    zoneLabel: 'Lab',
    width: 360,
    height: 280,
    floorFill: '#e2e8f0',
  },
  {
    id: 'warehouse',
    label: 'Warehouse',
    sub: '600×400',
    icon: 'solar:box-minimalistic-bold-duotone',
    color: '#64748b',
    zoneLabel: 'Warehouse',
    width: 600,
    height: 400,
    floorFill: '#d1d5db',
  },
];

export function roomPrefabCorners(originX: number, originY: number, width: number, height: number): RoomPrefabPoint[] {
  return [
    { x: originX, y: originY },
    { x: originX + width, y: originY },
    { x: originX + width, y: originY + height },
    { x: originX, y: originY + height },
  ];
}

export function findRoomPrefab(id: string): RoomPrefabDef | undefined {
  return ROOM_PREFABS.find((p) => p.id === id);
}
