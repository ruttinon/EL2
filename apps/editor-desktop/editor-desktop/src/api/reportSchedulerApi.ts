import { getEngineUrl } from '@energylink/shared-ui';

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {};
  if (init?.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (init?.headers) {
    Object.assign(headers, init.headers);
  }

  const response = await fetch(`${getEngineUrl()}${path}`, {
    ...init,
    headers
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof data?.message === 'string' ? data.message : `HTTP ${response.status}`);
  return data as T;
}

export type ReportSchedule = {
  id: string;
  projectId: string;
  reportId: string;
  reportName?: string;
  name: string;
  status: 'enabled' | 'disabled';
  frequency: 'daily' | 'weekly' | 'monthly';
  timeOfDay: string;
  dayOfWeek?: number | null;
  dayOfMonth?: number | null;
  formats: Array<'pdf' | 'excel'>;
  dateRange: string;
  lastRunAt?: string | null;
  nextRunAt?: string | null;
};

export type ReportScheduleRun = {
  id: string;
  scheduleId?: string | null;
  scheduleName?: string | null;
  reportId: string;
  reportName?: string;
  status: 'running' | 'success' | 'failed';
  format: string;
  startedAt: string;
  finishedAt?: string | null;
  generatedFileName?: string | null;
  generatedFilePath?: string | null;
  error?: string | null;
};

export const reportSchedulerApi = {
  listSchedules: async () => (await requestJson<{ schedules: ReportSchedule[] }>('/api/report-schedules')).schedules,
  createSchedule: async (input: Partial<ReportSchedule>) => (await requestJson<{ schedule: ReportSchedule }>('/api/report-schedules', { method: 'POST', body: JSON.stringify(input) })).schedule,
  updateSchedule: async (id: string, input: Partial<ReportSchedule>) => (await requestJson<{ schedule: ReportSchedule }>(`/api/report-schedules/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(input) })).schedule,
  deleteSchedule: async (id: string) => (await requestJson<{ schedule: ReportSchedule }>(`/api/report-schedules/${encodeURIComponent(id)}`, { method: 'DELETE' })).schedule,
  runNow: async (id: string) => (await requestJson<{ runs: ReportScheduleRun[] }>(`/api/report-schedules/${encodeURIComponent(id)}/run-now`, { method: 'POST' })).runs,
  listRuns: async () => (await requestJson<{ runs: ReportScheduleRun[] }>('/api/report-schedule-runs?limit=100')).runs
};



