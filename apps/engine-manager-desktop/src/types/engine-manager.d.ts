export type ServiceStatus = {
  installed: boolean;
  state: string;
  raw: string;
};

export type ActionResult = {
  ok: boolean;
  message?: string;
  path?: string;
};

export type EngineConfig = {
  engineName: string;
  apiHost: string;
  port: number;
  databasePath: string;
  dataFolder: string;
  logFolder: string;
  graphicsFolder: string;
  reportsFolder: string;
  imagesFolder: string;
  driversFolder: string;
  autoStart: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
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
  runtimeWriteMode: 'normal' | 'read_only';
};

export type EngineConfigValidation = {
  valid: boolean;
  errors: string[];
  warnings: string[];
};

export type RuntimeSettingsResult = {
  config: EngineConfig;
  validation: EngineConfigValidation;
  configPath: string;
};

export type RuntimeSettingsSaveResult = RuntimeSettingsResult & {
  ok: boolean;
  message: string;
  changedKeys?: string[];
  restartRequired: boolean;
};

declare global {
  interface Window {
    engineManagerApi: {
      getServiceStatus: () => Promise<ServiceStatus>;
      startService: () => Promise<ActionResult>;
      stopService: () => Promise<ActionResult>;
      restartService: () => Promise<ActionResult>;
      openProgramData: () => Promise<ActionResult>;
      openLogs: () => Promise<ActionResult>;
      openConfig: () => Promise<ActionResult>;
      openEngineUrl: () => Promise<void>;
      readRecentLogLines: (limit?: number) => Promise<string[]>;
      readRuntimeSettings: () => Promise<RuntimeSettingsResult>;
      saveRuntimeSettings: (config: Partial<EngineConfig>) => Promise<RuntimeSettingsSaveResult>;
    };
  }
}
