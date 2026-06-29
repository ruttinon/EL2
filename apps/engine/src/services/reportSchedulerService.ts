import type { ReportSchedule } from '@prisma/client';
import { getPrismaClient } from './database.js';
import { appendEngineLog } from './engineLogger.js';
import { generateReport } from './reportGenerationService.js';

type ReportScheduleFrequency = ReportSchedule['frequency'];

let timer: NodeJS.Timeout | undefined;
let running = false;

function parseFormats(value: string) {
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.map(String).filter((item) => item === 'pdf' || item === 'excel');
  } catch {}
  return ['pdf'];
}

function parseTime(value: string) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value || '06:00');
  const h = match ? Math.max(0, Math.min(23, Number(match[1]))) : 6;
  const m = match ? Math.max(0, Math.min(59, Number(match[2]))) : 0;
  return { h, m };
}

export function calculateNextRun(schedule: Pick<ReportSchedule, 'frequency' | 'timeOfDay' | 'dayOfWeek' | 'dayOfMonth'>, from = new Date()) {
  const { h, m } = parseTime(schedule.timeOfDay);
  const base = new Date(from);
  const candidate = new Date(base);
  candidate.setSeconds(0, 0);
  candidate.setHours(h, m, 0, 0);

  const frequency = schedule.frequency as ReportScheduleFrequency;
  if (frequency === 'daily') {
    if (candidate <= base) candidate.setDate(candidate.getDate() + 1);
    return candidate;
  }
  if (frequency === 'weekly') {
    const target = schedule.dayOfWeek ?? 1;
    const current = candidate.getDay();
    let add = (target - current + 7) % 7;
    if (add === 0 && candidate <= base) add = 7;
    candidate.setDate(candidate.getDate() + add);
    return candidate;
  }
  const day = Math.max(1, Math.min(28, schedule.dayOfMonth ?? 1));
  candidate.setDate(day);
  if (candidate <= base) {
    candidate.setMonth(candidate.getMonth() + 1);
    candidate.setDate(day);
  }
  return candidate;
}

function toDto(schedule: any) {
  return {
    ...schedule,
    formats: parseFormats(schedule.formatsJson),
    reportName: schedule.report?.name,
    createdAt: schedule.createdAt?.toISOString?.() ?? schedule.createdAt,
    updatedAt: schedule.updatedAt?.toISOString?.() ?? schedule.updatedAt,
    lastRunAt: schedule.lastRunAt ? schedule.lastRunAt.toISOString() : null,
    nextRunAt: schedule.nextRunAt ? schedule.nextRunAt.toISOString() : null
  };
}

function toRunDto(run: any) {
  return {
    ...run,
    reportName: run.report?.name,
    scheduleName: run.schedule?.name ?? null,
    startedAt: run.startedAt?.toISOString?.() ?? run.startedAt,
    finishedAt: run.finishedAt ? run.finishedAt.toISOString() : null
  };
}

export async function listReportSchedules(projectId?: string) {
  const prisma = getPrismaClient();
  const schedules = await prisma.reportSchedule.findMany({
    where: projectId ? { projectId } : undefined,
    include: { report: true },
    orderBy: [{ status: 'asc' }, { nextRunAt: 'asc' }, { name: 'asc' }]
  });
  return schedules.map(toDto);
}

export async function createReportSchedule(input: any) {
  if (!input?.reportId || !input?.name) throw new Error('reportId and name are required.');
  const prisma = getPrismaClient();
  const report = await prisma.report.findUnique({ where: { id: input.reportId } });
  if (!report) throw new Error(`Report not found: ${input.reportId}`);
  const nextRunAt = calculateNextRun({ frequency: input.frequency ?? 'daily', timeOfDay: input.timeOfDay ?? '06:00', dayOfWeek: input.dayOfWeek ?? null, dayOfMonth: input.dayOfMonth ?? null });
  const schedule = await prisma.reportSchedule.create({
    data: {
      projectId: input.projectId ?? report.projectId,
      reportId: report.id,
      name: String(input.name).trim(),
      status: input.status ?? 'enabled',
      frequency: input.frequency ?? 'daily',
      timeOfDay: input.timeOfDay ?? '06:00',
      dayOfWeek: input.dayOfWeek ?? null,
      dayOfMonth: input.dayOfMonth ?? null,
      formatsJson: JSON.stringify(input.formats && input.formats.length ? input.formats : ['pdf']),
      dateRange: input.dateRange ?? 'report_default',
      nextRunAt
    },
    include: { report: true }
  });
  appendEngineLog('info', 'Report schedule created', { scheduleId: schedule.id, reportId: report.id, nextRunAt });
  return toDto(schedule);
}

export async function updateReportSchedule(id: string, input: any) {
  const prisma = getPrismaClient();
  const current = await prisma.reportSchedule.findUnique({ where: { id } });
  if (!current) throw new Error(`Report schedule not found: ${id}`);
  const frequency = input.frequency ?? current.frequency;
  const timeOfDay = input.timeOfDay ?? current.timeOfDay;
  const dayOfWeek = input.dayOfWeek !== undefined ? input.dayOfWeek : current.dayOfWeek;
  const dayOfMonth = input.dayOfMonth !== undefined ? input.dayOfMonth : current.dayOfMonth;
  const shouldRecalculate = input.frequency !== undefined || input.timeOfDay !== undefined || input.dayOfWeek !== undefined || input.dayOfMonth !== undefined || input.status === 'enabled';
  const schedule = await prisma.reportSchedule.update({
    where: { id },
    data: {
      name: input.name !== undefined ? String(input.name).trim() : undefined,
      status: input.status,
      frequency,
      timeOfDay,
      dayOfWeek,
      dayOfMonth,
      formatsJson: input.formats ? JSON.stringify(input.formats) : undefined,
      dateRange: input.dateRange,
      nextRunAt: shouldRecalculate ? calculateNextRun({ frequency, timeOfDay, dayOfWeek, dayOfMonth }) : undefined
    },
    include: { report: true }
  });
  appendEngineLog('info', 'Report schedule updated', { scheduleId: schedule.id });
  return toDto(schedule);
}

export async function deleteReportSchedule(id: string) {
  const prisma = getPrismaClient();
  const schedule = await prisma.reportSchedule.delete({ where: { id }, include: { report: true } });
  appendEngineLog('info', 'Report schedule deleted', { scheduleId: id });
  return toDto(schedule);
}

export async function listReportScheduleRuns(query: { projectId?: string; scheduleId?: string; limit?: number }) {
  const prisma = getPrismaClient();
  const runs = await prisma.reportScheduleRun.findMany({
    where: {
      ...(query.projectId ? { projectId: query.projectId } : {}),
      ...(query.scheduleId ? { scheduleId: query.scheduleId } : {})
    },
    include: { report: true, schedule: true },
    orderBy: { startedAt: 'desc' },
    take: Math.max(1, Math.min(200, query.limit ?? 100))
  });
  return runs.map(toRunDto);
}

export async function runReportScheduleNow(id: string, requestedBy = 'manual') {
  const prisma = getPrismaClient();
  const schedule = await prisma.reportSchedule.findUnique({ where: { id }, include: { report: true } });
  if (!schedule) throw new Error(`Report schedule not found: ${id}`);
  const formats = parseFormats(schedule.formatsJson);
  const results = [];
  for (const format of formats) {
    const run = await prisma.reportScheduleRun.create({
      data: { projectId: schedule.projectId, scheduleId: schedule.id, reportId: schedule.reportId, status: 'running', format }
    });
    try {
      const generated = await generateReport({ reportId: schedule.reportId, format, requestedBy: `schedule:${requestedBy}` });
      const updated = await prisma.reportScheduleRun.update({
        where: { id: run.id },
        data: { status: 'success', finishedAt: new Date(), generatedFileName: generated.fileName, generatedFilePath: generated.filePath },
        include: { report: true, schedule: true }
      });
      results.push(toRunDto(updated));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const updated = await prisma.reportScheduleRun.update({
        where: { id: run.id },
        data: { status: 'failed', finishedAt: new Date(), error: message },
        include: { report: true, schedule: true }
      });
      results.push(toRunDto(updated));
      appendEngineLog('error', 'Scheduled report run failed', { scheduleId: id, format, message });
    }
  }
  await prisma.reportSchedule.update({
    where: { id: schedule.id },
    data: { lastRunAt: new Date(), nextRunAt: calculateNextRun(schedule) }
  });
  return results;
}

export async function processDueReportSchedules() {
  if (running) return;
  running = true;
  try {
    const prisma = getPrismaClient();
    const now = new Date();
    const due = await prisma.reportSchedule.findMany({
      where: { status: 'enabled', OR: [{ nextRunAt: null }, { nextRunAt: { lte: now } }] },
      take: 25
    });
    for (const schedule of due) await runReportScheduleNow(schedule.id, 'automatic');
  } finally {
    running = false;
  }
}

export function startReportScheduler() {
  if (timer) return;
  timer = setInterval(() => void processDueReportSchedules().catch((error) => appendEngineLog('error', 'Report scheduler cycle failed', { message: error instanceof Error ? error.message : String(error) })), 60_000);
  void processDueReportSchedules().catch(() => undefined);
  appendEngineLog('info', 'Report scheduler service started', { intervalMs: 60000 });
}

export function stopReportScheduler(reason = 'shutdown') {
  if (timer) clearInterval(timer);
  timer = undefined;
  appendEngineLog('info', 'Report scheduler service stopped', { reason });
}
