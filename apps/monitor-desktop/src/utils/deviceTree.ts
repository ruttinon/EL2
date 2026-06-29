import type { CurrentTagValue, RuntimeDevice } from '../types/monitor';
import type { RuntimeIndexes } from './runtimeIndexes';

export type MeterNode = {
  device: RuntimeDevice;
  tags: CurrentTagValue[];
};

export type ConverterNode = {
  converter: RuntimeDevice;
  converterTags: CurrentTagValue[];
  meters: MeterNode[];
};

export type StandaloneDeviceNode = {
  device: RuntimeDevice;
  tags: CurrentTagValue[];
};

export type DeviceHierarchy = {
  converters: ConverterNode[];
  standalone: StandaloneDeviceNode[];
};

function matchesSearch(
  q: string,
  device: RuntimeDevice,
  tags: CurrentTagValue[],
  childNames: string[] = [],
): boolean {
  if (!q) return true;
  const hay = [
    device.name,
    device.type,
    device.protocol ?? '',
    ...tags.map(t => t.name),
    ...childNames,
  ].join(' ').toLowerCase();
  return hay.includes(q);
}

/** O(n) hierarchy build using pre-indexed maps — safe for thousands of devices/tags. */
export function buildDeviceHierarchyFromIndexes(
  indexes: RuntimeIndexes,
  devices: RuntimeDevice[],
  search = '',
): DeviceHierarchy {
  const q = search.trim().toLowerCase();
  const converters: ConverterNode[] = [];
  const standalone: StandaloneDeviceNode[] = [];
  const { valuesByDeviceId, childrenByParentId } = indexes;

  for (const root of indexes.roots) {
    const childMeters = childrenByParentId.get(root.id) ?? [];
    const rootTags = valuesByDeviceId.get(root.id) ?? [];

    if (childMeters.length > 0) {
      const childNames = childMeters.map(c => c.name);
      const meters: MeterNode[] = childMeters
        .map(meter => ({
          device: meter,
          tags: valuesByDeviceId.get(meter.id) ?? [],
        }))
        .filter(m => matchesSearch(q, m.device, m.tags) || matchesSearch(q, root, rootTags, childNames));

      const showConverter =
        matchesSearch(q, root, rootTags, childNames) || meters.length > 0;

      if (showConverter) {
        converters.push({ converter: root, converterTags: rootTags, meters });
      }
    } else if (matchesSearch(q, root, rootTags)) {
      standalone.push({ device: root, tags: rootTags });
    }
  }

  const rootIds = new Set(indexes.roots.map(r => r.id));
  for (const d of devices) {
    if (d.parentDeviceId && !rootIds.has(d.parentDeviceId)) {
      const tags = valuesByDeviceId.get(d.id) ?? [];
      if (matchesSearch(q, d, tags)) {
        standalone.push({ device: d, tags });
      }
    }
  }

  return { converters, standalone };
}

/** @deprecated Prefer buildDeviceHierarchyFromIndexes with runtime indexes. */
export function buildDeviceHierarchy(
  devices: RuntimeDevice[],
  currentValues: CurrentTagValue[],
  search = '',
): DeviceHierarchy {
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
  return buildDeviceHierarchyFromIndexes(
    { valuesByDeviceId, childrenByParentId, roots, deviceStatus: new Map(), powerByDeviceId: new Map() },
    devices,
    search,
  );
}

export function isConverterType(type?: string): boolean {
  const t = (type ?? '').toLowerCase();
  return t === 'converter' || t === 'gateway' || t === 'concentrator';
}

export function isMeterType(type?: string): boolean {
  return (type ?? '').toLowerCase() === 'meter';
}

export function countHierarchyTags(hierarchy: DeviceHierarchy): number {
  let n = 0;
  for (const c of hierarchy.converters) {
    n += c.converterTags.length;
    for (const m of c.meters) n += m.tags.length;
  }
  for (const s of hierarchy.standalone) n += s.tags.length;
  return n;
}
