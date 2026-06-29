/** Tag-level energy role for carbon / demand calculations. */
export type TagEnergyRole = 'import_kwh' | 'export_kwh' | 'net_kwh' | 'power_kw' | 'none';
export declare const TAG_ENERGY_ROLE_OPTIONS: Array<{
    value: TagEnergyRole;
    label: string;
    hint: string;
}>;
export declare function normalizeTagEnergyRole(value: unknown): TagEnergyRole;
/** Heuristic auto-map from tag name + unit (template import / legacy projects). */
export declare function inferTagEnergyRole(name: string, unit?: string | null): TagEnergyRole;
