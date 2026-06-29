import { useEffect, useState } from 'react';
import type { ActionResult, EngineConfig, EngineConfigValidation, ServiceStatus } from './types/engine-manager';
import { buildEngineUrl, getEngineUrl, setEngineUrl } from './engineUrl';

type BackupRow = { id: string; createdAt: string | null; fileCount: number | null; manifestValid: boolean };
type RestorePreview = { id: string; fileCount: number; requiresConfirmation: string; warnings: string[]; restoreTargets: Array<{ name: string; targetDir: string; existsInBackup: boolean }> };
type MaintenancePreviewItem = { jobType: string; retentionDays?: number; cutoff?: string; rows?: number; files?: number; folders?: number; note?: string };
type MaintenanceRun = { id: string; jobType: string; status: string; startedAt: string; finishedAt: string | null; deletedRows: number; deletedFiles: number; error?: string | null };
type ConfigKey = keyof EngineConfig;

function stateClass(state?: string) {
  if (state === 'running' || state === 'running-local') return 'good';
  if (state === 'stopped') return 'bad';
  if (state === 'not-installed' || state === 'unsupported-platform') return 'warn';
  return 'neutral';
}

export function App() {
  const [status, setStatus] = useState<ServiceStatus | null>(null);
  const [message, setMessage] = useState('Ready');
  const [logs, setLogs] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [backups, setBackups] = useState<BackupRow[]>([]);
  const [restorePreview, setRestorePreview] = useState<RestorePreview | null>(null);
  const [confirmation, setConfirmation] = useState('');
  const [maintenanceItems, setMaintenanceItems] = useState<MaintenancePreviewItem[]>([]);
  const [maintenanceRuns, setMaintenanceRuns] = useState<MaintenanceRun[]>([]);
  const [selectedJobs, setSelectedJobs] = useState<string[]>(['history_retention', 'log_retention', 'backup_retention', 'database_vacuum']);
  const [settings, setSettings] = useState<EngineConfig | null>(null);
  const [settingsPath, setSettingsPath] = useState('');
  const [settingsValidation, setSettingsValidation] = useState<EngineConfigValidation | null>(null);
  const [settingsDirty, setSettingsDirty] = useState(false);

  async function refresh() {
    const next = await window.engineManagerApi.getServiceStatus();
    setStatus(next);
    const recent = await window.engineManagerApi.readRecentLogLines(120);
    setLogs(recent);
    try {
      const response = await fetch(`${getEngineUrl()}/api/backups`);
      if (response.ok) {
        const payload = await response.json();
        setBackups(payload.backups ?? []);
      }
    } catch {
      setBackups([]);
    }
    try {
      const response = await fetch(`${getEngineUrl()}/api/maintenance/preview`);
      if (response.ok) {
        const payload = await response.json();
        setMaintenanceItems(payload.items ?? []);
        setMaintenanceRuns(payload.latestRuns ?? []);
      }
    } catch {
      setMaintenanceItems([]);
    }
  }

  async function loadRuntimeSettings() {
    try {
      const result = await window.engineManagerApi.readRuntimeSettings();
      setSettings(result.config);
      setEngineUrl(buildEngineUrl('localhost', result.config.port));
      setSettingsPath(result.configPath);
      setSettingsValidation(result.validation);
      setSettingsDirty(false);
    } catch (error) {
      setMessage(`Load runtime settings failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async function runAction(label: string, action: () => Promise<ActionResult | void>) {
    setBusy(true);
    setMessage(`${label}...`);
    try {
      const result = await action();
      if (result && 'ok' in result) setMessage(result.ok ? `${label} completed` : `${label} failed: ${result.message ?? ''}`);
      else setMessage(`${label} completed`);
    } catch (error) {
      setMessage(`${label} failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy(false);
      await refresh();
    }
  }

  async function createBackup() {
    await runAction('Create backup', async () => {
      const response = await fetch(`${getEngineUrl()}/api/backups`, { method: 'POST' });
      if (!response.ok) throw new Error(`Engine API returned ${response.status}`);
      return { ok: true, message: 'Backup created' };
    });
  }

  async function deleteBackup(id: string) {
    await runAction('Delete backup', async () => {
      const response = await fetch(`${getEngineUrl()}/api/backups/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!response.ok) throw new Error(`Engine API returned ${response.status}`);
      return { ok: true, message: 'Backup deleted' };
    });
  }

  async function previewRestore(id: string) {
    await runAction('Load restore preview', async () => {
      const response = await fetch(`${getEngineUrl()}/api/backups/${encodeURIComponent(id)}/restore-preview`);
      if (!response.ok) throw new Error(`Engine API returned ${response.status}`);
      const payload = await response.json();
      setRestorePreview(payload);
      setConfirmation('');
      return { ok: true, message: 'Restore preview loaded' };
    });
  }

  async function restoreSelectedBackup() {
    if (!restorePreview) return;
    await runAction('Restore backup', async () => {
      const response = await fetch(`${getEngineUrl()}/api/backups/${encodeURIComponent(restorePreview.id)}/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation })
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? `Engine API returned ${response.status}`);
      }
      setRestorePreview(null);
      setConfirmation('');
      return { ok: true, message: 'Backup restored' };
    });
  }

  function updateSetting(key: ConfigKey, value: EngineConfig[ConfigKey]) {
    setSettings((current) => current ? { ...current, [key]: value } : current);
    setSettingsDirty(true);
  }

  function updateNumberSetting(key: ConfigKey, value: string) {
    updateSetting(key, Number(value) as EngineConfig[ConfigKey]);
  }

  async function saveRuntimeSettings() {
    if (!settings) return;
    await runAction('Save runtime settings', async () => {
      const result = await window.engineManagerApi.saveRuntimeSettings(settings);
      setSettings(result.config);
      setEngineUrl(buildEngineUrl('localhost', result.config.port));
      setSettingsPath(result.configPath);
      setSettingsValidation(result.validation);
      if (result.ok) setSettingsDirty(false);
      return { ok: result.ok, message: result.message };
    });
  }

  function toggleJob(job: string) {
    setSelectedJobs((current) => current.includes(job) ? current.filter((item) => item !== job) : [...current, job]);
  }

  async function runMaintenance() {
    await runAction('Run maintenance', async () => {
      const response = await fetch(`${getEngineUrl()}/api/maintenance/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobs: selectedJobs })
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? `Engine API returned ${response.status}`);
      }
      return { ok: true, message: 'Maintenance completed' };
    });
  }

  useEffect(() => {
    refresh();
    loadRuntimeSettings();
    const timer = window.setInterval(refresh, 10000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="app">
      <header className="titlebar">
        <div className="logo">ENL</div>
        <div>
          <h1>EnergyLink Engine Manager</h1>
          <p>Service control and local runtime inspection</p>
        </div>
      </header>

      <main className="content">
        <section className="card hero">
          <div>
            <div className="label">Windows Service</div>
            <div className={`service-state ${stateClass(status?.state)}`}>{status?.state ?? 'loading'}</div>
            <div className="subtext">Service name: <b>EnergyLinkEngine</b></div>
          </div>
          <button className="button secondary" onClick={refresh} disabled={busy}>Refresh</button>
        </section>

        <section className="grid">
          <div className="card">
            <h2>Service Actions</h2>
            <p className="subtext">These actions call the installed Windows service. Administrator rights may be required by Windows.</p>
            <div className="button-row">
              <button className="button primary" onClick={() => runAction('Start service', window.engineManagerApi.startService)} disabled={busy}>Start</button>
              <button className="button danger" onClick={() => runAction('Stop service', window.engineManagerApi.stopService)} disabled={busy}>Stop</button>
              <button className="button" onClick={() => runAction('Restart service', window.engineManagerApi.restartService)} disabled={busy}>Restart</button>
            </div>
          </div>

          <div className="card">
            <h2>Folders and API</h2>
            <p className="subtext">Open installed runtime folders and the local Engine API status endpoint.</p>
            <div className="button-grid">
              <button className="button" onClick={() => runAction('Open ProgramData', window.engineManagerApi.openProgramData)} disabled={busy}>ProgramData</button>
              <button className="button" onClick={() => runAction('Open logs', window.engineManagerApi.openLogs)} disabled={busy}>Logs</button>
              <button className="button" onClick={() => runAction('Open config', window.engineManagerApi.openConfig)} disabled={busy}>engine.json</button>
              <button className="button" onClick={() => runAction('Open Engine API', window.engineManagerApi.openEngineUrl)} disabled={busy}>API Status</button>
            </div>
          </div>
        </section>

        <section className="card">
          <div className="section-title-row">
            <div>
              <h2>Runtime Settings</h2>
              <p className="subtext">{settingsPath || 'engine.json'}</p>
            </div>
            <div className="button-row compact">
              <button className="button secondary" onClick={loadRuntimeSettings} disabled={busy}>Reload</button>
              <button className="button primary" onClick={saveRuntimeSettings} disabled={busy || !settings || !settingsDirty}>Save Settings</button>
            </div>
          </div>

          {!settings ? (
            <div className="subtext">Loading runtime settings...</div>
          ) : (
            <>
              <div className="settings-grid">
                <label className="field">
                  <span>Engine name</span>
                  <input value={settings.engineName} onChange={(event) => updateSetting('engineName', event.target.value)} />
                </label>
                <label className="field">
                  <span>API host</span>
                  <input value={settings.apiHost} onChange={(event) => updateSetting('apiHost', event.target.value)} />
                </label>
                <label className="field">
                  <span>API port</span>
                  <input type="number" min="1" max="65535" value={settings.port} onChange={(event) => updateNumberSetting('port', event.target.value)} />
                </label>
                <label className="field">
                  <span>Timezone</span>
                  <input value={settings.defaultTimezone} onChange={(event) => updateSetting('defaultTimezone', event.target.value)} />
                </label>
                <label className="field">
                  <span>Log level</span>
                  <select value={settings.logLevel} onChange={(event) => updateSetting('logLevel', event.target.value as EngineConfig['logLevel'])}>
                    <option value="debug">debug</option>
                    <option value="info">info</option>
                    <option value="warn">warn</option>
                    <option value="error">error</option>
                  </select>
                </label>
                <label className="field">
                  <span>Runtime write mode</span>
                  <select value={settings.runtimeWriteMode} onChange={(event) => updateSetting('runtimeWriteMode', event.target.value as EngineConfig['runtimeWriteMode'])}>
                    <option value="normal">normal</option>
                    <option value="read_only">read_only</option>
                  </select>
                </label>
              </div>

              <div className="toggle-grid">
                <label><input type="checkbox" checked={settings.autoStart} onChange={(event) => updateSetting('autoStart', event.target.checked)} /> Auto start</label>
                <label><input type="checkbox" checked={settings.serviceMode} onChange={(event) => updateSetting('serviceMode', event.target.checked)} /> Service mode</label>
                <label><input type="checkbox" checked={settings.pollingEnabled} onChange={(event) => updateSetting('pollingEnabled', event.target.checked)} /> Polling enabled</label>
                <label><input type="checkbox" checked={settings.historyLoggingEnabled} onChange={(event) => updateSetting('historyLoggingEnabled', event.target.checked)} /> History logging</label>
                <label><input type="checkbox" checked={settings.webViewerEnabled} onChange={(event) => updateSetting('webViewerEnabled', event.target.checked)} /> Web viewer</label>
                <label><input type="checkbox" checked={settings.allowRemoteWebViewer} onChange={(event) => updateSetting('allowRemoteWebViewer', event.target.checked)} /> Remote web viewer</label>
                <label><input type="checkbox" checked={settings.requireAuthentication} onChange={(event) => updateSetting('requireAuthentication', event.target.checked)} /> Require authentication</label>
              </div>

              <div className="settings-grid numeric-grid">
                <label className="field">
                  <span>Polling interval (ms)</span>
                  <input type="number" min="250" value={settings.pollingScanIntervalMs} onChange={(event) => updateNumberSetting('pollingScanIntervalMs', event.target.value)} />
                </label>
                <label className="field">
                  <span>History retention (days)</span>
                  <input type="number" min="1" value={settings.historyRetentionDays} onChange={(event) => updateNumberSetting('historyRetentionDays', event.target.value)} />
                </label>
                <label className="field">
                  <span>Log retention (days)</span>
                  <input type="number" min="1" value={settings.logRetentionDays} onChange={(event) => updateNumberSetting('logRetentionDays', event.target.value)} />
                </label>
                <label className="field">
                  <span>Backup retention (days)</span>
                  <input type="number" min="1" value={settings.backupRetentionDays} onChange={(event) => updateNumberSetting('backupRetentionDays', event.target.value)} />
                </label>
              </div>

              <div className="path-grid">
                {([
                  ['databasePath', 'Database path'],
                  ['dataFolder', 'Data folder'],
                  ['logFolder', 'Log folder'],
                  ['graphicsFolder', 'Graphics folder'],
                  ['reportsFolder', 'Reports folder'],
                  ['imagesFolder', 'Images folder'],
                  ['driversFolder', 'Drivers folder']
                ] as Array<[ConfigKey, string]>).map(([key, label]) => (
                  <label className="field" key={key}>
                    <span>{label}</span>
                    <input value={String(settings[key] ?? '')} onChange={(event) => updateSetting(key, event.target.value as EngineConfig[ConfigKey])} />
                  </label>
                ))}
              </div>

              {settingsValidation?.errors.length ? (
                <div className="validation-box bad">{settingsValidation.errors.map((item) => <div key={item}>{item}</div>)}</div>
              ) : null}
              {settingsValidation?.warnings.length ? (
                <div className="validation-box warn">{settingsValidation.warnings.map((item) => <div key={item}>{item}</div>)}</div>
              ) : null}
            </>
          )}
        </section>

        <section className="card">
          <div className="section-title-row">
            <div>
              <h2>Data Retention and Maintenance</h2>
              <p className="subtext">Clean old history rows, old log files and expired backup folders using retention days from engine.json. No runtime values are generated by this process.</p>
            </div>
            <button className="button primary" onClick={runMaintenance} disabled={busy || selectedJobs.length === 0}>Run Selected</button>
          </div>
          <div className="maintenance-grid">
            {maintenanceItems.map((item) => (
              <label className="maintenance-card" key={item.jobType}>
                <input type="checkbox" checked={selectedJobs.includes(item.jobType)} onChange={() => toggleJob(item.jobType)} />
                <div>
                  <b>{item.jobType}</b>
                  <div className="subtext">Retention: {item.retentionDays ?? '-'} days | cutoff: {item.cutoff ?? '-'}</div>
                  <div className="subtext">Rows: {item.rows ?? '-'} | Files: {item.files ?? item.folders ?? '-'}</div>
                  {item.note ? <div className="subtext">{item.note}</div> : null}
                </div>
              </label>
            ))}
          </div>
          <h3>Recent Maintenance Runs</h3>
          <div className="simple-list">
            {maintenanceRuns.length === 0 ? <div className="subtext">No maintenance runs yet.</div> : maintenanceRuns.slice(0, 8).map((run) => (
              <div className="list-row" key={run.id}>
                <div><b>{run.jobType}</b><div className="subtext">{run.startedAt} | {run.status}{run.error ? ` | ${run.error}` : ''}</div></div>
                <div className="subtext">rows {run.deletedRows} | files {run.deletedFiles}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <div className="section-title-row">
            <div>
              <h2>Backup and Restore</h2>
              <p className="subtext">Create backups from ProgramData and restore a selected backup with explicit confirmation. Restore creates a pre-restore backup automatically.</p>
            </div>
            <button className="button primary" onClick={createBackup} disabled={busy}>Create Backup</button>
          </div>
          <div className="backup-list">
            {backups.length === 0 ? <div className="subtext">No backups found or Engine API is not reachable.</div> : backups.map((backup) => (
              <div className="backup-row" key={backup.id}>
                <div>
                  <b>{backup.id}</b>
                  <div className="subtext">{backup.createdAt ?? 'No manifest'} | files: {backup.fileCount ?? '-'}</div>
                </div>
                <div className="button-row compact">
                  <button className="button small" onClick={() => previewRestore(backup.id)} disabled={busy || !backup.manifestValid}>Restore...</button>
                  <button className="button danger small" onClick={() => deleteBackup(backup.id)} disabled={busy}>Delete</button>
                </div>
              </div>
            ))}
          </div>
          {restorePreview ? (
            <div className="restore-panel">
              <h3>Restore Preview: {restorePreview.id}</h3>
              <p className="subtext">This operation replaces config, data, graphics, reports and images. Logs and backup folders are not overwritten.</p>
              <ul>
                {restorePreview.restoreTargets.map((target) => (
                  <li key={target.name}><b>{target.name}</b>: {target.existsInBackup ? 'included' : 'empty folder will be created'} -&gt; {target.targetDir}</li>
                ))}
              </ul>
              <div className="warning-box">Type <b>{restorePreview.requiresConfirmation}</b> to confirm restore.</div>
              <input className="confirm-input" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder={restorePreview.requiresConfirmation} />
              <div className="button-row">
                <button className="button danger" onClick={restoreSelectedBackup} disabled={busy || confirmation !== restorePreview.requiresConfirmation}>Restore Backup</button>
                <button className="button secondary" onClick={() => setRestorePreview(null)} disabled={busy}>Cancel</button>
              </div>
            </div>
          ) : null}
        </section>

        <section className="card">
          <h2>Recent Engine Log</h2>
          <pre className="logbox">{logs.join('\n')}</pre>
        </section>

        <section className="card">
          <h2>Raw Service Status</h2>
          <pre className="rawbox">{status?.raw ?? ''}</pre>
        </section>
      </main>

      <footer className="statusbar">
        <span>{message}</span>
        <span>Engine API: {getEngineUrl()}</span>
      </footer>
    </div>
  );
}

