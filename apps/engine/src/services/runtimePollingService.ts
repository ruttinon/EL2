import type { Device, Tag } from '@prisma/client';
import { readEngineConfig } from '@energylink/shared-data';
import { getDriver } from '../drivers/driverFactory.js';
import type { DeviceConnectionResult, ReadTagOnceResult } from '../drivers/types.js';
import { appendEngineLog } from './engineLogger.js';
import { getPrismaClient } from './database.js';
import { evaluateAlarmForTagRead } from './alarmRuntimeService.js';
import { broadcastRuntimeValues, runtimeSubscriberCount } from './runtimeStream.js';

type TagQuality = 'good' | 'bad' | 'uncertain' | 'unknown';
type DeviceWithTags = Device & { tags: Tag[]; parent?: Device | null };

type PollingStats = {
  startedAt?: string;
  stoppedAt?: string;
  lastCycleAt?: string;
  lastCycleDurationMs?: number;
  cycles: number;
  successfulReads: number;
  failedReads: number;
  lastError?: string;
};

let timer: NodeJS.Timeout | undefined;
let cycleRunning = false;
let manualStop = false;
const stats: PollingStats = {
  cycles: 0,
  successfulReads: 0,
  failedReads: 0
};
const lastFastPollAt = new Map<string, number>();
const lastFullPollAt = new Map<string, number>();
// In-memory snapshot of current tag values to serve lightweight reads
const latestSnapshot = new Map<string, any>();
let latestSnapshotAt: string | undefined;
const lastHistoryLoggedAt = new Map<string, number>();
const lastHistoryLoggedValue = new Map<string, number | null>();

function toNumericValue(value: number | boolean | undefined): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  return null;
}

function toTagQuality(quality: ReadTagOnceResult['quality']): TagQuality {
  if (quality === 'good') return 'good';
  if (quality === 'uncertain') return 'uncertain';
  return 'bad';
}

function summarizeDeviceStatus(results: ReadTagOnceResult[]) {
  if (results.length === 0) return { status: 'unknown' as const, lastError: null as string | null };
  const ok = results.filter((result) => result.ok).length;
  const failed = results.length - ok;
  if (ok === results.length) return { status: 'online' as const, lastError: null };
  const firstError = results.find((result) => !result.ok)?.error ?? results.find((result) => !result.ok)?.message ?? null;
  if (ok === 0) return { status: 'offline' as const, lastError: firstError };
  return { status: 'warning' as const, lastError: firstError };
}

function mapDeviceConnectionStatus(result: DeviceConnectionResult): Device['status'] {
  if (result.status === 'online') return 'online';
  if (result.status === 'offline') return 'offline';
  if (result.status === 'unsupported' || result.status === 'invalid_configuration') return 'warning';
  return 'unknown';
}

function isConverterHealthDevice(device: Device) {
  const type = String(device.type ?? '').toLowerCase();
  const protocol = String(device.protocol ?? '').toLowerCase();
  return type === 'converter' && ['tcp', 'modbus_tcp', 'udp', 'modbus_rtu', 'mqtt'].includes(protocol);
}

async function pollConverterHealth(device: DeviceWithTags) {
  const driver = getDriver(device.protocol);
  const result = await driver.testConnection(device);
  const prisma = getPrismaClient();
  await prisma.device.update({
    where: { id: device.id },
    data: {
      status: mapDeviceConnectionStatus(result),
      lastTestAt: new Date(),
      lastError: result.ok ? null : result.error ?? result.message
    }
  });
  appendEngineLog(result.ok ? 'info' : 'warn', 'Converter health check completed', {
    deviceId: device.id,
    deviceName: device.name,
    protocol: device.protocol,
    ok: result.ok,
    status: result.status,
    message: result.message,
    error: result.error,
    endpoint: result.endpoint
  });
}

function getPollingConcurrency() {
  const value = Number(process.env.ENERGYLINK_POLLING_CONCURRENCY ?? 2);
  if (!Number.isInteger(value) || value < 1) return 1;
  return Math.min(value, 4);  // SQLite: max 4 concurrent connections recommended
}

function getDevicePollingIntervalMs(device: Device) {
  const value = Number(device.pollingIntervalMs ?? 1000);
  if (!Number.isFinite(value) || value < 250) return 1000;
  return Math.max(250, value);
}

function getNormalTagIntervalMs(device: Device) {
  const multiplier = Number(process.env.ENERGYLINK_NORMAL_TAG_INTERVAL_MULTIPLIER ?? 2);
  const safeMultiplier = Number.isFinite(multiplier) && multiplier >= 1 ? multiplier : 2;
  return Math.max(getDevicePollingIntervalMs(device), Math.round(getDevicePollingIntervalMs(device) * safeMultiplier));
}

function isFastTag(tag: Tag) {
  const unit = String(tag.unit ?? '').trim().toLowerCase();
  const name = String(tag.name ?? '').trim().toLowerCase();
  const normalizedUnit = unit.replace(/[^a-z]/g, '');
  if (['v', 'a', 'kw', 'kwh'].includes(normalizedUnit)) return true;
  return /\b(voltage|current|active power|energy|kwh|kw)\b/.test(name);
}

function selectTagsForPolling(device: DeviceWithTags, now: number): { tags: Tag[]; didPollFast: boolean; didPollFull: boolean } {
  const lastFastAt = lastFastPollAt.get(device.id);
  const lastFullAt = lastFullPollAt.get(device.id);
  const fastDue = !lastFastAt || now - lastFastAt >= getDevicePollingIntervalMs(device);
  const fullDue = !lastFullAt || now - lastFullAt >= getNormalTagIntervalMs(device);
  if (fullDue) return { tags: device.tags, didPollFast: true, didPollFull: true };
  if (!fastDue) return { tags: [], didPollFast: false, didPollFull: false };

  const fastTags = device.tags.filter(isFastTag);
  return {
    tags: fastTags.length > 0 ? fastTags : device.tags,
    didPollFast: true,
    didPollFull: fastTags.length === 0
  };
}

function getGatewayKey(device: DeviceWithTags) {
  const transportProtocol = String(device.parent?.protocol ?? device.protocol ?? '').toLowerCase();
  if (transportProtocol === 'tcp' || transportProtocol === 'modbus_tcp') {
    const endpoint = device.ipAddress && device.port ? device : device.parent;
    return `tcp:${endpoint?.ipAddress ?? 'missing-ip'}:${endpoint?.port ?? 'missing-port'}`;
  }
  if (transportProtocol === 'modbus_rtu') {
    const endpoint = device.serialPort ? device : device.parent;
    return `rtu:${endpoint?.serialPort ?? 'missing-port'}`;
  }
  if (transportProtocol === 'mqtt') {
    const endpoint = device.ipAddress && device.port ? device : device.parent;
    return `mqtt:${endpoint?.ipAddress ?? 'missing-host'}:${endpoint?.port ?? 1883}:${endpoint?.mqttUsername ?? ''}`;
  }
  return `${transportProtocol || device.protocol}:${device.id}`;
}

function groupDevicesByGateway(devices: DeviceWithTags[]) {
  const groups = new Map<string, DeviceWithTags[]>();
  for (const device of devices) {
    const key = getGatewayKey(device);
    const group = groups.get(key);
    if (group) group.push(device);
    else groups.set(key, [device]);
  }
  return [...groups.values()];
}

async function runWithConcurrency<T>(items: T[], concurrency: number, worker: (item: T) => Promise<void>) {
  let nextIndex = 0;
  const workerCount = Math.min(concurrency, items.length);
  const workers = Array.from({ length: workerCount }, async () => {
    while (nextIndex < items.length) {
      const item = items[nextIndex];
      nextIndex += 1;
      await worker(item);
    }
  });
  await Promise.all(workers);
}

function needsCurrentValueUpdate(currentTag: { currentValue: number | null | undefined; quality: string; lastValueAt: Date | null }, result: ReadTagOnceResult, value: number | null, quality: TagQuality, readAt: Date) {
  if (result.ok) {
    const lastValueAtMs = currentTag.lastValueAt ? currentTag.lastValueAt.getTime() : 0;
    return currentTag.currentValue !== value || currentTag.quality !== quality || readAt.getTime() > lastValueAtMs;
  }
  return currentTag.quality !== quality;
}

async function saveDeviceReadResults(device: Device, tagsById: Map<string, Tag>, results: ReadTagOnceResult[], historyLoggingEnabled: boolean) {
  const prisma = getPrismaClient();
  const rows = results.flatMap((result) => {
    const tag = tagsById.get(result.tagId);
    if (!tag) return [];
    const readAt = new Date(result.readAt);
    const quality = toTagQuality(result.quality);
    const value = toNumericValue(result.value);
    return [{ tag, result, readAt, quality, value }];
  });
  const config = readEngineConfig();
  const historyLogIntervalMs = (config.historyLogIntervalSeconds ?? 900) * 1000;
  const historyMinLogIntervalMs = (config.historyMinLogIntervalSeconds ?? 60) * 1000;
  const historyDeadbandPercent = config.historyDeadbandPercent ?? 1.0;

  const historyRows = rows
    .filter(({ tag, value, readAt }) => {
      if (!historyLoggingEnabled || !tag.historyEnabled || !device.historyEnabled) {
        return false;
      }
      const nowMs = readAt.getTime();
      const lastLoggedAt = lastHistoryLoggedAt.get(tag.id);
      const lastLoggedVal = lastHistoryLoggedValue.get(tag.id);

      if (lastLoggedAt === undefined || lastLoggedVal === undefined) {
        // First log / baseline
        lastHistoryLoggedAt.set(tag.id, nowMs);
        lastHistoryLoggedValue.set(tag.id, value);
        return true;
      }

      const elapsedMs = nowMs - lastLoggedAt;

      // Force log if max log interval has passed
      if (elapsedMs >= historyLogIntervalMs) {
        lastHistoryLoggedAt.set(tag.id, nowMs);
        lastHistoryLoggedValue.set(tag.id, value);
        return true;
      }

      // Check deadband if minimum log interval has passed
      if (elapsedMs >= historyMinLogIntervalMs) {
        let valueChanged = false;
        if (value === null || lastLoggedVal === null) {
          valueChanged = value !== lastLoggedVal;
        } else {
          const diff = Math.abs(value - lastLoggedVal);
          if (lastLoggedVal === 0) {
            valueChanged = diff > 0.0001; // small absolute threshold to handle zero
          } else {
            const percentChange = (diff / Math.abs(lastLoggedVal)) * 100;
            valueChanged = percentChange >= historyDeadbandPercent;
          }
        }

        if (valueChanged) {
          lastHistoryLoggedAt.set(tag.id, nowMs);
          lastHistoryLoggedValue.set(tag.id, value);
          return true;
        }
      }

      return false;
    })
    .map(({ tag, result, readAt, quality, value }) => ({
      projectId: tag.projectId,
      deviceId: device.id,
      tagId: tag.id,
      value,
      quality,
      rawJson: result.rawValue === undefined ? null : JSON.stringify(result.rawValue),
      error: result.ok ? null : result.error ?? result.message,
      readAt
    }));

  // Helper to save in batches for better concurrency
  async function saveBatch(batchRows: typeof rows, batchHistoryRows: typeof historyRows) {
    const persistedRows = await prisma.$transaction(async (tx) => {
      const existingTags = await tx.tag.findMany({
        where: { id: { in: batchRows.map(({ tag }) => tag.id) } },
        select: { id: true, currentValue: true, quality: true, lastValueAt: true }
      });
      const existingTagMap = new Map(existingTags.map((tag) => [tag.id, tag]));
      const activeRows = batchRows.filter(({ tag }) => existingTagMap.has(tag.id));
      const rowsToPersist = activeRows.filter(({ tag, result, readAt, quality, value }) => {
        const existing = existingTagMap.get(tag.id);
        return existing ? needsCurrentValueUpdate(existing, result, value, quality, readAt) : false;
      });
      const activeHistoryRows = batchHistoryRows.filter((row) => existingTagMap.has(row.tagId));

      for (const { tag, result, readAt, quality, value } of rowsToPersist) {
        await tx.tag.updateMany({
          where: { id: tag.id },
          data: {
            currentValue: result.ok ? value : tag.currentValue,
            quality,
            lastValueAt: readAt
          }
        });
      }
      if (activeHistoryRows.length > 0) {
        await tx.historyValue.createMany({ data: activeHistoryRows });
      }

      return rowsToPersist;
    });

    // Process persisted rows for alarms and snapshots
    for (const { tag, result, quality, value } of persistedRows) {
      if (result.ok) {
        await evaluateAlarmForTagRead(tag, device, value, quality);
      }
    }

    for (const { tag, result } of persistedRows) {
      const snapshot = {
        id: tag.id,
        projectId: tag.projectId,
        deviceId: tag.deviceId,
        deviceName: device.name,
        name: tag.name,
        description: tag.description,
        value: result.ok ? toNumericValue(result.value) : tag.currentValue,
        unit: tag.unit,
        quality: toTagQuality(result.quality),
        lastValueAt: result.readAt ? new Date(result.readAt).toISOString() : (tag.lastValueAt ? tag.lastValueAt.toISOString() : null),
        registerType: tag.registerType,
        dataType: tag.dataType,
        decimalPlaces: tag.decimalPlaces,
        historyEnabled: tag.historyEnabled
      };
      latestSnapshot.set(tag.id, snapshot);
    }
  }

  // Split into smaller batches if there are many results (reduce transaction size)
  const batchSize = rows.length > 100 ? 50 : rows.length;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batchRows = rows.slice(i, i + batchSize);
    const batchHistoryRows = historyRows.slice(i, i + batchSize);
    await saveBatch(batchRows, batchHistoryRows);
  }

  latestSnapshotAt = new Date().toISOString();
}

async function pollDevice(device: DeviceWithTags, tags: Tag[], historyLoggingEnabled: boolean) {
  const driver = getDriver(device.protocol);
  const results: ReadTagOnceResult[] = [];
  const tagsById = new Map(tags.map((tag) => [tag.id, tag]));

  const readResults = driver.readTags
    ? await driver.readTags(device, tags)
    : await Promise.all(tags.map((tag) => driver.readTagOnce(device, tag)));

  for (const result of readResults) {
    const tag = tagsById.get(result.tagId);
    if (!tag) continue;
    results.push(result);
    if (result.ok) stats.successfulReads += 1;
    else stats.failedReads += 1;
  }

  try {
    await saveDeviceReadResults(device, tagsById, results, historyLoggingEnabled);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    stats.lastError = message;
    appendEngineLog('error', 'Runtime polling device result persistence failed', {
      deviceId: device.id,
      deviceName: device.name,
      resultCount: results.length,
      message
    });
  }

  const summary = summarizeDeviceStatus(results);
  const prisma = getPrismaClient();
  await prisma.device.update({
    where: { id: device.id },
    data: {
      status: summary.status,
      lastError: summary.lastError
    }
  });
}

async function pollDeviceAndMark(device: DeviceWithTags, selected: ReturnType<typeof selectTagsForPolling>, historyLoggingEnabled: boolean) {
  const maxRetries = 2;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await pollDevice(device, selected.tags, historyLoggingEnabled);
      lastError = null;
      break; // Success
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const isTransient = lastError.message.includes('timed out') ||
        lastError.message.includes('Transaction') ||
        lastError.message.includes('database is locked');

      if (isTransient && attempt < maxRetries) {
        // Exponential backoff: 100ms * 2^(attempt-1)
        const delayMs = Math.min(1000, 100 * Math.pow(2, attempt - 1));
        await new Promise(resolve => setTimeout(resolve, delayMs));
        continue; // Retry
      }
      break; // Don't retry non-transient errors
    }
  }

  if (lastError) {
    appendEngineLog('error', 'Runtime polling device failed after retries', {
      deviceId: device.id,
      deviceName: device.name,
      message: lastError.message
    });
  }

  const completedAt = Date.now();
  if (selected.didPollFast) lastFastPollAt.set(device.id, completedAt);
  if (selected.didPollFull) lastFullPollAt.set(device.id, completedAt);
}

export async function runRuntimeReadCycle(reason = 'manual_cycle') {
  if (cycleRunning) return;
  cycleRunning = true;
  const cycleStarted = Date.now();
  try {
    const prisma = getPrismaClient();
    const config = readEngineConfig();
    const devices = await prisma.device.findMany({
      where: {
        communicationEnabled: true,
        OR: [
          { tags: { some: {} } },
          { type: 'converter' }
        ]
      },
      include: { tags: true, parent: true },
      orderBy: [{ type: 'asc' }, { name: 'asc' }]
    });

    const converterDevices = devices.filter(isConverterHealthDevice);
    await runWithConcurrency(converterDevices, getPollingConcurrency(), async (device) => {
      await pollConverterHealth(device);
    });

    const now = Date.now();
    const devicesToPoll = devices.flatMap((device) => {
      if (isConverterHealthDevice(device) && device.tags.length === 0) return [];
      const selected = selectTagsForPolling(device, now);
      return selected.tags.length > 0 ? [{ device, selected }] : [];
    });
    const gatewayGroups = groupDevicesByGateway(devicesToPoll.map(({ device }) => device));
    const selectedByDeviceId = new Map(devicesToPoll.map(({ device, selected }) => [device.id, selected]));
    await runWithConcurrency(gatewayGroups, getPollingConcurrency(), async (group) => {
      for (const device of group) {
        const selected = selectedByDeviceId.get(device.id);
        if (!selected) continue;
        await pollDeviceAndMark(device, selected, config.historyLoggingEnabled);
      }
    });

    stats.cycles += 1;
    stats.lastCycleAt = new Date().toISOString();
    stats.lastCycleDurationMs = Date.now() - cycleStarted;

    // Push real-time values to any connected SSE subscribers (P3: real-time push)
    if (runtimeSubscriberCount() > 0) {
      broadcastRuntimeValues(Array.from(latestSnapshot.values()));
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    stats.lastError = message;
    appendEngineLog('error', 'Runtime polling cycle failed', { reason, message });
  } finally {
    cycleRunning = false;
  }
}

export async function initSnapshotFromDb() {
  try {
    const rows = await readCurrentValues();
    latestSnapshot.clear();
    for (const r of rows) {
      latestSnapshot.set(r.id, r);
    }
    latestSnapshotAt = new Date().toISOString();
  } catch (err) {
    // ignore - snapshot will gradually populate as reads persist
  }
}

export async function getCurrentValuesSnapshot(filters?: { projectId?: string; deviceId?: string }) {
  if (latestSnapshot.size === 0) {
    const rows = await readCurrentValues();
    latestSnapshot.clear();
    for (const r of rows) {
      latestSnapshot.set(r.id, r);
    }
    latestSnapshotAt = new Date().toISOString();
  }

  const arr = Array.from(latestSnapshot.values());
  return arr.filter(r => {
    if (filters?.projectId && r.projectId !== filters.projectId) return false;
    if (filters?.deviceId && r.deviceId !== filters.deviceId) return false;
    return true;
  });
}

export function getRuntimeMetrics() {
  return {
    currentSnapshotCount: latestSnapshot.size,
    currentSnapshotAgeMs: latestSnapshotAt ? Date.now() - new Date(latestSnapshotAt).getTime() : null,
    currentSnapshotAt: latestSnapshotAt,
    pollingConcurrency: getPollingConcurrency(),
    runtimeSource: 'real_devices',
    runtime: getRuntimePollingStatus(),
  };
}

export async function startRuntimePolling(reason = 'service_start') {
  const config = readEngineConfig();
  if (!config.pollingEnabled) {
    appendEngineLog('info', 'Runtime polling is disabled by engine configuration', { reason });
    return getRuntimePollingStatus();
  }
  if (timer) return getRuntimePollingStatus();

  manualStop = false;
  const intervalMs = Math.max(250, Number(config.pollingScanIntervalMs ?? 1000));
  stats.startedAt = new Date().toISOString();
  stats.stoppedAt = undefined;
  appendEngineLog('info', 'Runtime polling started', {
    reason,
    intervalMs,
    historyLoggingEnabled: config.historyLoggingEnabled
  });
  // Initialize snapshot from DB before starting cycles so clients get immediate values
  try { await initSnapshotFromDb(); } catch (err) { /* ignore */ }
  void runRuntimeReadCycle(reason);
  timer = setInterval(() => void runRuntimeReadCycle('scheduled_cycle'), intervalMs);
  return getRuntimePollingStatus();
}

export function stopRuntimePolling(reason = 'manual_stop') {
  manualStop = reason === 'manual_stop';
  if (timer) {
    clearInterval(timer);
    timer = undefined;
  }
  stats.stoppedAt = new Date().toISOString();
  appendEngineLog('info', 'Runtime polling stopped', { reason });
  return getRuntimePollingStatus();
}

export function getRuntimePollingStatus() {
  const config = readEngineConfig();
  return {
    running: Boolean(timer),
    cycleRunning,
    manualStop,
    pollingEnabled: config.pollingEnabled,
    historyLoggingEnabled: config.historyLoggingEnabled,
    pollingScanIntervalMs: config.pollingScanIntervalMs,
    runtimeSource: 'real_devices',
    pollingConcurrency: getPollingConcurrency(),
    currentSnapshotCount: latestSnapshot.size,
    currentSnapshotAgeMs: latestSnapshotAt ? Date.now() - new Date(latestSnapshotAt).getTime() : null,
    currentSnapshotAt: latestSnapshotAt,
    ...stats
  };
}

export async function readCurrentValues(filters?: { projectId?: string; deviceId?: string }) {
  const prisma = getPrismaClient();
  const tags = await prisma.tag.findMany({
    where: {
      ...(filters?.projectId ? { projectId: filters.projectId } : {}),
      ...(filters?.deviceId ? { deviceId: filters.deviceId } : {})
    },
    include: { device: true },
    orderBy: [{ device: { name: 'asc' } }, { name: 'asc' }]
  });

  return tags.map((tag) => ({
    id: tag.id,
    projectId: tag.projectId,
    deviceId: tag.deviceId,
    deviceName: tag.device.name,
    name: tag.name,
    description: tag.description,
    value: tag.currentValue,
    unit: tag.unit,
    quality: tag.quality,
    lastValueAt: tag.lastValueAt?.toISOString() ?? null,
    registerType: tag.registerType,
    dataType: tag.dataType,
    decimalPlaces: tag.decimalPlaces,
    historyEnabled: tag.historyEnabled
  }));
}

type TrendAggregate = 'avg' | 'min' | 'max' | 'first' | 'last';

const MAX_RAW_TREND_ROWS = 50000;

function parseTrendAggregate(value: string | undefined): TrendAggregate {
  switch ((value ?? '').toLowerCase()) {
    case 'min':
      return 'min';
    case 'max':
      return 'max';
    case 'first':
      return 'first';
    case 'last':
      return 'last';
    case 'avg':
    case 'mean':
    case 'average':
      return 'avg';
    default:
      return 'avg';
  }
}

type TrendBucket = {
  startMs: number;
  count: number;
  sum: number;
  min: number;
  max: number;
  first: number;
  last: number;
  lastAtMs: number;
  quality: string;
};

export async function readTrend(query: {
  tagId?: string;
  from?: string;
  to?: string;
  limit?: string;
  /** Downsample target: number of points to return across the range. */
  points?: string;
  /** Downsample bucket size in milliseconds (overrides points when set). */
  bucketMs?: string;
  /** Aggregate to use for each bucket's primary value (default avg). */
  agg?: string;
}) {
  if (!query.tagId) {
    return { error: 'tagId query parameter is required.' };
  }
  const prisma = getPrismaClient();
  const from = query.from ? new Date(query.from) : undefined;
  const to = query.to ? new Date(query.to) : undefined;

  const requestedPoints = query.points !== undefined ? Number(query.points) : undefined;
  const requestedBucketMs = query.bucketMs !== undefined ? Number(query.bucketMs) : undefined;
  const aggregationRequested =
    (requestedPoints !== undefined && Number.isFinite(requestedPoints) && requestedPoints > 0) ||
    (requestedBucketMs !== undefined && Number.isFinite(requestedBucketMs) && requestedBucketMs > 0) ||
    query.agg !== undefined;

  // Backward-compatible path: no downsampling params → return raw rows.
  if (!aggregationRequested) {
    const limit = Math.min(Math.max(Number(query.limit ?? 1000), 1), 5000);
    const toDate = to ?? (from ? new Date() : undefined);
    const hasWindow = Boolean(from || toDate);
    const rows = await prisma.historyValue.findMany({
      where: {
        tagId: query.tagId,
        ...(hasWindow ? { readAt: { ...(from ? { gte: from } : {}), ...(toDate ? { lte: toDate } : {}) } } : {})
      },
      orderBy: { readAt: hasWindow ? 'desc' : 'asc' },
      take: limit,
      include: { tag: true, device: true }
    });
    const ordered = hasWindow ? [...rows].reverse() : rows;

    return {
      tagId: query.tagId,
      count: ordered.length,
      aggregated: false,
      values: ordered.map((row) => ({
        id: row.id,
        tagId: row.tagId,
        tagName: row.tag.name,
        deviceId: row.deviceId,
        deviceName: row.device.name,
        value: row.value,
        unit: row.tag.unit,
        quality: row.quality,
        readAt: row.readAt.toISOString(),
        error: row.error
      }))
    };
  }

  // Aggregated path: bucket history into min/max/avg per time bucket (DAQ style).
  const agg = parseTrendAggregate(query.agg);
  const rows = await prisma.historyValue.findMany({
    where: {
      tagId: query.tagId,
      value: { not: null },
      ...(from || to ? { readAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {})
    },
    orderBy: { readAt: 'asc' },
    take: MAX_RAW_TREND_ROWS,
    include: { tag: true, device: true }
  });

  if (rows.length === 0) {
    return { tagId: query.tagId, count: 0, aggregated: true, bucketMs: 0, agg, values: [] };
  }

  const tagName = rows[0].tag.name;
  const tagUnit = rows[0].tag.unit;
  const deviceId = rows[0].deviceId;
  const deviceName = rows[0].device.name;

  const startMs = (from ?? rows[0].readAt).getTime();
  const endMs = (to ?? rows[rows.length - 1].readAt).getTime();
  const spanMs = Math.max(1, endMs - startMs);

  let bucketMs: number;
  if (requestedBucketMs !== undefined && Number.isFinite(requestedBucketMs) && requestedBucketMs > 0) {
    bucketMs = Math.ceil(requestedBucketMs);
  } else {
    const targetPoints = Math.min(
      5000,
      Math.max(1, Math.floor(requestedPoints && Number.isFinite(requestedPoints) ? requestedPoints : 500))
    );
    bucketMs = Math.max(1, Math.ceil(spanMs / targetPoints));
  }

  const buckets = new Map<number, TrendBucket>();
  for (const row of rows) {
    if (row.value == null) continue;
    const t = row.readAt.getTime();
    const idx = Math.floor((t - startMs) / bucketMs);
    const bucketStart = startMs + idx * bucketMs;
    const existing = buckets.get(idx);
    const v = row.value;
    if (!existing) {
      buckets.set(idx, {
        startMs: bucketStart,
        count: 1,
        sum: v,
        min: v,
        max: v,
        first: v,
        last: v,
        lastAtMs: t,
        quality: row.quality
      });
    } else {
      existing.count += 1;
      existing.sum += v;
      if (v < existing.min) existing.min = v;
      if (v > existing.max) existing.max = v;
      existing.last = v;
      existing.lastAtMs = t;
      existing.quality = row.quality;
    }
  }

  const sorted = Array.from(buckets.values()).sort((a, b) => a.startMs - b.startMs);
  const values = sorted.map((b) => {
    const avg = b.sum / b.count;
    const primary =
      agg === 'min' ? b.min : agg === 'max' ? b.max : agg === 'first' ? b.first : agg === 'last' ? b.last : avg;
    return {
      tagId: query.tagId as string,
      tagName,
      deviceId,
      deviceName,
      value: primary,
      min: b.min,
      max: b.max,
      avg,
      count: b.count,
      unit: tagUnit,
      quality: b.quality,
      readAt: new Date(b.lastAtMs).toISOString()
    };
  });

  return {
    tagId: query.tagId,
    count: values.length,
    aggregated: true,
    bucketMs,
    agg,
    sampleCount: rows.length,
    values
  };
}
