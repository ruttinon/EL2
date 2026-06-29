import React from 'react';
import {
  Zap,
  Activity,
  AlertTriangle,
  Cpu,
  Radio,
  CheckCircle2,
  ChevronRight,
} from 'lucide-react';
import { UiIcon } from '../components/UiIcon';
import {
  PowerTrendChart,
  DevicePowerBarChart,
  DeviceStatusDonut,
  CommunicationDonut,
} from '../components/DashboardCharts';
import {
  KpiAlarmAccent,
  KpiCommAccent,
  KpiDeviceAccent,
  KpiPowerAccent,
} from '../components/KpiAccents';
import { CarbonDashboardSection } from '../components/CarbonDashboardSection';
import type { CarbonPeriod } from '../components/CarbonPeriodPicker';
import { engineApi, type CarbonBreakdownResponse, type CarbonSummaryResponse } from '../api/engineApi';
import { DashboardDeviceTree } from '../components/DashboardDeviceTree';
import {
  countDevicesByStatus,
  topDevicePowerItems,
  type RuntimeIndexes,
} from '../utils/runtimeIndexes';
import { SCALE } from '../utils/scaleConfig';
import {
  calculateTotalPower,
  commQualityPercent,
  computeEnergyKwh,
} from '../utils/dashboardMetrics';
import type { MonitorState } from '../appShared';
import type { ConnectionState } from '../appShared';

export type DashboardViewProps = {
  state: MonitorState;
  indexes: RuntimeIndexes;
  rootCount: number;
  childCount: number;
  tagCount: number;
  connStatus: ConnectionState;
  onWriteTag: (tagId: string, tagName: string, dataType: string) => void;
  onAcknowledge: (id: string) => void;
  onSelectDevice: (deviceId: string) => void;
  onOpenDevices: () => void;
};

export function DashboardView({
  state,
  indexes,
  tagCount,
  onAcknowledge,
  onSelectDevice,
  onOpenDevices,
}: DashboardViewProps) {
  const [carbonPeriod, setCarbonPeriod] = React.useState<CarbonPeriod>('live');
  const [periodCarbon, setPeriodCarbon] = React.useState<CarbonSummaryResponse | undefined>();
  const [periodBreakdown, setPeriodBreakdown] = React.useState<CarbonBreakdownResponse | undefined>();
  const [periodLoading, setPeriodLoading] = React.useState(false);

  React.useEffect(() => {
    if (carbonPeriod === 'live') return;
    let cancelled = false;
    async function loadPeriodData() {
      setPeriodLoading(true);
      const [summaryRes, breakdownRes] = await Promise.all([
        engineApi.getCarbonSummary({ period: carbonPeriod }),
        engineApi.getCarbonBreakdown({ period: carbonPeriod, by: 'loadCategory' }),
      ]);
      if (cancelled) return;
      setPeriodCarbon(summaryRes.ok ? summaryRes.data : undefined);
      setPeriodBreakdown(breakdownRes.ok ? breakdownRes.data : undefined);
      setPeriodLoading(false);
    }
    void loadPeriodData();
    return () => {
      cancelled = true;
    };
  }, [carbonPeriod]);

  const carbonSummary = carbonPeriod === 'live' ? state.carbonSummary : periodCarbon;
  const carbonBreakdown = carbonPeriod === 'live' ? state.carbonBreakdown : periodBreakdown;
  const carbonLoading = carbonPeriod !== 'live' && periodLoading;

  const activeAlarms = state.alarmSummary?.active ?? 0;
  const totalPower =
    state.powerHistory.length > 0
      ? state.powerHistory[state.powerHistory.length - 1].value
      : calculateTotalPower(state.currentValues);
  const statusCounts = countDevicesByStatus(indexes);
  const onlineDevices = statusCounts.online;
  const warningDevices = statusCounts.warning;
  const offlineDevices = statusCounts.offline;
  const energyKwh = carbonSummary?.kWhQualified ?? computeEnergyKwh(state.currentValues);
  const commPct = commQualityPercent(state.currentValues);
  const peakDemand = state.powerHistory.reduce((max, h) => Math.max(max, h.value), totalPower);
  const isLive = state.pollingStatus?.running;
  const devicePowerItems = topDevicePowerItems(indexes, state.devices, 8);

  const handleCardMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--x', `${e.clientX - rect.left}px`);
    e.currentTarget.style.setProperty('--y', `${e.clientY - rect.top}px`);
  };

  const runtimeKpis = [
    {
      key: 'power',
      label: 'Power',
      value: totalPower.toFixed(1),
      unit: 'kW',
      icon: <UiIcon icon={Zap} size="md" className="kpi-icon teal" />,
      valueClass: 'teal',
      accent: (
        <KpiPowerAccent
          totalPowerKw={totalPower}
          peakDemandKw={peakDemand}
          history={state.powerHistory ?? []}
        />
      ),
    },
    {
      key: 'energy',
      label: 'Energy',
      value: energyKwh.toFixed(1),
      unit: 'kWh',
      icon: <UiIcon icon={Activity} size="md" className="kpi-icon teal" />,
      valueClass: 'teal',
    },
    {
      key: 'alarms',
      label: 'Alarms',
      value: String(activeAlarms),
      unit: '',
      icon: (
        <UiIcon
          icon={AlertTriangle}
          size="md"
          className={`kpi-icon ${activeAlarms > 0 ? 'red animate-pulse' : 'muted'}`}
        />
      ),
      valueClass: activeAlarms > 0 ? 'red' : 'green',
      accent: (
        <KpiAlarmAccent
          activeAlarms={activeAlarms}
          unacknowledged={state.alarmSummary?.unacknowledged ?? 0}
        />
      ),
    },
    {
      key: 'devices',
      label: 'Devices',
      value: `${onlineDevices}`,
      unit: `/ ${state.devices.length}`,
      icon: <UiIcon icon={Cpu} size="md" className="kpi-icon muted" />,
      valueClass: 'ink',
      accent: <KpiDeviceAccent online={onlineDevices} total={state.devices.length} />,
    },
    {
      key: 'comm',
      label: 'Comm',
      value: String(commPct),
      unit: '%',
      icon: <UiIcon icon={Radio} size="md" className={`kpi-icon ${commPct > 80 ? 'teal' : 'warn'}`} />,
      valueClass: commPct > 80 ? 'green' : 'amber',
      accent: <KpiCommAccent commPct={commPct} isLive={!!isLive} />,
    },
  ];

  return (
    <div className="view-stack dashboard-view dashboard-view--v2">
      <CarbonDashboardSection
        carbonSummary={carbonSummary}
        carbonBreakdown={carbonBreakdown}
        carbonPeriod={carbonPeriod}
        onPeriodChange={setCarbonPeriod}
        loading={carbonLoading}
      />

      <section className="dashboard-runtime-section">
        <div className="kpi-grid kpi-grid-runtime">
          {runtimeKpis.map((card, i) => (
            <div
              key={card.key}
              className="kpi-card kpi-card-animate kpi-card--rich"
              style={{ animationDelay: `${0.04 + i * 0.04}s` }}
              onMouseMove={handleCardMouseMove}
            >
              <div className="kpi-header">
                <span className="kpi-label">{card.label}</span>
                {card.icon}
              </div>
              <div className={`kpi-value ${card.valueClass}`}>
                {card.value}
                {card.unit && <span className="kpi-unit">{card.unit}</span>}
              </div>
              {card.accent && <div className="kpi-accent-slot">{card.accent}</div>}
            </div>
          ))}
        </div>
      </section>

      <section className="dashboard-charts-section">
        <div className="dashboard-charts-main">
          <PowerTrendChart history={state.powerHistory ?? []} />
          <DevicePowerBarChart items={devicePowerItems} />
        </div>
        <div className="dashboard-charts-aside">
          <DeviceStatusDonut online={onlineDevices} warning={warningDevices} offline={offlineDevices} />
          <CommunicationDonut quality={commPct} />
        </div>
      </section>

      <section className="dashboard-bottom-grid">
        <div className="card dashboard-alerts-card">
          <div className="card-header">
            <h2>Alarms</h2>
            {activeAlarms > 0 && <span className="badge-alert-count">{activeAlarms}</span>}
          </div>
          <div className="card-body dashboard-alert-feed">
            {state.alarms.filter(a => a.status === 'active').length === 0 ? (
              <div className="empty-alerts">
                <CheckCircle2 size={28} color="var(--green)" style={{ opacity: 0.6, marginBottom: 8 }} />
                <p>No active alarms</p>
              </div>
            ) : (
              state.alarms
                .filter(a => a.status === 'active')
                .slice(0, 4)
                .map(a => (
                  <div key={a.id} className="dashboard-alert-item">
                    <div className="alert-icon-wrap">
                      <AlertTriangle size={14} color="var(--red)" />
                    </div>
                    <div className="alert-content">
                      <div className="alert-top">
                        <span className="alert-device">{a.deviceName}</span>
                        <span className="alert-time">{new Date(a.startedAt).toLocaleTimeString()}</span>
                      </div>
                      <p className="alert-msg">{a.message}</p>
                      {!a.acknowledged && (
                        <button className="alert-ack-btn" type="button" onClick={() => onAcknowledge(a.id)}>
                          Acknowledge
                        </button>
                      )}
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>

        <div className="card dashboard-devices-card dashboard-devices-card--compact">
          <div className="card-header dashboard-devices-header">
            <div>
              <h2>Devices</h2>
            </div>
            <button
              type="button"
              className="btn-outline toolbar-btn dashboard-devices-all-btn"
              onClick={onOpenDevices}
            >
              View all
              <ChevronRight size={14} />
            </button>
          </div>
          <div className="card-body dashboard-devices-body">
            <DashboardDeviceTree
              devices={state.devices}
              indexes={indexes}
              statusCounts={statusCounts}
              powerItems={devicePowerItems}
              onSelectDevice={onSelectDevice}
            />
            {state.devices.length > SCALE.DASHBOARD_DEVICE_PREVIEW && (
              <button
                type="button"
                className="dashboard-scale-hint dashboard-scale-hint-btn"
                onClick={onOpenDevices}
              >
                {state.devices.length} devices — open full list
                <ChevronRight size={14} />
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
