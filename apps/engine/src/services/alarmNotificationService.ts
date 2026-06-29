import type {
  Alarm,
  AlarmNotificationChannel,
  AlarmNotificationEvent
} from '@prisma/client';
import { appendEngineLog } from './engineLogger.js';
import { getPrismaClient } from './database.js';

type AlarmNotificationChannelType = AlarmNotificationChannel['type'];
type AlarmNotificationDeliveryStatus = AlarmNotificationEvent['status'];
type AlarmNotificationEventType = AlarmNotificationEvent['eventType'];
type AlarmSeverity = Alarm['severity'];

type ChannelInput = {
  projectId?: string | null;
  name: string;
  type: AlarmNotificationChannelType;
  enabled?: boolean;
  configJson?: string | Record<string, unknown>;
};

type RuleInput = {
  projectId?: string | null;
  channelId: string;
  name: string;
  enabled?: boolean;
  eventType: AlarmNotificationEventType;
  minSeverity?: AlarmSeverity;
};

function parseJsonObject(value: string | Record<string, unknown> | undefined): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function stringifyConfig(value: string | Record<string, unknown> | undefined) {
  if (!value) return '{}';
  if (typeof value === 'string') {
    JSON.parse(value || '{}');
    return value || '{}';
  }
  return JSON.stringify(value);
}

function severityRank(severity: AlarmSeverity) {
  if (severity === 'high') return 3;
  if (severity === 'medium') return 2;
  return 1;
}

function shouldNotify(alarmSeverity: AlarmSeverity, minSeverity: AlarmSeverity) {
  return severityRank(alarmSeverity) >= severityRank(minSeverity);
}

function buildAlarmMessage(alarm: any, eventType: AlarmNotificationEventType) {
  const tagName = alarm.tag?.name ?? alarm.tagId;
  const deviceName = alarm.device?.name ?? alarm.deviceId;
  const prefix = eventType === 'alarm_raised' ? 'ALARM RAISED' : eventType === 'alarm_cleared' ? 'ALARM CLEARED' : 'ALARM ACKNOWLEDGED';
  return `${prefix}: ${alarm.severity.toUpperCase()} ${alarm.alarmType} alarm on ${deviceName}.${tagName}. ${alarm.message}`;
}

async function sendWebhook(channel: AlarmNotificationChannel, message: string) {
  const config = parseJsonObject(channel.configJson);
  const url = typeof config.url === 'string' ? config.url.trim() : '';
  if (!url) return { status: 'skipped' as AlarmNotificationDeliveryStatus, error: 'Webhook URL is not configured.' };
  const method = typeof config.method === 'string' ? config.method.toUpperCase() : 'POST';
  const headers = config.headers && typeof config.headers === 'object' ? config.headers as Record<string, string> : {};
  try {
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ source: 'EnergyLink Management', channel: channel.name, message, timestamp: new Date().toISOString() })
    });
    if (!response.ok) return { status: 'failed' as AlarmNotificationDeliveryStatus, error: `Webhook returned HTTP ${response.status}.` };
    return { status: 'delivered' as AlarmNotificationDeliveryStatus };
  } catch (error) {
    return { status: 'failed' as AlarmNotificationDeliveryStatus, error: error instanceof Error ? error.message : String(error) };
  }
}

async function sendEmail(channel: AlarmNotificationChannel, message: string) {
  const config = parseJsonObject(channel.configJson);
  const smtpHost = typeof config.smtpHost === 'string' ? config.smtpHost.trim() : '';
  const smtpPort = Number(config.smtpPort ?? 587);
  const from = typeof config.from === 'string' ? config.from.trim() : '';
  const to = typeof config.to === 'string' ? config.to.trim() : '';
  if (!smtpHost || !from || !to) return { status: 'skipped' as AlarmNotificationDeliveryStatus, error: 'SMTP host, from, and to fields are required.' };

  try {
    const nodemailer = await import('nodemailer');
    const transporter = nodemailer.default.createTransport({
      host: smtpHost,
      port: Number.isFinite(smtpPort) ? smtpPort : 587,
      secure: Boolean(config.secure),
    });
    await transporter.sendMail({
      from,
      to,
      subject: `EnergyLink Alarm Notification - ${channel.name}`,
      text: message
    });
    return { status: 'delivered' as AlarmNotificationDeliveryStatus };
  } catch (error) {
    return { status: 'failed' as AlarmNotificationDeliveryStatus, error: error instanceof Error ? error.message : String(error) };
  }
}

async function deliver(channel: AlarmNotificationChannel, message: string) {
  if (channel.type === 'sound') return { status: 'pending' as AlarmNotificationDeliveryStatus };
  if (channel.type === 'webhook') return sendWebhook(channel, message);
  if (channel.type === 'email') return sendEmail(channel, message);
  return { status: 'skipped' as AlarmNotificationDeliveryStatus, error: `Unsupported notification channel type: ${channel.type}` };
}

export async function notifyAlarmEvent(alarmId: string, eventType: AlarmNotificationEventType) {
  const prisma = getPrismaClient();
  const alarm = await prisma.alarm.findUnique({
    where: { id: alarmId },
    include: { tag: true, device: true }
  });
  if (!alarm) return { count: 0, message: 'Alarm not found.' };

  const rules = await prisma.alarmNotificationRule.findMany({
    where: {
      enabled: true,
      eventType,
      OR: [{ projectId: null }, { projectId: alarm.projectId }],
      channel: { enabled: true }
    },
    include: { channel: true }
  });

  const message = buildAlarmMessage(alarm, eventType);
  let count = 0;
  for (const rule of rules) {
    if (!shouldNotify(alarm.severity, rule.minSeverity)) continue;
    const result = await deliver(rule.channel, message);
    await prisma.alarmNotificationEvent.create({
      data: {
        projectId: alarm.projectId,
        alarmId: alarm.id,
        channelId: rule.channelId,
        eventType,
        status: result.status,
        message,
        error: result.error ?? null,
        deliveredAt: result.status === 'delivered' ? new Date() : null
      }
    });
    count += 1;
    appendEngineLog(result.status === 'failed' ? 'error' : 'info', 'Alarm notification processed', {
      alarmId: alarm.id,
      eventType,
      channelId: rule.channelId,
      channelType: rule.channel.type,
      status: result.status,
      error: result.error
    });
  }
  return { count, message };
}

export async function listNotificationChannels(projectId?: string) {
  const prisma = getPrismaClient();
  return prisma.alarmNotificationChannel.findMany({
    where: { ...(projectId ? { OR: [{ projectId }, { projectId: null }] } : {}) },
    orderBy: [{ type: 'asc' }, { name: 'asc' }]
  });
}

export async function createNotificationChannel(input: ChannelInput) {
  const prisma = getPrismaClient();
  return prisma.alarmNotificationChannel.create({
    data: {
      projectId: input.projectId ?? null,
      name: input.name.trim(),
      type: input.type,
      enabled: input.enabled ?? true,
      configJson: stringifyConfig(input.configJson)
    }
  });
}

export async function updateNotificationChannel(id: string, input: Partial<ChannelInput>) {
  const prisma = getPrismaClient();
  return prisma.alarmNotificationChannel.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.type !== undefined ? { type: input.type } : {}),
      ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
      ...(input.configJson !== undefined ? { configJson: stringifyConfig(input.configJson) } : {})
    }
  });
}

export async function deleteNotificationChannel(id: string) {
  const prisma = getPrismaClient();
  return prisma.alarmNotificationChannel.delete({ where: { id } });
}

export async function listNotificationRules(projectId?: string) {
  const prisma = getPrismaClient();
  return prisma.alarmNotificationRule.findMany({
    where: { ...(projectId ? { OR: [{ projectId }, { projectId: null }] } : {}) },
    include: { channel: true },
    orderBy: [{ eventType: 'asc' }, { name: 'asc' }]
  });
}

export async function createNotificationRule(input: RuleInput) {
  const prisma = getPrismaClient();
  return prisma.alarmNotificationRule.create({
    data: {
      projectId: input.projectId ?? null,
      channelId: input.channelId,
      name: input.name.trim(),
      enabled: input.enabled ?? true,
      eventType: input.eventType,
      minSeverity: input.minSeverity ?? 'low'
    },
    include: { channel: true }
  });
}

export async function updateNotificationRule(id: string, input: Partial<RuleInput>) {
  const prisma = getPrismaClient();
  return prisma.alarmNotificationRule.update({
    where: { id },
    data: {
      ...(input.channelId !== undefined ? { channelId: input.channelId } : {}),
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
      ...(input.eventType !== undefined ? { eventType: input.eventType } : {}),
      ...(input.minSeverity !== undefined ? { minSeverity: input.minSeverity } : {})
    },
    include: { channel: true }
  });
}

export async function deleteNotificationRule(id: string) {
  const prisma = getPrismaClient();
  return prisma.alarmNotificationRule.delete({ where: { id } });
}

export async function listNotificationEvents(query: { projectId?: string; status?: AlarmNotificationDeliveryStatus | 'all'; channelType?: AlarmNotificationChannelType; limit?: string } = {}) {
  const prisma = getPrismaClient();
  const limit = Math.min(Math.max(Number(query.limit ?? 200), 1), 1000);
  return prisma.alarmNotificationEvent.findMany({
    where: {
      ...(query.projectId ? { projectId: query.projectId } : {}),
      ...(query.status && query.status !== 'all' ? { status: query.status } : {}),
      ...(query.channelType ? { channel: { type: query.channelType } } : {})
    },
    include: { alarm: { include: { tag: true, device: true } }, channel: true },
    orderBy: { createdAt: 'desc' },
    take: limit
  });
}

export async function listPendingSoundNotifications(projectId?: string) {
  return listNotificationEvents({ projectId, status: 'pending', channelType: 'sound', limit: '50' });
}

export async function markNotificationDelivered(id: string) {
  const prisma = getPrismaClient();
  return prisma.alarmNotificationEvent.update({
    where: { id },
    data: { status: 'delivered', deliveredAt: new Date(), error: null }
  });
}
