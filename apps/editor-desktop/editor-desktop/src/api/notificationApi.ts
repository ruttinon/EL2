import { getEngineUrl } from '@energylink/shared-ui';

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {};
  if (init?.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (init?.headers) {
    Object.assign(headers, init.headers as Record<string, string>);
  }

  const response = await fetch(`${getEngineUrl()}${path}`, {
    ...init,
    headers,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof data?.message === 'string' ? data.message : `HTTP ${response.status}`);
  }
  return data as T;
}

export type NotificationChannel = {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
  configJson?: string | null;
};

export type NotificationRule = {
  id: string;
  name: string;
  channelId: string;
  enabled: boolean;
  eventType: string;
  minSeverity?: string | null;
};

export const notificationApi = {
  listChannels: async () => (await requestJson<{ channels: NotificationChannel[] }>('/api/notifications/channels')).channels,
  createChannel: async (input: Partial<NotificationChannel>) =>
    (await requestJson<{ channel: NotificationChannel }>('/api/notifications/channels', {
      method: 'POST',
      body: JSON.stringify(input),
    })).channel,
  listRules: async () => (await requestJson<{ rules: NotificationRule[] }>('/api/notifications/rules')).rules,
  createRule: async (input: Partial<NotificationRule>) =>
    (await requestJson<{ rule: NotificationRule }>('/api/notifications/rules', {
      method: 'POST',
      body: JSON.stringify(input),
    })).rule,
};
