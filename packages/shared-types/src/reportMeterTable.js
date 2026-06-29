import { inferTagEnergyRole, normalizeTagEnergyRole } from './tagEnergyMapping.js';
import { isEnergyLikeTag } from './reportFormula.js';
export const METER_BILLING_COLUMN_DEFS = [
    { id: 'index', label: 'No.', labelTh: 'ลำดับ' },
    { id: 'device', label: 'Meter (Device)', labelTh: 'มิเตอร์ (อุปกรณ์)' },
    { id: 'tag', label: 'Parameter (Register)', labelTh: 'พารามิเตอร์ (รีจิสเตอร์)' },
    { id: 'meterNo', label: 'Meter No.', labelTh: 'หมายเลขมิเตอร์' },
    { id: 'first', label: 'Previous', labelTh: 'หน่วยครั้งก่อน' },
    { id: 'last', label: 'Current', labelTh: 'หน่วยครั้งหลัง' },
    { id: 'usage', label: 'Used', labelTh: 'หน่วยที่ใช้' },
    { id: 'rate', label: 'Rate', labelTh: 'บาท/หน่วย' },
    { id: 'amount', label: 'Amount', labelTh: 'จำนวนเงิน' },
];
export const DEFAULT_METER_BILLING_COLUMNS = [
    'index', 'device', 'tag', 'meterNo', 'first', 'last', 'usage', 'rate', 'amount',
];
export function resolveReportScopeDeviceIds(devices, props) {
    const mode = props?.scopeMode ?? (props?.deviceId || props?.deviceIds?.length ? 'device' : 'project');
    const scopeDeviceId = props?.scopeDeviceId ?? props?.deviceId;
    if (mode === 'project')
        return [];
    const ids = new Set();
    if (props?.deviceIds?.length)
        props.deviceIds.forEach((id) => ids.add(id));
    if (scopeDeviceId)
        ids.add(scopeDeviceId);
    if (mode === 'converter' && scopeDeviceId) {
        let changed = true;
        while (changed) {
            changed = false;
            for (const device of devices) {
                if (device.parentDeviceId && ids.has(device.parentDeviceId) && !ids.has(device.id)) {
                    ids.add(device.id);
                    changed = true;
                }
            }
        }
    }
    return Array.from(ids);
}
export function isBillingEnergyTag(tag) {
    const role = normalizeTagEnergyRole(tag.energyTagRole);
    if (role === 'import_kwh' || role === 'net_kwh')
        return true;
    if (role === 'export_kwh' || role === 'power_kw' || role === 'none') {
        if (role !== 'none')
            return false;
    }
    const inferred = inferTagEnergyRole(tag.name, tag.unit);
    return inferred === 'import_kwh' || inferred === 'net_kwh' || isEnergyLikeTag(tag.unit, tag.name);
}
export function parseMeterBillingColumns(raw) {
    const allowed = new Set(METER_BILLING_COLUMN_DEFS.map((c) => c.id));
    if (!raw?.trim())
        return [...DEFAULT_METER_BILLING_COLUMNS];
    const cols = raw.split(',').map((s) => s.trim());
    const parsed = cols.filter((c) => allowed.has(c));
    return parsed.length ? parsed : [...DEFAULT_METER_BILLING_COLUMNS];
}
/** Tags that should appear in a meter billing table. */
export function listMeterBillingTags(tags, devices, props) {
    const deviceFilter = new Set(resolveReportScopeDeviceIds(devices, props));
    const manualIds = props?.tagIds?.filter(Boolean) ?? [];
    const autoInclude = props?.autoInclude !== false;
    let pool = tags.filter(isBillingEnergyTag);
    if (deviceFilter.size > 0) {
        pool = pool.filter((t) => deviceFilter.has(t.deviceId));
    }
    if (manualIds.length > 0) {
        const manual = new Set(manualIds);
        pool = pool.filter((t) => manual.has(t.id));
    }
    else if (!autoInclude) {
        return [];
    }
    const deviceName = new Map(devices.map((d) => [d.id, d.name]));
    return pool.sort((a, b) => {
        const da = deviceName.get(a.deviceId) ?? a.deviceId;
        const db = deviceName.get(b.deviceId) ?? b.deviceId;
        if (da !== db)
            return da.localeCompare(db);
        return a.name.localeCompare(b.name);
    });
}
export function meterNumberForTag(tag) {
    const desc = String(tag.description ?? '').trim();
    if (desc && /^\d{6,}$/.test(desc.replace(/\s/g, '')))
        return desc.trim();
    return tag.name;
}
export function buildMeterBillingRows(tags, devices, summaries, props, billing) {
    const summaryMap = summaries instanceof Map
        ? summaries
        : new Map(Object.entries(summaries));
    const flatRate = billing?.energyCostRate
        ?? (billing?.totalKwh && billing?.energyCost && billing.totalKwh > 0
            ? billing.energyCost / billing.totalKwh
            : null);
    const deviceName = new Map(devices.map((d) => [d.id, d.name]));
    const selected = listMeterBillingTags(tags, devices, props);
    return selected.map((tag, index) => {
        const summary = summaryMap.get(tag.id);
        const usage = summary?.usageValue ?? null;
        const rate = summary?.ratePerUnit ?? flatRate;
        const amount = summary?.amount ?? (usage != null && rate != null ? usage * rate : null);
        return {
            index: index + 1,
            tagId: tag.id,
            tagName: tag.name,
            deviceId: tag.deviceId,
            deviceName: deviceName.get(tag.deviceId) ?? tag.deviceId,
            meterNo: meterNumberForTag(tag),
            unit: tag.unit ?? summary?.unit ?? null,
            firstValue: summary?.firstValue ?? null,
            lastValue: summary?.lastValue ?? null,
            usageValue: usage,
            ratePerUnit: rate,
            amount,
        };
    });
}
export function formatMeterCell(column, row, decimalPlaces = 2) {
    const fmt = (n) => {
        if (n == null || !Number.isFinite(n))
            return '—';
        return n.toLocaleString(undefined, { minimumFractionDigits: decimalPlaces, maximumFractionDigits: decimalPlaces });
    };
    switch (column) {
        case 'index': return String(row.index);
        case 'device': return row.deviceName;
        case 'tag': return row.tagName;
        case 'meterNo': return row.meterNo;
        case 'first': return fmt(row.firstValue);
        case 'last': return fmt(row.lastValue);
        case 'usage': return fmt(row.usageValue);
        case 'rate': return fmt(row.ratePerUnit);
        case 'amount': return fmt(row.amount);
        default: return '';
    }
}
export function meterBillingColumnLabel(column, lang = 'th') {
    const def = METER_BILLING_COLUMN_DEFS.find((c) => c.id === column);
    if (!def)
        return column;
    return lang === 'th' ? def.labelTh : def.label;
}
