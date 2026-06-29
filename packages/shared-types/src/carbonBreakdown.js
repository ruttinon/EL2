import { computeDeviceQualifiedKwh } from './carbonCalculation.js';
import { ENERGY_SOURCE_OPTIONS, LOAD_CATEGORY_OPTIONS, resolveDeviceEnergyMapping, } from './deviceEnergyMapping.js';
function categoryLabel(value) {
    return LOAD_CATEGORY_OPTIONS.find(o => o.value === value)?.label ?? (value || 'Not specified');
}
function sourceLabel(value) {
    return ENERGY_SOURCE_OPTIONS.find(o => o.value === value)?.label ?? (value || 'Unspecified');
}
/** Breakdown for sub-meters / devices — avoids duplicating site_main total in category view. */
export function computeCarbonBreakdown(devices, contributions, emissionFactorKgPerKwh, by, strategy, tags = [], netMetering = false) {
    const contributionByDevice = new Map(contributions.map(d => [d.deviceId, d]));
    const breakdownDevices = devices.filter(d => {
        const mapping = resolveDeviceEnergyMapping(d);
        if (strategy === 'site_main') {
            return mapping.role === 'sub_meter' || mapping.role === 'generation';
        }
        if (strategy === 'include_in_carbon') {
            return mapping.includeInCarbon && mapping.role !== 'excluded' && mapping.role !== 'monitoring';
        }
        return mapping.role !== 'excluded' && mapping.role !== 'monitoring';
    });
    const buckets = new Map();
    for (const device of breakdownDevices) {
        const contrib = contributionByDevice.get(device.id);
        const deviceTags = tags.filter(t => t.deviceId === device.id);
        const kWh = contrib?.qualifiedKwh ??
            computeDeviceQualifiedKwh(deviceTags, {
                netMetering,
                fallbackKwh: strategy === 'fallback_all_kwh',
            }).qualifiedKwh;
        const mapping = resolveDeviceEnergyMapping(device);
        let key;
        let label;
        let deviceId;
        switch (by) {
            case 'source':
                key = mapping.source || 'unspecified';
                label = sourceLabel(mapping.source);
                break;
            case 'loadCategory':
                key = mapping.loadCategory || 'unspecified';
                label = categoryLabel(mapping.loadCategory);
                break;
            case 'device':
            default:
                key = device.id;
                label = device.name;
                deviceId = device.id;
                break;
        }
        const existing = buckets.get(key);
        if (existing) {
            existing.kWh += kWh;
            existing.carbonKg += kWh * emissionFactorKgPerKwh;
        }
        else {
            buckets.set(key, {
                key,
                label,
                deviceId,
                kWh,
                carbonKg: kWh * emissionFactorKgPerKwh,
                sharePct: 0,
            });
        }
    }
    const items = [...buckets.values()]
        .filter(item => item.kWh > 0 || by === 'device')
        .sort((a, b) => b.kWh - a.kWh);
    const totalKwh = items.reduce((sum, item) => sum + item.kWh, 0);
    const totalCarbonKg = totalKwh * emissionFactorKgPerKwh;
    for (const item of items) {
        item.sharePct = totalKwh > 0 ? (item.kWh / totalKwh) * 100 : 0;
    }
    return {
        by,
        items,
        totalKwh,
        totalCarbonKg,
        emissionFactorKgPerKwh,
    };
}
