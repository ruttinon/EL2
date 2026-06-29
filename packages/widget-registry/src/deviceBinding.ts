/** Heuristic: pick the best status/state tag for a device (SCADA convention). */
export function inferDeviceStatusTag(
  tags: Array<{ id: string; name?: string; deviceId?: string; device_id?: string; dataType?: string; data_type?: string }>,
  deviceId: string,
): string | undefined {
  if (!deviceId) return undefined;
  const deviceTags = tags.filter((t) => (t.deviceId ?? t.device_id) === deviceId);
  if (deviceTags.length === 0) return undefined;

  const patterns = [/status/i, /online/i, /state/i, /running/i, /\brun\b/i, /fault/i, /alarm/i, /mode/i, /comm/i];
  for (const pattern of patterns) {
    const hit = deviceTags.find((t) => pattern.test(String(t.name ?? t.id)));
    if (hit) return hit.id;
  }

  const boolTag = deviceTags.find((t) => {
    const dt = String(t.dataType ?? t.data_type ?? '').toLowerCase();
    return dt === 'bool' || dt === 'boolean';
  });
  if (boolTag) return boolTag.id;

  return deviceTags[0]?.id;
}

function deviceTagsOf(
  tags: Array<{ id: string; name?: string; deviceId?: string; device_id?: string; dataType?: string; data_type?: string; unit?: string | null }>,
  deviceId: string,
) {
  return tags.filter((t) => (t.deviceId ?? t.device_id) === deviceId);
}

/** Pick primary numeric / measurement tag for value, gauge, progress widgets. */
export function inferDeviceNumericTag(
  tags: Array<{ id: string; name?: string; deviceId?: string; device_id?: string; dataType?: string; data_type?: string; unit?: string | null }>,
  deviceId: string,
): string | undefined {
  if (!deviceId) return undefined;
  const deviceTags = deviceTagsOf(tags, deviceId);
  if (deviceTags.length === 0) return undefined;

  const patterns = [/power/i, /active/i, /\bkw\b/i, /energy/i, /soc/i, /voltage/i, /current/i, /temp/i, /level/i, /percent/i, /flow/i, /pressure/i];
  for (const pattern of patterns) {
    const hit = deviceTags.find((t) => pattern.test(String(t.name ?? t.id)));
    if (hit) return hit.id;
  }

  const numeric = deviceTags.find((t) => {
    const dt = String(t.dataType ?? t.data_type ?? '').toLowerCase();
    return ['float', 'double', 'int', 'int16', 'int32', 'uint16', 'uint32', 'number'].includes(dt);
  });
  if (numeric) return numeric.id;

  const withUnit = deviceTags.find((t) => t.unit && String(t.unit).trim());
  if (withUnit) return withUnit.id;

  return deviceTags[0]?.id;
}

export function inferDeviceCommandTag(
  tags: Array<{ id: string; name?: string; deviceId?: string; device_id?: string; dataType?: string; data_type?: string }>,
  deviceId: string,
): string | undefined {
  if (!deviceId) return undefined;
  const deviceTags = deviceTagsOf(tags, deviceId);
  if (deviceTags.length === 0) return undefined;

  const patterns = [/cmd/i, /command/i, /start/i, /stop/i, /enable/i, /setpoint/i, /write/i, /control/i];
  for (const pattern of patterns) {
    const hit = deviceTags.find((t) => pattern.test(String(t.name ?? t.id)));
    if (hit) return hit.id;
  }

  const boolTag = deviceTags.find((t) => {
    const dt = String(t.dataType ?? t.data_type ?? '').toLowerCase();
    return dt === 'bool' || dt === 'boolean';
  });
  if (boolTag) return boolTag.id;

  return deviceTags[0]?.id;
}

/** Pick flow / power tag for flowpath animation. */
export function inferDeviceFlowTag(
  tags: Array<{ id: string; name?: string; deviceId?: string; device_id?: string; dataType?: string; data_type?: string }>,
  deviceId: string,
): string | undefined {
  if (!deviceId) return undefined;
  const deviceTags = deviceTagsOf(tags, deviceId);
  if (deviceTags.length === 0) return undefined;

  const patterns = [/flow/i, /power/i, /active/i, /current/i, /load/i, /output/i, /running/i];
  for (const pattern of patterns) {
    const hit = deviceTags.find((t) => pattern.test(String(t.name ?? t.id)));
    if (hit) return hit.id;
  }

  return inferDeviceNumericTag(tags, deviceId);
}

export function tagsForDevice<T extends { deviceId?: string; device_id?: string }>(
  tags: T[],
  deviceId: string | undefined,
): T[] {
  if (!deviceId) return tags;
  return tags.filter((t) => (t.deviceId ?? t.device_id) === deviceId);
}
