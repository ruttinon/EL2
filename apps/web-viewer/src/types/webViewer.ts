export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string; statusCode?: number };

export type ApiStatus = {
  app?: string;
  status?: string;
  phase?: string;
  uptimeSeconds?: number;
  timestamp?: string;
  databaseExists?: boolean;
  folders?: Record<string, string>;
};

export type RuntimeDevice = {
  id: string;
  name: string;
  description?: string | null;
  type: string;
  protocol: string;
  status?: string;
  ipAddress?: string | null;
  port?: number | null;
  peripheralNumber?: number | null;
  parentDeviceId?: string | null;
  tags?: RuntimeTag[];
};

export type RuntimeTag = {
  id: string;
  name: string;
  description?: string | null;
  address: string;
  registerType: string;
  dataType: string;
  unit?: string | null;
  decimalPlaces?: number | null;
  historyEnabled?: boolean;
  alarmHigh?: number | null;
  alarmLow?: number | null;
};

export type CurrentTagValue = {
  id: string;
  projectId: string;
  deviceId: string;
  deviceName: string;
  name: string;
  description?: string | null;
  value?: number | null;
  unit?: string | null;
  quality: string;
  lastValueAt?: string | null;
  registerType: string;
  dataType: string;
  decimalPlaces?: number | null;
  historyEnabled?: boolean;
};

export type RuntimePollingStatus = {
  running: boolean;
  cycleRunning: boolean;
  pollingEnabled: boolean;
  historyLoggingEnabled: boolean;
  pollingScanIntervalMs: number;
  startedAt?: string;
  stoppedAt?: string;
  lastCycleAt?: string;
  successfulReads: number;
  failedReads: number;
  lastError?: string;
};

export type CurrentValuesResponse = {
  values: CurrentTagValue[];
  runtime: RuntimePollingStatus;
};

export type GraphicSummary = {
  id: string;
  projectId: string;
  name: string;
  description?: string | null;
  width: number;
  height: number;
  refreshIntervalMs: number;
  isDefault: boolean;
  updatedAt?: string;
};

export type GraphicObject = {
  id: string;
  type: string;
  name?: string;
  text?: string;
  tagId?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  visible?: boolean;
  locked?: boolean;
  style?: Record<string, string | number | boolean | undefined>;
};

import type { GraphicLayout } from '@energylink/shared-types';

export type { GraphicLayout } from '@energylink/shared-types';

export type RuntimeGraphic = GraphicSummary & { layout: GraphicLayout };
export type RuntimeGraphicResponse = { graphic: RuntimeGraphic; runtime?: Record<string, unknown> };

export type RuntimeAlarm = {
  id: string;
  deviceName: string;
  tagName: string;
  unit?: string | null;
  alarmType: string;
  severity: string;
  status: string;
  acknowledged: boolean;
  message: string;
  limitValue?: number | null;
  triggerValue?: number | null;
  startedAt: string;
  endedAt?: string | null;
  ackAt?: string | null;
  ackUser?: string | null;
};

export type AlarmSummary = { active: number; unacknowledged: number; cleared: number };
export type AlarmsResponse = { alarms: RuntimeAlarm[]; summary: AlarmSummary };

export type TrendPoint = {
  id: string;
  tagId: string;
  tagName: string;
  deviceId: string;
  deviceName: string;
  value?: number | null;
  unit?: string | null;
  quality: string;
  readAt: string;
  error?: string | null;
};
export type TrendResponse = { tagId: string; count: number; values: TrendPoint[] };

export type ReportSummary = {
  id: string;
  projectId: string;
  name: string;
  description?: string | null;
  reportType: string;
  paperSize: string;
  orientation: string;
  defaultDateRange: string;
  outputFormat: string;
  isDefault: boolean;
  updatedAt?: string;
};

export type GeneratedReportFile = {
  fileName: string;
  sizeBytes: number;
  createdAt: string;
  updatedAt: string;
  downloadUrl: string;
};
export type GeneratedReportsResponse = { files: GeneratedReportFile[] };
