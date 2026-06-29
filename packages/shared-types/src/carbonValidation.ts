import { resolveDeviceEnergyMapping } from './deviceEnergyMapping.js';
import type { CarbonDeviceInput, CarbonSummaryResult, CarbonTagInput } from './carbonCalculation.js';
import { inferTagEnergyRole, normalizeTagEnergyRole } from './tagEnergyMapping.js';

export type CarbonConfigIssue = {
  code:
    | 'no_main_meter'
    | 'using_fallback'
    | 'no_import_tag'
    | 'unmapped_kwh_tags'
    | 'meters_offline'
    | 'zero_kwh_reading';
  severity: 'error' | 'warning' | 'info';
  message: string;
  messageTh: string;
};

export type CarbonValidationInput = {
  devices: CarbonDeviceInput[];
  tags: CarbonTagInput[];
  strategy: CarbonSummaryResult['strategy'];
  kWhQualified: number;
  /** tagId → quality (good, bad, unknown) */
  tagQuality?: Record<string, string | null | undefined>;
};

function effectiveTagRole(tag: CarbonTagInput) {
  const explicit = normalizeTagEnergyRole(tag.energyTagRole);
  return explicit !== 'none' ? explicit : inferTagEnergyRole(tag.name, tag.unit);
}

export function validateCarbonConfig(input: CarbonValidationInput): CarbonConfigIssue[] {
  const issues: CarbonConfigIssue[] = [];
  const meters = input.devices.filter(d => {
    const mapping = resolveDeviceEnergyMapping(d);
    return mapping.role !== 'excluded' && mapping.role !== 'monitoring';
  });

  const hasMain = input.devices.some(d => {
    const m = resolveDeviceEnergyMapping(d);
    return m.role === 'site_main' && m.includeInCarbon;
  });

  if (!hasMain) {
    issues.push({
      code: 'no_main_meter',
      severity: 'warning',
      message: 'No site main meter is configured for carbon totals.',
      messageTh: 'ยังไม่ได้ตั้งมิเตอร์หลัก (Main meter) สำหรับคำนวณคาร์บอน',
    });
  }

  if (input.strategy === 'fallback_all_kwh') {
    issues.push({
      code: 'using_fallback',
      severity: 'info',
      message: 'Carbon is using fallback kWh tag matching until main meter and tag roles are set.',
      messageTh: 'ระบบใช้การเดา tag kWh ชั่วคราว — ควรตั้ง Main meter และบทบาท tag',
    });
  }

  const carbonDeviceIds = new Set(
    input.devices
      .filter(d => {
        const m = resolveDeviceEnergyMapping(d);
        if (hasMain) return m.role === 'site_main' && m.includeInCarbon;
        return m.includeInCarbon && m.role !== 'excluded' && m.role !== 'monitoring';
      })
      .map(d => d.id),
  );

  if (carbonDeviceIds.size === 0 && meters.length > 0) {
    carbonDeviceIds.add(meters[0]!.id);
  }

  const carbonTags = input.tags.filter(t => carbonDeviceIds.has(t.deviceId));
  const importTags = carbonTags.filter(t => {
    const role = effectiveTagRole(t);
    return role === 'import_kwh' || role === 'net_kwh';
  });

  if (importTags.length === 0) {
    issues.push({
      code: 'no_import_tag',
      severity: 'error',
      message: 'No import or net kWh tag is mapped on carbon meters.',
      messageTh: 'ยังไม่มี tag พลังงานนำเข้า (import_kwh) บนมิเตอร์ที่ใช้คำนวณคาร์บอน',
    });
  }

  const unmappedKwh = input.tags.filter(t => {
    if (normalizeTagEnergyRole(t.energyTagRole) !== 'none') return false;
    const unit = String(t.unit ?? '').toLowerCase();
    const name = String(t.name ?? '').toLowerCase();
    return unit === 'kwh' || name.includes('kwh') || name.includes('energy');
  });

  if (unmappedKwh.length > 0) {
    issues.push({
      code: 'unmapped_kwh_tags',
      severity: 'warning',
      message: `${unmappedKwh.length} kWh-like tag(s) still have role "none". Run backfill or set roles in Editor.`,
      messageTh: `มี tag ที่เป็น kWh ${unmappedKwh.length} ตัวยังไม่ได้กำหนดบทบาท — รัน backfill หรือตั้งใน Editor`,
    });
  }

  if (input.tagQuality && carbonTags.length > 0) {
    const energyTags = carbonTags.filter(t => {
      const role = effectiveTagRole(t);
      return role === 'import_kwh' || role === 'net_kwh' || role === 'export_kwh';
    });
    const allBad =
      energyTags.length > 0 &&
      energyTags.every(t => {
        const q = String(input.tagQuality?.[t.id] ?? 'unknown').toLowerCase();
        return q !== 'good';
      });
    if (allBad) {
      issues.push({
        code: 'meters_offline',
        severity: 'warning',
        message: 'Energy tags on carbon meters have no good live readings.',
        messageTh: 'มิเตอร์พลังงานออฟไลน์หรืออ่านค่าไม่ได้ — ตรวจสอบการสื่อสาร',
      });
    }
  }

  if (input.kWhQualified <= 0 && importTags.length > 0) {
    issues.push({
      code: 'zero_kwh_reading',
      severity: 'info',
      message: 'Carbon tags are configured but current kWh reading is zero.',
      messageTh: 'ตั้งค่า tag แล้ว แต่ค่า kWh ปัจจุบันเป็น 0',
    });
  }

  return issues;
}

/** Suggest primary import kWh tag name for a meter wizard. */
export function suggestPrimaryImportTagName(
  tags: Array<{ name: string; unit?: string | null }>,
): string {
  const ranked = tags
    .map(t => ({ name: t.name, role: inferTagEnergyRole(t.name, t.unit) }))
    .filter(t => t.role === 'import_kwh' || t.role === 'net_kwh');
  const preferred = ranked.find(t => /total.*active.*energy.*\+/i.test(t.name));
  if (preferred) return preferred.name;
  const net = ranked.find(t => t.role === 'net_kwh');
  if (net) return net.name;
  return ranked[0]?.name ?? '';
}
