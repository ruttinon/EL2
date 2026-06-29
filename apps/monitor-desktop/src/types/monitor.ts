export type ApiStatus = {
  name?: string;
  status?: string;
  phase?: string;
  runtimeSource?: string;
  uptimeSeconds?: number;
  timestamp?: string;
  folders?: Record<string, string>;
  engine?: Record<string, unknown>;
};

export type CommunicationCapabilities = {
  phase?: string;
  runtimeSource?: string;
  polling?: string;
  supportedProtocols?: Array<{
    protocol: string;
    connectionTest: boolean;
    readOnce: boolean;
    notes?: string;
  }>;
  reservedProtocols?: Array<{
    protocol: string;
    connectionTest: boolean;
    readOnce: boolean;
    notes?: string;
  }>;
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
  serialPort?: string | null;
  peripheralNumber?: number | null;
  parentDeviceId?: string | null;
  parent?: Pick<RuntimeDevice, 'id' | 'name' | 'type' | 'protocol' | 'ipAddress' | 'port' | 'serialPort'> | null;
  model?: string | null;
  tags?: RuntimeTag[];
  /** Optional device photo URL (future Editor field). */
  imageUrl?: string | null;
  imageDataUrl?: string | null;
  thumbnailUrl?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type RuntimeTag = {
  id: string;
  name: string;
  description?: string | null;
  address: string;
  registerType: string;
  dataType: string;
  unit?: string | null;
  scale?: number | null;
  offset?: number | null;
  decimalPlaces?: number | null;
  historyEnabled?: boolean;
  alarmHigh?: number | null;
  alarmLow?: number | null;
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

export type RuntimeGraphic = GraphicSummary & {
  layout: GraphicLayout;
};

export type RuntimeGraphicResponse = {
  graphic: RuntimeGraphic;
  runtime: {
    currentValues: string;
    polling: string;
    runtimeSource: string;
    note: string;
  };
};


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

export type RuntimeReportResponse = {
  report: ReportSummary & { template?: unknown };
  runtime: {
    generation: string;
    historicalValues: string;
    runtimeSource: string;
    note: string;
  };
};

export type GeneratedReportFile = {
  fileName: string;
  sizeBytes: number;
  createdAt: string;
  updatedAt: string;
  downloadUrl: string;
};

export type ReportGenerationResult = {
  reportId: string;
  reportName: string;
  format: string;
  fileName: string;
  downloadUrl: string;
  sizeBytes: number;
  generatedAt: string;
  period: { from: string; to: string; label: string };
  source: { historyCount: number; alarmCount: number; runtimeSource: string; generatedData: boolean };
};

export type ReportGenerationResponse = {
  generated: ReportGenerationResult;
};

export type GeneratedReportsResponse = {
  files: GeneratedReportFile[];
  runtimeSource: string;
  generatedData: boolean;
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
  manualStop: boolean;
  pollingEnabled: boolean;
  historyLoggingEnabled: boolean;
  pollingScanIntervalMs: number;
  runtimeSource: string;
  startedAt?: string;
  stoppedAt?: string;
  lastCycleAt?: string;
  lastCycleDurationMs?: number;
  cycles: number;
  successfulReads: number;
  failedReads: number;
  lastError?: string;
};

export type CurrentValuesResponse = {
  values: CurrentTagValue[];
  runtime: RuntimePollingStatus;
};

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

export type TrendResponse = {
  tagId: string;
  count: number;
  values: TrendPoint[];
};

export type RuntimeAlarm = {
  id: string;
  projectId: string;
  deviceId: string;
  deviceName: string;
  tagId: string;
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

export type AlarmSummary = {
  active: number;
  unacknowledged: number;
  cleared: number;
  runtimeSource: string;
};

export type AlarmsResponse = {
  alarms: RuntimeAlarm[];
  summary: AlarmSummary;
  runtimeSource: string;
};

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string; statusCode?: number };
