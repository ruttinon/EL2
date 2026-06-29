/** Device energy / carbon / web-viewer mapping (merged from senior editor, simplified). */
export declare const ENERGY_META_START = "[ENERGYLINK_WEBVIEW]";
export declare const ENERGY_META_END = "[/ENERGYLINK_WEBVIEW]";
export type DeviceEnergyRole = 'site_main' | 'sub_meter' | 'generation' | 'monitoring' | 'excluded';
export type DeviceEnergySource = '' | 'grid' | 'solar' | 'generator' | 'battery' | 'other';
export type DeviceEnergyMapping = {
    role: DeviceEnergyRole;
    source: DeviceEnergySource;
    loadCategory: string;
    includeInCarbon: boolean;
    viewerVisible: boolean;
    advanced?: {
        topologyNode?: string;
        parentNode?: string;
        criticalLevel?: string;
    };
};
export type LegacyDeviceEnergyMapping = {
    energyRole?: string;
    sourceType?: string;
    loadCategory?: string;
    topologyNodeType?: string;
    parentNode?: string;
    criticalLevel?: string;
    viewerVisible?: boolean;
    includeInSiteDemand?: boolean;
};
export declare const ENERGY_ROLE_OPTIONS: Array<{
    value: DeviceEnergyRole;
    label: string;
    hint: string;
}>;
export declare const ENERGY_SOURCE_OPTIONS: Array<{
    value: DeviceEnergySource;
    label: string;
}>;
export declare const LOAD_CATEGORY_OPTIONS: Array<{
    value: string;
    label: string;
}>;
export declare const TOPOLOGY_NODE_OPTIONS: {
    value: string;
    label: string;
}[];
export declare const CRITICAL_LEVEL_OPTIONS: {
    value: string;
    label: string;
}[];
export declare function defaultIncludeInCarbon(role: DeviceEnergyRole): boolean;
export declare function defaultDeviceEnergyMapping(deviceType?: string): DeviceEnergyMapping;
export declare function migrateLegacyMapping(legacy: LegacyDeviceEnergyMapping): DeviceEnergyMapping;
export declare function parseLegacyBlockFromDescription(description?: string | null): {
    plainDescription: string;
    legacy: LegacyDeviceEnergyMapping;
};
export declare function stripLegacyBlockFromDescription(description?: string | null): string;
export declare function parseEnergyMappingJson(raw?: string | null): DeviceEnergyMapping | null;
export declare function normalizeDeviceEnergyMapping(input: Partial<DeviceEnergyMapping> | null | undefined, deviceType?: string): DeviceEnergyMapping;
export declare function resolveDeviceEnergyMapping(device: {
    description?: string | null;
    energyMappingJson?: string | null;
    type?: string;
}): DeviceEnergyMapping;
export declare function serializeDeviceEnergyMapping(mapping: DeviceEnergyMapping): string;
export declare function optionLabel(options: Array<{
    value: string;
    label: string;
}>, value?: string | null): string;
export declare function energyRoleHint(role: DeviceEnergyRole): string;
