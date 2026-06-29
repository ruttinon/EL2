import React from 'react';
import {
  LayoutDashboard,
  MonitorPlay,
  TrendingUp,
  BellRing,
  FileBarChart2,
  Cpu,
  type LucideIcon,
} from 'lucide-react';
import { UiIcon } from './components/UiIcon';
import { currentEngineUrl } from './api/engineApi';
import type { CarbonSummaryResponse, CarbonBreakdownResponse } from './api/engineApi';
import type {
  ApiStatus,
  AlarmSummary,
  CommunicationCapabilities,
  CurrentTagValue,
  GeneratedReportFile,
  GraphicSummary,
  ReportSummary,
  RuntimeAlarm,
  RuntimeGraphicResponse,
  RuntimePollingStatus,
} from './types/monitor';

export type ViewKey = 'dashboard' | 'graphics' | 'trend' | 'alarm' | 'report' | 'devices';
export type ConnectionState = 'ok' | 'warn' | 'bad' | 'neutral';

type ApiMessage = { statusCode?: number; message: string };

export type MonitorState = {
  engineUrl: string;
  activeView: ViewKey;
  loading: boolean;
  refreshSeconds: number;
  lastRefresh?: string;
  status?: ApiStatus;
  health?: ApiStatus;
  capabilities?: CommunicationCapabilities;
  pollingStatus?: RuntimePollingStatus;
  devices: any[];
  graphics: GraphicSummary[];
  reports: ReportSummary[];
  generatedReports: GeneratedReportFile[];
  currentValues: CurrentTagValue[];
  alarms: RuntimeAlarm[];
  alarmSummary?: AlarmSummary;
  selectedDeviceId?: string | null;
  activeGraphicId?: string;
  runtimeGraphic?: RuntimeGraphicResponse;
  reportActionMessage?: string;
  graphicsStatus?: ApiMessage;
  currentValuesStatus?: ApiMessage;
  alarmsStatus?: ApiMessage;
  error?: string;
  powerHistory: Array<{ time: string; value: number }>;
  carbonSummary?: CarbonSummaryResponse;
  carbonBreakdown?: CarbonBreakdownResponse;
};

function navIcon(Icon: LucideIcon) {
  return <UiIcon icon={Icon} size="md" />;
}

export const NAV_ITEMS: Array<{ key: ViewKey; label: string; icon: React.ReactNode }> = [
  { key: 'dashboard', label: 'Dashboard', icon: navIcon(LayoutDashboard) },
  { key: 'graphics', label: 'Graphics', icon: navIcon(MonitorPlay) },
  { key: 'trend', label: 'Trend', icon: navIcon(TrendingUp) },
  { key: 'alarm', label: 'Alarm', icon: navIcon(BellRing) },
  { key: 'report', label: 'Report', icon: navIcon(FileBarChart2) },
  { key: 'devices', label: 'Devices', icon: navIcon(Cpu) },
];

export function connectionStatus(state: MonitorState): ConnectionState {
  if (state.loading) return 'neutral';
  if (state.error) return 'bad';
  if (state.status || state.health) return 'ok';
  return 'warn';
}

export function defaultState(): MonitorState {
  return {
    engineUrl: currentEngineUrl(),
    activeView: 'dashboard',
    loading: false,
    refreshSeconds: 2,
    selectedDeviceId: undefined,
    devices: [],
    graphics: [],
    reports: [],
    generatedReports: [],
    currentValues: [],
    alarms: [],
    powerHistory: [],
  };
}
