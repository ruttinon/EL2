import type { CurrentTagValue, RuntimeDevice } from '../types/monitor';
import { normalizeQuality, isFreshRead, latestDeviceReadAt } from './runtimeQuality';

export type DeviceLiveStatus = {
  status: string;
  badge: 'good' | 'warn' | 'bad' | 'unknown';
  label: string;
  latestReadAt?: string | null;
};

export type RuntimeIndexes = {
  valuesByDeviceId: Map<string, CurrentTagValue[]>;
  childrenByParentId: Map<string, RuntimeDevice[]>;
  roots: RuntimeDevice[];
  deviceStatus: Map<string, DeviceLiveStatus>;
  powerByDeviceId: Map<string, number>;
};

function computeDeviceLiveStatus(
  device: RuntimeDevice,
  deviceValues: CurrentTagValue[],
): DeviceLiveStatus {
  const latestReadAt = latestDeviceReadAt(deviceValues);
  const fresh = isFreshRead(latestReadAt);
  const goodCount = deviceValues.filter(v => normalizeQuality(v.quality) === 'good').length;
  const readableCount = deviceValues.filter(v => v.value !== null && v.value !== undefined).length;

  if (fresh && goodCount > 0) {
    return { status: 'online', badge: 'good', label: 'OK', latestReadAt };
  }
  if (fresh && readableCount > 0) {
    return { status: 'warning', badge: 'warn', label: 'Warning', latestReadAt };
  }

  const rawStatus = String(device?.status ?? 'unknown').toLowerCase();
  if (rawStatus === 'online') return { status: 'online', badge: 'good', label: 'OK', latestReadAt };
  if (rawStatus === 'warning' || rawStatus === 'warn') {
    return { status: 'warning', badge: 'warn', label: 'Warning', latestReadAt };
  }
  if (rawStatus === 'offline' || rawStatus === 'bad') {
    return { status: 'offline', badge: 'bad', label: 'Offline', latestReadAt };
  }
  return {
    status: rawStatus,
    badge: 'unknown',
    label: rawStatus === 'unknown' ? 'Unknown' : rawStatus,
    latestReadAt,
  };
}

function powerFromValues(values: CurrentTagValue[]): number {
  return values.reduce((sum, v) => {
    const unit = String(v.unit ?? '').toLowerCase();
    const name = String(v.name ?? '').toLowerCase();
    if (unit === 'kw' || unit === 'mw' || name.includes('power') || name.includes('kw')) {
      const val = Number(v.value ?? 0);
      return sum + (unit === 'mw' ? val * 1000 : val);
    }
    return sum;
  }, 0);
}

const OFFLINE_STATUS: DeviceLiveStatus = {
  status: 'offline',
  badge: 'bad',
  label: 'Offline',
  latestReadAt: null,
};

/** Single-pass indexes for O(1) device lookups at scale. */
export function buildRuntimeIndexes(
  devices: RuntimeDevice[],
  currentValues: CurrentTagValue[],
): RuntimeIndexes {
  const valuesByDeviceId = new Map<string, CurrentTagValue[]>();
  for (const v of currentValues) {
    const list = valuesByDeviceId.get(v.deviceId);
    if (list) list.push(v);
    else valuesByDeviceId.set(v.deviceId, [v]);
  }

  const childrenByParentId = new Map<string, RuntimeDevice[]>();
  const roots: RuntimeDevice[] = [];
  for (const d of devices) {
    if (d.parentDeviceId) {
      const list = childrenByParentId.get(d.parentDeviceId);
      if (list) list.push(d);
      else childrenByParentId.set(d.parentDeviceId, [d]);
    } else {
      roots.push(d);
    }
  }

  const deviceStatus = new Map<string, DeviceLiveStatus>();
  const powerByDeviceId = new Map<string, number>();
  for (const d of devices) {
    const vals = valuesByDeviceId.get(d.id) ?? [];
    deviceStatus.set(d.id, computeDeviceLiveStatus(d, vals));
    powerByDeviceId.set(d.id, powerFromValues(vals));
  }

  return { valuesByDeviceId, childrenByParentId, roots, deviceStatus, powerByDeviceId };
}

export function getDeviceLiveStatus(
  device: RuntimeDevice | undefined | null,
  indexes: RuntimeIndexes,
): DeviceLiveStatus {
  if (!device?.id) return OFFLINE_STATUS;
  return indexes.deviceStatus.get(device.id) ?? OFFLINE_STATUS;
}

export function countDevicesByStatus(indexes: RuntimeIndexes): {
  online: number;
  warning: number;
  offline: number;
} {
  let online = 0;
  let warning = 0;
  let offline = 0;
  for (const status of indexes.deviceStatus.values()) {
    if (status.status === 'online') online += 1;
    else if (status.status === 'warning') warning += 1;
    else offline += 1;
  }
  return { online, warning, offline };
}

export function topDevicePowerItems(
  indexes: RuntimeIndexes,
  devices: RuntimeDevice[],
  limit = 8,
): Array<{ name: string; value: number }> {
  return devices
    .map(d => ({ name: d.name, value: indexes.powerByDeviceId.get(d.id) ?? 0 }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}
