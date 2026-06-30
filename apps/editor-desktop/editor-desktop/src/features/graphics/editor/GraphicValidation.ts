import type { GraphicObjectDefinition, GraphicSummary } from '@energylink/shared-types';

export type ValidationIssue = {
  id: string;
  objectId?: string;
  objectName?: string;
  severity: 'warning' | 'error';
  category: 'layout' | 'binding' | 'command' | 'navigation';
  message: string;
  suggestion: string;
};

export function validateGraphic(
  objects: GraphicObjectDefinition[],
  width: number,
  height: number,
  graphics: GraphicSummary[]
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const graphicIds = new Set(graphics.map((g) => g.id));

  objects.forEach((obj) => {
    const name = obj.name || `${obj.type} [${obj.id.slice(0, 6)}]`;

    // 1. Boundary check
    if (obj.x < 0 || obj.y < 0 || obj.x + obj.width > width || obj.y + obj.height > height) {
      issues.push({
        id: `outside-${obj.id}`,
        objectId: obj.id,
        objectName: name,
        severity: 'warning',
        category: 'layout',
        message: `วัตถุอยู่นอกขอบเขต Canvas`,
        suggestion: `ย้ายตำแหน่งให้อยู่ในช่วง 0-${width} (กว้าง) และ 0-${height} (สูง)`,
      });
    }

    // 2. Unbound tags check
    const requiresBinding = ['value', 'gauge', 'kpicard', 'trend', 'alarmtable', 'elecsymbol', 'switch'].includes(obj.type);
    if (requiresBinding) {
      const binding = obj.binding;
      const deviceId = obj.deviceId ?? binding?.deviceId;
      const tagId = obj.tagId ?? binding?.tagId;

      if (!deviceId || !tagId) {
        issues.push({
          id: `unbound-${obj.id}`,
          objectId: obj.id,
          objectName: name,
          severity: 'error',
          category: 'binding',
          message: `ยังไม่ได้ผูกข้อมูล Device / Tag`,
          suggestion: `เปิดตัวช่วยผูก (Binding Wizard) เพื่อเลือก Meter และ Register`,
        });
      }
    }

    // 3. Command Safety Check (Write tags)
    const isCommandWidget = obj.type === 'button' || obj.type === 'switch';
    if (isCommandWidget) {
      const writeEnabled = obj.style?.action === 'write' || obj.type === 'switch';
      if (writeEnabled) {
        const confirmWrite = obj.style?.confirmWrite ?? false;
        if (!confirmWrite) {
          issues.push({
            id: `unsafe-command-${obj.id}`,
            objectId: obj.id,
            objectName: name,
            severity: 'warning',
            category: 'command',
            message: `ปุ่มสั่งการไม่มีระบบกดยืนยัน (Interlock Confirmation)`,
            suggestion: `ติ๊กเลือก 'ต้องกดยืนยันก่อนสั่งงาน' ในช่อง Inspector เพื่อความปลอดภัยของเครื่องจักร`,
          });
        }
      }
    }

    // 4. Invalid Navigation check
    const isNavigation = obj.style?.action === 'navigate' || obj.type === 'hotspot' || obj.type === 'tabbar';
    if (isNavigation) {
      const target = obj.navigateTo || obj.style?.navigateTo;
      if (target && !graphicIds.has(String(target))) {
        issues.push({
          id: `invalid-nav-${obj.id}`,
          objectId: obj.id,
          objectName: name,
          severity: 'error',
          category: 'navigation',
          message: `เป้าหมายปุ่มนำทาง (Page ID) ไม่มีอยู่จริงในโปรเจกต์`,
          suggestion: `ตรวจสอบเป้าหมายของปุ่ม หรือเลือกหน้าจอปลายทางใหม่`,
        });
      }
    }
  });

  // 5. Overlap detection (Significant overlaps)
  for (let i = 0; i < objects.length; i++) {
    for (let j = i + 1; j < objects.length; j++) {
      const a = objects[i];
      const b = objects[j];

      if (a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height) {
        issues.push({
          id: `overlap-${a.id}-${b.id}`,
          objectId: a.id,
          objectName: a.name || a.type,
          severity: 'warning',
          category: 'layout',
          message: `พบวัตถุทับซ้อนกันแบบสมบูรณ์กับ ${b.name || b.type}`,
          suggestion: `ย้ายตำแหน่งหรือจัดกลุ่มวัตถุให้อยู่คนละเลเยอร์เพื่อไม่ให้บังกัน`,
        });
      }
    }
  }

  return issues;
}
