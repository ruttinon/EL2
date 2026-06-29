import { getEngineUrl } from '@energylink/shared-ui';
import type { EnergyBillResult, EnergyTariffConfig } from '@energylink/shared-types';

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

export type TariffSummary = {
  id: string;
  name: string;
  description?: string | null;
  isDefault: boolean;
  effectiveFrom?: string | null;
  updatedAt?: string;
  config: EnergyTariffConfig;
};

export type TariffModeInfo = {
  id: string;
  label: string;
  description: string;
};

export type BillingSummaryResponse = EnergyBillResult & {
  projectId: string;
  projectName: string;
  period: string;
  from?: string;
  to?: string;
  dataSource: string;
  strategy: string;
  energyCostRate: number;
  estimatedCostFlat: number;
};

export const billingApi = {
  listTariffs: (projectId?: string) => {
    const qs = projectId ? `?projectId=${encodeURIComponent(projectId)}` : '';
    return requestJson<{ tariffs: TariffSummary[] }>(`/api/billing/tariffs${qs}`);
  },

  getModes: () => requestJson<{ modes: TariffModeInfo[] }>('/api/billing/modes'),

  deleteTariff: (id: string) =>
    requestJson<{ ok: boolean }>(`/api/billing/tariffs/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  simulate: (body: {
    projectId?: string;
    from?: string;
    to?: string;
    period?: 'live' | 'today' | '7d' | '30d';
    tariffId?: string;
  }) => requestJson<BillingSummaryResponse>('/api/billing/simulate', {
    method: 'POST',
    body: JSON.stringify(body),
  }),

  getSummary: (opts: { projectId?: string; from?: string; to?: string; period?: string; tariffId?: string }) => {
    const params = new URLSearchParams();
    if (opts.projectId) params.set('projectId', opts.projectId);
    if (opts.from) params.set('from', opts.from);
    if (opts.to) params.set('to', opts.to);
    if (opts.period) params.set('period', opts.period);
    if (opts.tariffId) params.set('tariffId', opts.tariffId);
    const qs = params.toString();
    return requestJson<BillingSummaryResponse>(`/api/billing/summary${qs ? `?${qs}` : ''}`);
  },

  saveTariff: (body: {
    id?: string;
    projectId?: string;
    name: string;
    description?: string;
    isDefault?: boolean;
    effectiveFrom?: string | null;
    config: EnergyTariffConfig;
  }) =>
    requestJson<{ ok: boolean; tariff: { id: string; name: string } }>('/api/billing/tariffs', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
};
