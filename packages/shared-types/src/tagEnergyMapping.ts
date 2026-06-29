/** Tag-level energy role for carbon / demand calculations. */

export type TagEnergyRole = 'import_kwh' | 'export_kwh' | 'net_kwh' | 'power_kw' | 'none';

export const TAG_ENERGY_ROLE_OPTIONS: Array<{
  value: TagEnergyRole;
  label: string;
  hint: string;
}> = [
  {
    value: 'import_kwh',
    label: 'Import (kWh)',
    hint: 'Grid consumption — used for carbon total',
  },
  {
    value: 'export_kwh',
    label: 'Export (kWh)',
    hint: 'Solar / battery export — subtracted when net metering is on',
  },
  {
    value: 'net_kwh',
    label: 'Net (kWh)',
    hint: 'Pre-calculated net meter reading',
  },
  {
    value: 'power_kw',
    label: 'Power (kW)',
    hint: 'Instantaneous power — not used for carbon kWh',
  },
  {
    value: 'none',
    label: 'Ignore',
    hint: 'Quality, status, or display tags',
  },
];

const VALID_ROLES = new Set<TagEnergyRole>(TAG_ENERGY_ROLE_OPTIONS.map(o => o.value));

export function normalizeTagEnergyRole(value: unknown): TagEnergyRole {
  const role = typeof value === 'string' ? value.trim() : '';
  return VALID_ROLES.has(role as TagEnergyRole) ? (role as TagEnergyRole) : 'none';
}

/** Heuristic auto-map from tag name + unit (template import / legacy projects). */
export function inferTagEnergyRole(name: string, unit?: string | null): TagEnergyRole {
  const n = String(name ?? '').toLowerCase();
  const u = String(unit ?? '').toLowerCase();

  if (u === 'kw' && !u.includes('h') && !n.includes('kwh')) {
    return 'power_kw';
  }
  if (n.includes('export') || n.includes('feed_in') || n.includes('feedin') || n.includes('sell')) {
    return 'export_kwh';
  }
  // CVM / IEC meters: "Active Energy +" = import, "Active Energy -" = export
  if (/\benergy\s*[-−]\s*$/.test(n) || n.includes('energy -')) {
    return 'export_kwh';
  }
  if (/\benergy\s*\+\s*$/.test(n) || n.includes('energy +')) {
    return 'import_kwh';
  }
  if (n.includes('net') && (u === 'kwh' || n.includes('kwh') || n.includes('energy'))) {
    return 'net_kwh';
  }
  if (
    n.includes('import') ||
    n.includes('consumption') ||
    n.includes('energy_imp') ||
    n.includes('active_energy')
  ) {
    return 'import_kwh';
  }
  if (u === 'kwh' || n.includes('kwh') || n.includes('energy') || n.includes('wh_imp')) {
    return 'import_kwh';
  }
  if (n.includes('power') || n.includes('_kw') || n.endsWith('kw')) {
    return 'power_kw';
  }
  return 'none';
}
