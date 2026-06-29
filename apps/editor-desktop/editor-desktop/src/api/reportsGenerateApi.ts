import { getEngineUrl } from '@energylink/shared-ui';

export type GeneratedReportResult = {
  reportId: string;
  reportName: string;
  format: string;
  fileName: string;
  downloadUrl: string;
  sizeBytes: number;
  generatedAt: string;
  period: { from: string; to: string; label: string };
  source?: {
    historyCount: number;
    alarmCount: number;
  };
};

async function requestJson<T>(path: string, init?: RequestInit): Promise<{ ok: true; data: T } | { ok: false; message: string }> {
  try {
    const response = await fetch(`${getEngineUrl()}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { ok: false, message: typeof data?.message === 'string' ? data.message : `HTTP ${response.status}` };
    }
    return { ok: true, data: data as T };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}

export const reportsGenerateApi = {
  generate: (
    reportId: string,
    body: {
      format?: 'pdf' | 'excel';
      from?: string;
      to?: string;
      tariffId?: string;
      requestedBy?: string;
    },
  ) =>
    requestJson<{ generated: GeneratedReportResult }>(`/api/reports/${encodeURIComponent(reportId)}/generate`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
};
