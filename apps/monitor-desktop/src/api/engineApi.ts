import {
  getEngineUrl,
  getOperatorRole,
  setEngineUrl as persistEngineUrl,
  syncEngineUrlFromEngine,
  probeEngineUrl,
} from '@energylink/shared-ui';
import type {
  ApiResult,
  ApiStatus,
  CommunicationCapabilities,
  CurrentValuesResponse,
  GraphicSummary,
  ReportSummary,
  RuntimeDevice,
  RuntimeGraphicResponse,
  RuntimeReportResponse,
  TrendResponse,
  AlarmsResponse,
  ReportGenerationResponse,
  GeneratedReportsResponse,
  RuntimePollingStatus,
  RuntimeAlarm
} from '../types/monitor';

export type CarbonConfigIssue = {
  code: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  messageTh: string;
};

export type CarbonSummaryResponse = {
  projectId?: string | null;
  projectName?: string | null;
  facilityType?: string;
  floorAreaM2?: number | null;
  emissionFactorKgPerKwh: number;
  netMetering: boolean;
  kWhQualified: number;
  carbonKg: number;
  importKwh: number;
  exportKwh: number;
  netKwh: number;
  strategy: 'site_main' | 'include_in_carbon' | 'fallback_all_kwh';
  deviceCount: number;
  tagCount: number;
  warnings?: string[];
  configIssues?: CarbonConfigIssue[];
  dataSource?: 'live' | 'history';
  period?: string;
  from?: string;
  to?: string;
  computedAt?: string;
  energyCostRate?: number;
  currency?: string;
  carbonIntensityKgPerM2?: number | null;
  estimatedEnergyCost?: number | null;
};

export type CarbonBreakdownResponse = {
  projectId: string;
  by: 'loadCategory' | 'device' | 'source';
  items: Array<{
    key: string;
    label: string;
    deviceId?: string;
    kWh: number;
    carbonKg: number;
    sharePct: number;
  }>;
  totalKwh: number;
  totalCarbonKg: number;
  emissionFactorKgPerKwh: number;
  period: string;
  from?: string;
  to?: string;
  dataSource: 'live' | 'history';
  strategy: 'site_main' | 'include_in_carbon' | 'fallback_all_kwh';
  computedAt?: string;
};

export type CarbonPeriod = 'live' | 'today' | '7d' | '30d';

function carbonQueryParams(options?: {
  projectId?: string;
  period?: CarbonPeriod;
  from?: string;
  to?: string;
  by?: 'loadCategory' | 'device' | 'source';
}) {
  const params = new URLSearchParams();
  if (options?.projectId) params.set('projectId', options.projectId);
  if (options?.period) params.set('period', options.period);
  if (options?.from) params.set('from', options.from);
  if (options?.to) params.set('to', options.to);
  if (options?.by) params.set('by', options.by);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export { getEngineUrl as currentEngineUrl, probeEngineUrl };

export function setEngineUrl(url: string) {
  persistEngineUrl(url);
}

async function requestJson<T>(apiPath: string, init?: RequestInit): Promise<ApiResult<T>> {
  const url = `${getEngineUrl()}${apiPath}`;

  try {
    const response = await fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {})
      }
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        ok: false,
        statusCode: response.status,
        message:
          typeof data?.error === 'string'
            ? data.error
            : typeof data?.message === 'string'
              ? data.message
              : `HTTP ${response.status}`
      };
    }

    if (apiPath === '/api/health' || apiPath === '/api/status') {
      syncEngineUrlFromEngine(data as { apiBaseUrl?: string; apiPort?: number });
    }

    return { ok: true, data: data as T };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : String(error)
    };
  }
}

export const engineApi = {
  getStatus: () => requestJson<ApiStatus>('/api/status'),
  getHealth: () => requestJson<ApiStatus>('/api/health'),
  getCapabilities: () => requestJson<CommunicationCapabilities>('/api/communication/capabilities'),

  getDevices: async () => {
    const result = await requestJson<{ devices: RuntimeDevice[] }>('/api/devices');
    if (!result.ok) return result;
    return { ok: true as const, data: result.data.devices ?? [] };
  },

  getGraphics: async () => {
    const result = await requestJson<{ graphics: GraphicSummary[] }>('/api/graphics');
    if (!result.ok) return result;
    return { ok: true as const, data: result.data.graphics ?? [] };
  },

  getDefaultGraphic: () => requestJson<RuntimeGraphicResponse>('/api/graphics/default'),
  getGraphic: (id: string) => requestJson<RuntimeGraphicResponse>(`/api/graphics/${encodeURIComponent(id)}`),

  getPublished: (projectId: string) =>
    requestJson<{
      meta:     { version: number; label: string | null; publishedAt: string; publishedBy: string | null };
      devices:  unknown[];
      tags:     unknown[];
      graphics: GraphicSummary[];
      reports:  ReportSummary[];
    }>(`/api/projects/${encodeURIComponent(projectId)}/published`),

  getPublishedHistory: (projectId: string) =>
    requestJson<{
      snapshots: Array<{ version: number; label: string | null; publishedAt: string; publishedBy: string | null }>;
    }>(`/api/projects/${encodeURIComponent(projectId)}/published/history`),

  getReports: async () => {
    const result = await requestJson<{ reports: ReportSummary[] }>('/api/reports');
    if (!result.ok) return result;
    return { ok: true as const, data: result.data.reports ?? [] };
  },

  getDefaultReport: () => requestJson<RuntimeReportResponse>('/api/reports/default'),
  getReport: (id: string) => requestJson<RuntimeReportResponse>(`/api/reports/${encodeURIComponent(id)}`),

  generateReport: (id: string, format: 'pdf' | 'excel') =>
    requestJson<ReportGenerationResponse>(`/api/reports/${encodeURIComponent(id)}/generate`, {
      method: 'POST',
      body: JSON.stringify({ format, requestedBy: 'monitor' })
    }),

  getGeneratedReports: () => requestJson<GeneratedReportsResponse>('/api/reports/generated'),
  getCurrentValues: () => requestJson<CurrentValuesResponse>('/api/tags/current'),
  getAlarms: () => requestJson<AlarmsResponse>('/api/alarms'),
  getTrend: (options: { tagId: string; from?: string; to?: string; limit?: number }) => {
    const params = new URLSearchParams({ tagId: options.tagId });
    if (options.from) params.set('from', options.from);
    if (options.to) params.set('to', options.to);
    if (options.limit) params.set('limit', String(options.limit));
    return requestJson<TrendResponse>(`/api/trend?${params.toString()}`);
  },

  startPolling: () => requestJson<RuntimePollingStatus>('/api/runtime/polling/start', { method: 'POST' }),
  stopPolling: () => requestJson<RuntimePollingStatus>('/api/runtime/polling/stop', { method: 'POST' }),
  getPollingStatus: () => requestJson<RuntimePollingStatus>('/api/runtime/polling/status'),

  acknowledgeAlarm: (id: string) =>
    requestJson<{ alarm: RuntimeAlarm }>(`/api/alarms/${encodeURIComponent(id)}/acknowledge`, {
      method: 'POST',
      body: JSON.stringify({ user: 'local-monitor' })
    }),

  writeTag: (tagId: string, value: number | boolean) => {
    const role = getOperatorRole();
    return requestJson<{ ok: boolean; message?: string }>(`/api/tags/${encodeURIComponent(tagId)}/write`, {
      method: 'POST',
      headers: { 'X-Operator-Role': role },
      body: JSON.stringify({ value }),
    });
  },

  getCarbonSummary: (options?: { projectId?: string; period?: CarbonPeriod; from?: string; to?: string }) =>
    requestJson<CarbonSummaryResponse>(`/api/carbon/summary${carbonQueryParams(options)}`),

  getCarbonBreakdown: (options?: {
    projectId?: string;
    period?: CarbonPeriod;
    from?: string;
    to?: string;
    by?: 'loadCategory' | 'device' | 'source';
  }) => requestJson<CarbonBreakdownResponse>(`/api/carbon/breakdown${carbonQueryParams(options)}`),

  backfillCarbonTagRoles: (options?: { projectId?: string; dryRun?: boolean }) =>
    requestJson<{
      ok: boolean;
      projectId: string;
      dryRun: boolean;
      scanned: number;
      updated: number;
      samples: Array<{ id: string; name: string; unit: string | null; role: string }>;
    }>('/api/carbon/backfill-tag-roles', {
      method: 'POST',
      body: JSON.stringify(options ?? {}),
    }),

  generateCarbonReport: (options?: {
    projectId?: string;
    period?: CarbonPeriod;
    format?: 'pdf' | 'excel';
    from?: string;
    to?: string;
    requestedBy?: string;
  }) =>
    requestJson<{
      generated: {
        projectId: string;
        projectName: string;
        format: 'pdf' | 'excel';
        fileName: string;
        downloadUrl: string;
        sizeBytes: number;
        generatedAt: string;
        period: { label: string; from?: string; to?: string };
        summary: { kWhQualified: number; carbonKg: number; emissionFactorKgPerKwh: number };
      };
    }>('/api/carbon/report/generate', {
      method: 'POST',
      body: JSON.stringify(options ?? {}),
    }),
};

export type PendingSoundNotification = {
  id: string;
  message: string;
  eventType: string;
  status: string;
  createdAt: string;
  alarm?: { id: string; severity: string; message: string };
  channel?: { id: string; name: string; type: string } | null;
};

export const notificationApi = {
  getPendingSound: async () => {
    const result = await requestJson<{ events: PendingSoundNotification[] }>('/api/notifications/pending?channelType=sound');
    if (!result.ok) return result;
    return { ok: true as const, data: result.data.events ?? [] };
  },

  markDelivered: (id: string) =>
    requestJson<{ event: PendingSoundNotification }>(`/api/notifications/events/${encodeURIComponent(id)}/mark-delivered`, {
      method: 'POST'
    })
};
