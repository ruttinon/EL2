/** Device energy / carbon / web-viewer mapping (merged from senior editor, simplified). */
export const ENERGY_META_START = '[ENERGYLINK_WEBVIEW]';
export const ENERGY_META_END = '[/ENERGYLINK_WEBVIEW]';
export const ENERGY_ROLE_OPTIONS = [
    { value: 'site_main', label: 'Main meter (site total)', hint: 'Use for carbon total when one main incomer exists' },
    { value: 'sub_meter', label: 'Sub-meter (breakdown)', hint: 'HVAC, floor, tenant — not added to site carbon total' },
    { value: 'generation', label: 'On-site generation', hint: 'Solar, generator, battery export/import' },
    { value: 'monitoring', label: 'Monitoring only', hint: 'Quality, control, or display — excluded from carbon' },
    { value: 'excluded', label: 'Excluded', hint: 'Do not use in energy or carbon summaries' },
];
export const ENERGY_SOURCE_OPTIONS = [
    { value: '', label: '—' },
    { value: 'grid', label: 'Grid / utility' },
    { value: 'solar', label: 'Solar PV' },
    { value: 'generator', label: 'Generator' },
    { value: 'battery', label: 'Battery / ESS' },
    { value: 'other', label: 'Other' },
];
export const LOAD_CATEGORY_OPTIONS = [
    { value: '', label: 'Not specified' },
    { value: 'total_site', label: 'Total site' },
    { value: 'hvac', label: 'HVAC' },
    { value: 'lighting', label: 'Lighting' },
    { value: 'production', label: 'Production' },
    { value: 'office', label: 'Office / common' },
    { value: 'tenant', label: 'Tenant' },
    { value: 'it_load', label: 'IT load' },
    { value: 'custom', label: 'Custom' },
];
export const TOPOLOGY_NODE_OPTIONS = [
    { value: '', label: '—' },
    { value: 'source', label: 'Source' },
    { value: 'transformer', label: 'Transformer' },
    { value: 'panel', label: 'MDB / panel' },
    { value: 'feeder', label: 'Feeder' },
    { value: 'load_group', label: 'Load group' },
    { value: 'meter', label: 'Meter' },
    { value: 'virtual_meter', label: 'Virtual meter' },
];
export const CRITICAL_LEVEL_OPTIONS = [
    { value: 'normal', label: 'Normal' },
    { value: 'important', label: 'Important' },
    { value: 'critical', label: 'Critical' },
    { value: 'life_safety', label: 'Life safety' },
];
export function defaultIncludeInCarbon(role) {
    return role === 'site_main';
}
export function defaultDeviceEnergyMapping(deviceType) {
    if (deviceType === 'converter') {
        return {
            role: 'monitoring',
            source: '',
            loadCategory: '',
            includeInCarbon: false,
            viewerVisible: false,
        };
    }
    return {
        role: 'sub_meter',
        source: '',
        loadCategory: '',
        includeInCarbon: false,
        viewerVisible: true,
    };
}
function mapLegacyRole(energyRole) {
    switch (energyRole) {
        case 'main_meter':
            return 'site_main';
        case 'generation_meter':
        case 'export_import_meter':
        case 'source_meter':
            return 'generation';
        case 'power_quality_meter':
        case 'control_device':
        case 'monitoring_device':
            return 'monitoring';
        case 'excluded':
            return 'excluded';
        case 'feeder_meter':
        case 'load_meter':
        case 'sub_meter':
        default:
            return 'sub_meter';
    }
}
export function migrateLegacyMapping(legacy) {
    const role = mapLegacyRole(legacy.energyRole);
    const source = (legacy.sourceType ?? '');
    return {
        role,
        source: role === 'generation' ? source || 'grid' : source,
        loadCategory: legacy.loadCategory ?? '',
        includeInCarbon: typeof legacy.includeInSiteDemand === 'boolean'
            ? legacy.includeInSiteDemand
            : defaultIncludeInCarbon(role),
        viewerVisible: legacy.viewerVisible ?? true,
        advanced: {
            topologyNode: legacy.topologyNodeType || undefined,
            parentNode: legacy.parentNode || undefined,
            criticalLevel: legacy.criticalLevel || undefined,
        },
    };
}
export function parseLegacyBlockFromDescription(description) {
    const raw = String(description ?? '');
    const start = raw.indexOf(ENERGY_META_START);
    const end = raw.indexOf(ENERGY_META_END);
    if (start < 0 || end < 0 || end <= start) {
        return { plainDescription: raw.trim(), legacy: {} };
    }
    const plainDescription = `${raw.slice(0, start)}${raw.slice(end + ENERGY_META_END.length)}`.trim();
    const jsonText = raw.slice(start + ENERGY_META_START.length, end).trim();
    try {
        const parsed = JSON.parse(jsonText);
        return { plainDescription, legacy: parsed && typeof parsed === 'object' ? parsed : {} };
    }
    catch {
        return { plainDescription, legacy: {} };
    }
}
export function stripLegacyBlockFromDescription(description) {
    return parseLegacyBlockFromDescription(description).plainDescription;
}
export function parseEnergyMappingJson(raw) {
    if (!raw?.trim())
        return null;
    try {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || !parsed.role)
            return null;
        return normalizeDeviceEnergyMapping(parsed);
    }
    catch {
        return null;
    }
}
export function normalizeDeviceEnergyMapping(input, deviceType) {
    const base = defaultDeviceEnergyMapping(deviceType);
    const role = input?.role ?? base.role;
    return {
        role,
        source: input?.source ?? base.source,
        loadCategory: input?.loadCategory ?? base.loadCategory,
        includeInCarbon: typeof input?.includeInCarbon === 'boolean' ? input.includeInCarbon : defaultIncludeInCarbon(role),
        viewerVisible: typeof input?.viewerVisible === 'boolean' ? input.viewerVisible : base.viewerVisible,
        advanced: input?.advanced,
    };
}
export function resolveDeviceEnergyMapping(device) {
    const fromColumn = parseEnergyMappingJson(device.energyMappingJson);
    if (fromColumn)
        return fromColumn;
    const { legacy } = parseLegacyBlockFromDescription(device.description);
    if (legacy.energyRole || legacy.loadCategory || legacy.sourceType) {
        return migrateLegacyMapping(legacy);
    }
    return defaultDeviceEnergyMapping(device.type);
}
export function serializeDeviceEnergyMapping(mapping) {
    const normalized = normalizeDeviceEnergyMapping(mapping);
    const payload = {
        role: normalized.role,
        source: normalized.role === 'generation' ? normalized.source || 'grid' : normalized.source,
        loadCategory: normalized.loadCategory,
        includeInCarbon: normalized.includeInCarbon,
        viewerVisible: normalized.viewerVisible,
    };
    if (normalized.advanced && Object.values(normalized.advanced).some(Boolean)) {
        payload.advanced = normalized.advanced;
    }
    return JSON.stringify(payload);
}
export function optionLabel(options, value) {
    return options.find(o => o.value === value)?.label || value || '—';
}
export function energyRoleHint(role) {
    return ENERGY_ROLE_OPTIONS.find(o => o.value === role)?.hint ?? '';
}
