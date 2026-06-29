import type { Alarm, Device, Tag } from '@prisma/client';
import { appendEngineLog } from './engineLogger.js';
import { getPrismaClient } from './database.js';
import { notifyAlarmEvent } from './alarmNotificationService.js';

type AlarmStatus = Alarm['status'];

type AlarmFilter = {
  projectId?: string;
  status?: AlarmStatus | 'all' | 'history';
  limit?: string;
};

type AlarmEvaluation = {
  alarmType: 'high' | 'low';
  severity: 'high' | 'medium';
  message: string;
  limitValue: number;
  triggerValue: number;
};

function evaluateLimitAlarm(tag: Tag, value: number | null): AlarmEvaluation | undefined {
  if (value === null || !Number.isFinite(value)) return undefined;

  if (tag.alarmHigh !== null && tag.alarmHigh !== undefined && value > tag.alarmHigh) {
    return {
      alarmType: 'high',
      severity: 'high',
      message: `${tag.name} is above high limit (${value} > ${tag.alarmHigh})`,
      limitValue: tag.alarmHigh,
      triggerValue: value
    };
  }

  if (tag.alarmLow !== null && tag.alarmLow !== undefined && value < tag.alarmLow) {
    return {
      alarmType: 'low',
      severity: 'medium',
      message: `${tag.name} is below low limit (${value} < ${tag.alarmLow})`,
      limitValue: tag.alarmLow,
      triggerValue: value
    };
  }

  return undefined;
}

async function clearActiveLimitAlarms(tag: Tag, exceptAlarmType?: 'high' | 'low') {
  const prisma = getPrismaClient();
  const now = new Date();
  const activeAlarms = await prisma.alarm.findMany({
    where: {
      tagId: tag.id,
      status: 'active',
      ...(exceptAlarmType ? { alarmType: { not: exceptAlarmType } } : {})
    }
  });
  await prisma.alarm.updateMany({
    where: { id: { in: activeAlarms.map((alarm) => alarm.id) } },
    data: {
      status: 'cleared',
      endedAt: now
    }
  });
  for (const alarm of activeAlarms) {
    await notifyAlarmEvent(alarm.id, 'alarm_cleared');
  }
}

export async function evaluateAlarmForTagRead(tag: Tag, device: Device, value: number | null, quality: 'good' | 'bad' | 'uncertain' | 'unknown') {
  // Limit alarms are evaluated only on good quality values. Bad/uncertain reads do not create generated alarms.
  if (quality !== 'good') return;
  const hasLimitAlarm = tag.alarmHigh !== null && tag.alarmHigh !== undefined
    || tag.alarmLow !== null && tag.alarmLow !== undefined;
  if (!hasLimitAlarm) return;

  const prisma = getPrismaClient();
  const evaluation = evaluateLimitAlarm(tag, value);

  if (!evaluation) {
    await clearActiveLimitAlarms(tag);
    return;
  }

  await clearActiveLimitAlarms(tag, evaluation.alarmType);

  const activeAlarm = await prisma.alarm.findFirst({
    where: {
      tagId: tag.id,
      alarmType: evaluation.alarmType,
      status: 'active'
    }
  });

  if (activeAlarm) {
    await prisma.alarm.update({
      where: { id: activeAlarm.id },
      data: {
        severity: evaluation.severity,
        message: evaluation.message,
        limitValue: evaluation.limitValue,
        triggerValue: evaluation.triggerValue
      }
    });
    return;
  }

  const createdAlarm = await prisma.alarm.create({
    data: {
      projectId: tag.projectId,
      deviceId: device.id,
      tagId: tag.id,
      alarmType: evaluation.alarmType,
      severity: evaluation.severity,
      status: 'active',
      acknowledged: false,
      message: evaluation.message,
      limitValue: evaluation.limitValue,
      triggerValue: evaluation.triggerValue,
      startedAt: new Date()
    }
  });

  await notifyAlarmEvent(createdAlarm.id, 'alarm_raised');

  appendEngineLog('warn', 'Alarm raised from real tag value', {
    projectId: tag.projectId,
    deviceId: device.id,
    deviceName: device.name,
    tagId: tag.id,
    tagName: tag.name,
    alarmType: evaluation.alarmType,
    limitValue: evaluation.limitValue,
    triggerValue: evaluation.triggerValue
  });
}

export async function readAlarms(filter: AlarmFilter = {}) {
  const prisma = getPrismaClient();
  const limit = Math.min(Math.max(Number(filter.limit ?? 200), 1), 1000);
  const status = filter.status === 'history' ? 'cleared' : filter.status;

  const alarms = await prisma.alarm.findMany({
    where: {
      ...(filter.projectId ? { projectId: filter.projectId } : {}),
      ...(status && status !== 'all' ? { status } : {})
    },
    include: { tag: true, device: true },
    orderBy: [{ status: 'asc' }, { startedAt: 'desc' }],
    take: limit
  });

  return alarms.map((alarm) => ({
    id: alarm.id,
    projectId: alarm.projectId,
    deviceId: alarm.deviceId,
    deviceName: alarm.device.name,
    tagId: alarm.tagId,
    tagName: alarm.tag.name,
    unit: alarm.tag.unit,
    alarmType: alarm.alarmType,
    severity: alarm.severity,
    status: alarm.status,
    acknowledged: alarm.acknowledged,
    message: alarm.message,
    limitValue: alarm.limitValue,
    triggerValue: alarm.triggerValue,
    startedAt: alarm.startedAt.toISOString(),
    endedAt: alarm.endedAt?.toISOString() ?? null,
    ackAt: alarm.ackAt?.toISOString() ?? null,
    ackUser: alarm.ackUser
  }));
}

export async function readAlarmSummary(projectId?: string) {
  const prisma = getPrismaClient();
  const [active, unacknowledged, cleared] = await Promise.all([
    prisma.alarm.count({ where: { ...(projectId ? { projectId } : {}), status: 'active' } }),
    prisma.alarm.count({ where: { ...(projectId ? { projectId } : {}), status: 'active', acknowledged: false } }),
    prisma.alarm.count({ where: { ...(projectId ? { projectId } : {}), status: 'cleared' } })
  ]);

  return {
    active,
    unacknowledged,
    cleared
  };
}

export async function acknowledgeAlarm(id: string, user?: string) {
  const prisma = getPrismaClient();
  const alarm = await prisma.alarm.findUnique({ where: { id } });
  if (!alarm) return { error: 'Alarm not found.' };

  const updated = await prisma.alarm.update({
    where: { id },
    data: {
      acknowledged: true,
      ackAt: new Date(),
      ackUser: user?.trim() || 'operator'
    }
  });
  await notifyAlarmEvent(id, 'alarm_acknowledged');
  return updated;
}
