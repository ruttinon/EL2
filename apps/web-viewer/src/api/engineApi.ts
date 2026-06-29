import { getEngineUrl } from './engineConnectionApi';
import { getOperatorRole } from '@energylink/shared-ui';
import type {
  AlarmsResponse,
  ApiResult,
  ApiStatus,
  CurrentValuesResponse,
  GeneratedReportsResponse,
  GraphicSummary,
  ReportSummary,
  RuntimeDevice,
  RuntimeGraphicResponse,
  RuntimePollingStatus,
  TrendResponse
} from '../types/webViewer';

async function requestJson<T>(apiPath: string, init?: RequestInit): Promise<ApiResult<T>> {
  try {
    const headers: Record<string, string> = {};
    if (init?.body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }
    if (init?.headers) {
      Object.assign(headers, init.headers);
    }

    const response = await fetch(`${getEngineUrl()}${apiPath}`, {
      ...init,
      headers
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        ok: false,
        statusCode: response.status,
        message:
          typeof data?.message === 'string'
            ? data.message
            : typeof data?.error === 'string'
              ? data.error
              : `HTTP ${response.status}`
      };
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

  getDevices: async () => {
    const result = await requestJson<{ devices: RuntimeDevice[] }>('/api/devices');
    if (!result.ok) return result;
    return { ok: true as const, data: Array.isArray(result.data.devices) ? result.data.devices : [] };
  },

  getCurrentValues: () => requestJson<CurrentValuesResponse>('/api/tags/current'),

  getRuntimeStatus: () => requestJson<RuntimePollingStatus>('/api/runtime/polling/status'),
  startPolling: () => requestJson<RuntimePollingStatus>('/api/runtime/polling/start', { method: 'POST' }),
  stopPolling: () => requestJson<RuntimePollingStatus>('/api/runtime/polling/stop', { method: 'POST' }),
  runReadCycle: () => requestJson<{ ok: boolean; runtime: RuntimePollingStatus }>('/api/runtime/read-cycle', { method: 'POST' }),

  getGraphics: async () => {
    const result = await requestJson<{ graphics: GraphicSummary[] }>('/api/graphics');
    if (!result.ok) return result;
    return { ok: true as const, data: Array.isArray(result.data.graphics) ? result.data.graphics : [] };
  },

  getDefaultGraphic: () => requestJson<RuntimeGraphicResponse>('/api/graphics/default'),
  getGraphic: (id: string) => requestJson<RuntimeGraphicResponse>(`/api/graphics/${encodeURIComponent(id)}`),

  getAlarms: () => requestJson<AlarmsResponse>('/api/alarms'),
  acknowledgeAlarm: (id: string) =>
    requestJson<{ ok: boolean; alarm?: unknown }>(`/api/alarms/${encodeURIComponent(id)}/acknowledge`, {
      method: 'POST',
      body: JSON.stringify({ source: 'web-viewer' })
    }),

  getTrend: (tagId?: string) =>
    requestJson<TrendResponse>(tagId ? `/api/trend?tagId=${encodeURIComponent(tagId)}` : '/api/trend'),

  getReports: async () => {
    const result = await requestJson<{ reports: ReportSummary[] }>('/api/reports');
    if (!result.ok) return result;
    return { ok: true as const, data: Array.isArray(result.data.reports) ? result.data.reports : [] };
  },

  generateReport: (id: string, format: 'pdf' | 'excel') =>
    requestJson<{ generated: unknown }>(`/api/reports/${encodeURIComponent(id)}/generate`, {
      method: 'POST',
      body: JSON.stringify({ format, requestedBy: 'web-viewer' })
    }),

  getGeneratedReports: () => requestJson<GeneratedReportsResponse>('/api/reports/generated'),

  writeTag: (tagId: string, value: number | boolean) => {
    const role = getOperatorRole();
    return requestJson<{ ok: boolean; message?: string }>(`/api/tags/${encodeURIComponent(tagId)}/write`, {
      method: 'POST',
      headers: { 'X-Operator-Role': role },
      body: JSON.stringify({ value }),
    });
  },
};
