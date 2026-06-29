/** Parametric scene script v1 — สร้าง layout + GLB จาก spec (ไม่ใช้ AI) */

export const SCENE_SCRIPT_VERSION = 1 as const;

export type SceneScriptEquipmentKind =
  | 'mcc'
  | 'panel'
  | 'meter'
  | 'breaker'
  | 'transformer'
  | 'motor'
  | 'bus'
  | 'wall';

export type SceneScriptEquipment = {
  /** อ้างอิงใน wires: "mcc1.out" → id + port */
  id: string;
  kind: SceneScriptEquipmentKind;
  name?: string;
  /** mm จากมุมซ้ายบนห้อง */
  xMm: number;
  yMm: number;
  widthMm?: number;
  heightMm?: number;
  depthMm?: number;
  /** elecsymbol symbolId */
  symbolId?: string;
  /** สร้าง GLB จากสคริป (mcc/panel) — default true */
  generateGlb?: boolean;
  color?: string;
  /** จำนวนแถว breaker บนหน้าตู้ (visual ใน GLB) */
  breakerRows?: number;
  breakerCols?: number;
  tagName?: string;
  navigateTo?: string;
};

export type SceneScriptWire = {
  from: string;
  to: string;
  /** default out → in */
  fromPort?: string;
  toPort?: string;
};

export type SceneScriptV1 = {
  version: typeof SCENE_SCRIPT_VERSION;
  name?: string;
  mmPerPx?: number;
  room?: {
    widthMm: number;
    depthMm: number;
    label?: string;
    floorColor?: string;
    /** สร้างกำแพง 4 ด้านอัตโนมัติ — default true เมื่อมี room */
    walls?: boolean;
    wallThicknessMm?: number;
    wallHeight3d?: number;
  };
  equipment: SceneScriptEquipment[];
  wires?: SceneScriptWire[];
};

export type SceneScriptParseResult =
  | { ok: true; script: SceneScriptV1 }
  | { ok: false; error: string };

export function parseSceneScript(raw: unknown): SceneScriptParseResult {
  try {
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!data || typeof data !== 'object') return { ok: false, error: 'JSON ว่างเปล่า' };
    const version = Number((data as SceneScriptV1).version);
    if (version !== 1) return { ok: false, error: 'รองรับเฉพาะ version: 1' };
    const equipment = (data as SceneScriptV1).equipment;
    if (!Array.isArray(equipment) || equipment.length === 0) {
      return { ok: false, error: 'ต้องมี equipment อย่างน้อย 1 รายการ' };
    }
    for (const eq of equipment) {
      if (!eq.id || !eq.kind) return { ok: false, error: 'equipment ต้องมี id และ kind' };
      if (!Number.isFinite(eq.xMm) || !Number.isFinite(eq.yMm)) {
        return { ok: false, error: `equipment "${eq.id}" ต้องมี xMm, yMm` };
      }
    }
    return { ok: true, script: data as SceneScriptV1 };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'JSON ไม่ถูกต้อง' };
  }
}
