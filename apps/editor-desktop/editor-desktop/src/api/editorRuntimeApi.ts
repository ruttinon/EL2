import { getEngineUrl } from '@energylink/shared-ui';
import type { CurrentTagValue, RuntimeAlarm, TrendResponse } from '@energylink/graphics-runtime';

type CurrentValuesResponse = {
  values: CurrentTagValue[];
};

type AlarmsResponse = {
  alarms: RuntimeAlarm[];
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

export const editorRuntimeApi = {
  getCurrentValues: () => requestJson<CurrentValuesResponse>('/api/tags/current'),
  getAlarms: () => requestJson<AlarmsResponse>('/api/alarms'),
  getTrend: (opts: {
    tagId: string;
    from?: string;
    to?: string;
    limit?: number;
    points?: number;
    bucketMs?: number;
    agg?: 'avg' | 'min' | 'max' | 'first' | 'last';
  }) => {
    const params = new URLSearchParams({ tagId: opts.tagId });
    if (opts.from) params.set('from', opts.from);
    if (opts.to) params.set('to', opts.to);
    if (opts.limit) params.set('limit', String(opts.limit));
    if (opts.points) params.set('points', String(opts.points));
    if (opts.bucketMs) params.set('bucketMs', String(opts.bucketMs));
    if (opts.agg) params.set('agg', opts.agg);
    return requestJson<TrendResponse>(`/api/trend?${params.toString()}`);
  },
  acknowledgeAlarm: (id: string) =>
    requestJson<{ ok: boolean }>(`/api/alarms/${encodeURIComponent(id)}/acknowledge`, {
      method: 'POST',
      body: JSON.stringify({ user: 'editor-preview' }),
    }),
  writeTag: (tagId: string, value: number | boolean) =>
    requestJson<{ ok: boolean }>(`/api/tags/${encodeURIComponent(tagId)}/write`, {
      method: 'POST',
      body: JSON.stringify({ value }),
    }),
};

/**
 * Subscribe to real-time tag values via Server-Sent Events (P3: push instead of polling).
 * Returns an unsubscribe function. If EventSource is unavailable or the stream errors,
 * `onError` is invoked so the caller can fall back to HTTP polling.
 */
export function subscribeTagValues(
  onValues: (values: CurrentTagValue[]) => void,
  options?: { projectId?: string; deviceId?: string; onError?: () => void },
): () => void {
  if (typeof EventSource === 'undefined') {
    options?.onError?.();
    return () => {};
  }

  const params = new URLSearchParams();
  if (options?.projectId) params.set('projectId', options.projectId);
  if (options?.deviceId) params.set('deviceId', options.deviceId);
  const qs = params.toString();
  const url = `${getEngineUrl()}/api/tags/stream${qs ? `?${qs}` : ''}`;

  let closed = false;
  const source = new EventSource(url);

  source.addEventListener('values', (event) => {
    try {
      const data = JSON.parse((event as MessageEvent).data) as { values?: CurrentTagValue[] };
      if (Array.isArray(data.values)) onValues(data.values);
    } catch {
      // ignore malformed payloads
    }
  });

  source.onerror = () => {
    if (!closed) options?.onError?.();
  };

  return () => {
    closed = true;
    source.close();
  };
}

export const FLOW_STYLE_KEYS = [
  'flowColor',
  'idleColor',
  'flowThreshold',
  'flowSpeed',
  'flowGlow',
  'flowAlarmHigh',
  'alarmColor',
  'strokeWidth',
  'requireEnable',
] as const;

export type FlowStyleSnapshot = Partial<Record<(typeof FLOW_STYLE_KEYS)[number], string | number | boolean>>;

export function pickFlowStyle(style: Record<string, unknown> | undefined): FlowStyleSnapshot {
  const out: FlowStyleSnapshot = {};
  if (!style) return out;
  for (const key of FLOW_STYLE_KEYS) {
    if (style[key] !== undefined) out[key] = style[key] as string | number | boolean;
  }
  return out;
}
