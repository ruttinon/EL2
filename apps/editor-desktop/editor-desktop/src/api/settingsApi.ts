import { getEngineUrl } from './engineConnectionApi';

export type RuntimeWriteMode = 'normal' | 'read_only';
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type EngineRuntimeConfig = {
  engineName: string;
  apiHost: string;
  port: number;
  databasePath: string;
  dataFolder: string;
  logFolder: string;
  graphicsFolder: string;
  reportsFolder: string;
  imagesFolder: string;
  autoStart: boolean;
  logLevel: LogLevel;
  serviceMode: boolean;
  pollingEnabled: boolean;
  pollingScanIntervalMs: number;
  historyLoggingEnabled: boolean;
  historyRetentionDays: number;
  logRetentionDays: number;
  backupRetentionDays: number;
  webViewerEnabled: boolean;
  allowRemoteWebViewer: boolean;
  requireAuthentication: boolean;
  defaultTimezone: string;
  runtimeWriteMode: RuntimeWriteMode;
};

export type RuntimeConfigValidation = {
  valid: boolean;
  errors: string[];
  warnings: string[];
};

export type RuntimeConfigResponse = {
  config: EngineRuntimeConfig;
  validation: RuntimeConfigValidation;
  configPath?: string;
  folders?: Record<string, string>;
  changedKeys?: string[];
  restartRequired?: boolean;
  message?: string;
};

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
  if (!response.ok) {
    throw new Error(typeof data?.error === 'string' ? data.error : typeof data?.message === 'string' ? data.message : `HTTP ${response.status}`);
  }
  return data as T;
}

export const settingsApi = {
  getRuntimeConfig: () => requestJson<RuntimeConfigResponse>('/api/settings/runtime'),
  validateRuntimeConfig: (config: Partial<EngineRuntimeConfig>) =>
    requestJson<RuntimeConfigResponse>('/api/settings/runtime/validate', { method: 'POST', body: JSON.stringify(config) }),
  saveRuntimeConfig: (config: Partial<EngineRuntimeConfig>) =>
    requestJson<RuntimeConfigResponse>('/api/settings/runtime', { method: 'PUT', body: JSON.stringify(config) })
};
