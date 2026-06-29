import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { buildEngineUrl, getEngineUrl, setEngineUrl } from './engineUrl';
function stateClass(state) {
    if (state === 'running' || state === 'running-local')
        return 'good';
    if (state === 'stopped')
        return 'bad';
    if (state === 'not-installed' || state === 'unsupported-platform')
        return 'warn';
    return 'neutral';
}
export function App() {
    const [status, setStatus] = useState(null);
    const [message, setMessage] = useState('Ready');
    const [logs, setLogs] = useState([]);
    const [busy, setBusy] = useState(false);
    const [backups, setBackups] = useState([]);
    const [restorePreview, setRestorePreview] = useState(null);
    const [confirmation, setConfirmation] = useState('');
    const [maintenanceItems, setMaintenanceItems] = useState([]);
    const [maintenanceRuns, setMaintenanceRuns] = useState([]);
    const [selectedJobs, setSelectedJobs] = useState(['history_retention', 'log_retention', 'backup_retention', 'database_vacuum']);
    const [settings, setSettings] = useState(null);
    const [settingsPath, setSettingsPath] = useState('');
    const [settingsValidation, setSettingsValidation] = useState(null);
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
        }
        catch {
            setBackups([]);
        }
        try {
            const response = await fetch(`${getEngineUrl()}/api/maintenance/preview`);
            if (response.ok) {
                const payload = await response.json();
                setMaintenanceItems(payload.items ?? []);
                setMaintenanceRuns(payload.latestRuns ?? []);
            }
        }
        catch {
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
        }
        catch (error) {
            setMessage(`Load runtime settings failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    async function runAction(label, action) {
        setBusy(true);
        setMessage(`${label}...`);
        try {
            const result = await action();
            if (result && 'ok' in result)
                setMessage(result.ok ? `${label} completed` : `${label} failed: ${result.message ?? ''}`);
            else
                setMessage(`${label} completed`);
        }
        catch (error) {
            setMessage(`${label} failed: ${error instanceof Error ? error.message : String(error)}`);
        }
        finally {
            setBusy(false);
            await refresh();
        }
    }
    async function createBackup() {
        await runAction('Create backup', async () => {
            const response = await fetch(`${getEngineUrl()}/api/backups`, { method: 'POST' });
            if (!response.ok)
                throw new Error(`Engine API returned ${response.status}`);
            return { ok: true, message: 'Backup created' };
        });
    }
    async function deleteBackup(id) {
        await runAction('Delete backup', async () => {
            const response = await fetch(`${getEngineUrl()}/api/backups/${encodeURIComponent(id)}`, { method: 'DELETE' });
            if (!response.ok)
                throw new Error(`Engine API returned ${response.status}`);
            return { ok: true, message: 'Backup deleted' };
        });
    }
    async function previewRestore(id) {
        await runAction('Load restore preview', async () => {
            const response = await fetch(`${getEngineUrl()}/api/backups/${encodeURIComponent(id)}/restore-preview`);
            if (!response.ok)
                throw new Error(`Engine API returned ${response.status}`);
            const payload = await response.json();
            setRestorePreview(payload);
            setConfirmation('');
            return { ok: true, message: 'Restore preview loaded' };
        });
    }
    async function restoreSelectedBackup() {
        if (!restorePreview)
            return;
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
    function updateSetting(key, value) {
        setSettings((current) => current ? { ...current, [key]: value } : current);
        setSettingsDirty(true);
    }
    function updateNumberSetting(key, value) {
        updateSetting(key, Number(value));
    }
    async function saveRuntimeSettings() {
        if (!settings)
            return;
        await runAction('Save runtime settings', async () => {
            const result = await window.engineManagerApi.saveRuntimeSettings(settings);
            setSettings(result.config);
            setEngineUrl(buildEngineUrl('localhost', result.config.port));
            setSettingsPath(result.configPath);
            setSettingsValidation(result.validation);
            if (result.ok)
                setSettingsDirty(false);
            return { ok: result.ok, message: result.message };
        });
    }
    function toggleJob(job) {
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
    return (_jsxs("div", { className: "app", children: [_jsxs("header", { className: "titlebar", children: [_jsx("div", { className: "logo", children: "ENL" }), _jsxs("div", { children: [_jsx("h1", { children: "EnergyLink Engine Manager" }), _jsx("p", { children: "Service control and local runtime inspection" })] })] }), _jsxs("main", { className: "content", children: [_jsxs("section", { className: "card hero", children: [_jsxs("div", { children: [_jsx("div", { className: "label", children: "Windows Service" }), _jsx("div", { className: `service-state ${stateClass(status?.state)}`, children: status?.state ?? 'loading' }), _jsxs("div", { className: "subtext", children: ["Service name: ", _jsx("b", { children: "EnergyLinkEngine" })] })] }), _jsx("button", { className: "button secondary", onClick: refresh, disabled: busy, children: "Refresh" })] }), _jsxs("section", { className: "grid", children: [_jsxs("div", { className: "card", children: [_jsx("h2", { children: "Service Actions" }), _jsx("p", { className: "subtext", children: "These actions call the installed Windows service. Administrator rights may be required by Windows." }), _jsxs("div", { className: "button-row", children: [_jsx("button", { className: "button primary", onClick: () => runAction('Start service', window.engineManagerApi.startService), disabled: busy, children: "Start" }), _jsx("button", { className: "button danger", onClick: () => runAction('Stop service', window.engineManagerApi.stopService), disabled: busy, children: "Stop" }), _jsx("button", { className: "button", onClick: () => runAction('Restart service', window.engineManagerApi.restartService), disabled: busy, children: "Restart" })] })] }), _jsxs("div", { className: "card", children: [_jsx("h2", { children: "Folders and API" }), _jsx("p", { className: "subtext", children: "Open installed runtime folders and the local Engine API status endpoint." }), _jsxs("div", { className: "button-grid", children: [_jsx("button", { className: "button", onClick: () => runAction('Open ProgramData', window.engineManagerApi.openProgramData), disabled: busy, children: "ProgramData" }), _jsx("button", { className: "button", onClick: () => runAction('Open logs', window.engineManagerApi.openLogs), disabled: busy, children: "Logs" }), _jsx("button", { className: "button", onClick: () => runAction('Open config', window.engineManagerApi.openConfig), disabled: busy, children: "engine.json" }), _jsx("button", { className: "button", onClick: () => runAction('Open Engine API', window.engineManagerApi.openEngineUrl), disabled: busy, children: "API Status" })] })] })] }), _jsxs("section", { className: "card", children: [_jsxs("div", { className: "section-title-row", children: [_jsxs("div", { children: [_jsx("h2", { children: "Runtime Settings" }), _jsx("p", { className: "subtext", children: settingsPath || 'engine.json' })] }), _jsxs("div", { className: "button-row compact", children: [_jsx("button", { className: "button secondary", onClick: loadRuntimeSettings, disabled: busy, children: "Reload" }), _jsx("button", { className: "button primary", onClick: saveRuntimeSettings, disabled: busy || !settings || !settingsDirty, children: "Save Settings" })] })] }), !settings ? (_jsx("div", { className: "subtext", children: "Loading runtime settings..." })) : (_jsxs(_Fragment, { children: [_jsxs("div", { className: "settings-grid", children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "Engine name" }), _jsx("input", { value: settings.engineName, onChange: (event) => updateSetting('engineName', event.target.value) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "API host" }), _jsx("input", { value: settings.apiHost, onChange: (event) => updateSetting('apiHost', event.target.value) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "API port" }), _jsx("input", { type: "number", min: "1", max: "65535", value: settings.port, onChange: (event) => updateNumberSetting('port', event.target.value) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Timezone" }), _jsx("input", { value: settings.defaultTimezone, onChange: (event) => updateSetting('defaultTimezone', event.target.value) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Log level" }), _jsxs("select", { value: settings.logLevel, onChange: (event) => updateSetting('logLevel', event.target.value), children: [_jsx("option", { value: "debug", children: "debug" }), _jsx("option", { value: "info", children: "info" }), _jsx("option", { value: "warn", children: "warn" }), _jsx("option", { value: "error", children: "error" })] })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Runtime write mode" }), _jsxs("select", { value: settings.runtimeWriteMode, onChange: (event) => updateSetting('runtimeWriteMode', event.target.value), children: [_jsx("option", { value: "normal", children: "normal" }), _jsx("option", { value: "read_only", children: "read_only" })] })] })] }), _jsxs("div", { className: "toggle-grid", children: [_jsxs("label", { children: [_jsx("input", { type: "checkbox", checked: settings.autoStart, onChange: (event) => updateSetting('autoStart', event.target.checked) }), " Auto start"] }), _jsxs("label", { children: [_jsx("input", { type: "checkbox", checked: settings.serviceMode, onChange: (event) => updateSetting('serviceMode', event.target.checked) }), " Service mode"] }), _jsxs("label", { children: [_jsx("input", { type: "checkbox", checked: settings.pollingEnabled, onChange: (event) => updateSetting('pollingEnabled', event.target.checked) }), " Polling enabled"] }), _jsxs("label", { children: [_jsx("input", { type: "checkbox", checked: settings.historyLoggingEnabled, onChange: (event) => updateSetting('historyLoggingEnabled', event.target.checked) }), " History logging"] }), _jsxs("label", { children: [_jsx("input", { type: "checkbox", checked: settings.webViewerEnabled, onChange: (event) => updateSetting('webViewerEnabled', event.target.checked) }), " Web viewer"] }), _jsxs("label", { children: [_jsx("input", { type: "checkbox", checked: settings.allowRemoteWebViewer, onChange: (event) => updateSetting('allowRemoteWebViewer', event.target.checked) }), " Remote web viewer"] }), _jsxs("label", { children: [_jsx("input", { type: "checkbox", checked: settings.requireAuthentication, onChange: (event) => updateSetting('requireAuthentication', event.target.checked) }), " Require authentication"] })] }), _jsxs("div", { className: "settings-grid numeric-grid", children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "Polling interval (ms)" }), _jsx("input", { type: "number", min: "250", value: settings.pollingScanIntervalMs, onChange: (event) => updateNumberSetting('pollingScanIntervalMs', event.target.value) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "History retention (days)" }), _jsx("input", { type: "number", min: "1", value: settings.historyRetentionDays, onChange: (event) => updateNumberSetting('historyRetentionDays', event.target.value) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Log retention (days)" }), _jsx("input", { type: "number", min: "1", value: settings.logRetentionDays, onChange: (event) => updateNumberSetting('logRetentionDays', event.target.value) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Backup retention (days)" }), _jsx("input", { type: "number", min: "1", value: settings.backupRetentionDays, onChange: (event) => updateNumberSetting('backupRetentionDays', event.target.value) })] })] }), _jsx("div", { className: "path-grid", children: [
                                            ['databasePath', 'Database path'],
                                            ['dataFolder', 'Data folder'],
                                            ['logFolder', 'Log folder'],
                                            ['graphicsFolder', 'Graphics folder'],
                                            ['reportsFolder', 'Reports folder'],
                                            ['imagesFolder', 'Images folder'],
                                            ['driversFolder', 'Drivers folder']
                                        ].map(([key, label]) => (_jsxs("label", { className: "field", children: [_jsx("span", { children: label }), _jsx("input", { value: String(settings[key] ?? ''), onChange: (event) => updateSetting(key, event.target.value) })] }, key))) }), settingsValidation?.errors.length ? (_jsx("div", { className: "validation-box bad", children: settingsValidation.errors.map((item) => _jsx("div", { children: item }, item)) })) : null, settingsValidation?.warnings.length ? (_jsx("div", { className: "validation-box warn", children: settingsValidation.warnings.map((item) => _jsx("div", { children: item }, item)) })) : null] }))] }), _jsxs("section", { className: "card", children: [_jsxs("div", { className: "section-title-row", children: [_jsxs("div", { children: [_jsx("h2", { children: "Data Retention and Maintenance" }), _jsx("p", { className: "subtext", children: "Clean old history rows, old log files and expired backup folders using retention days from engine.json. No runtime values are generated by this process." })] }), _jsx("button", { className: "button primary", onClick: runMaintenance, disabled: busy || selectedJobs.length === 0, children: "Run Selected" })] }), _jsx("div", { className: "maintenance-grid", children: maintenanceItems.map((item) => (_jsxs("label", { className: "maintenance-card", children: [_jsx("input", { type: "checkbox", checked: selectedJobs.includes(item.jobType), onChange: () => toggleJob(item.jobType) }), _jsxs("div", { children: [_jsx("b", { children: item.jobType }), _jsxs("div", { className: "subtext", children: ["Retention: ", item.retentionDays ?? '-', " days | cutoff: ", item.cutoff ?? '-'] }), _jsxs("div", { className: "subtext", children: ["Rows: ", item.rows ?? '-', " | Files: ", item.files ?? item.folders ?? '-'] }), item.note ? _jsx("div", { className: "subtext", children: item.note }) : null] })] }, item.jobType))) }), _jsx("h3", { children: "Recent Maintenance Runs" }), _jsx("div", { className: "simple-list", children: maintenanceRuns.length === 0 ? _jsx("div", { className: "subtext", children: "No maintenance runs yet." }) : maintenanceRuns.slice(0, 8).map((run) => (_jsxs("div", { className: "list-row", children: [_jsxs("div", { children: [_jsx("b", { children: run.jobType }), _jsxs("div", { className: "subtext", children: [run.startedAt, " | ", run.status, run.error ? ` | ${run.error}` : ''] })] }), _jsxs("div", { className: "subtext", children: ["rows ", run.deletedRows, " | files ", run.deletedFiles] })] }, run.id))) })] }), _jsxs("section", { className: "card", children: [_jsxs("div", { className: "section-title-row", children: [_jsxs("div", { children: [_jsx("h2", { children: "Backup and Restore" }), _jsx("p", { className: "subtext", children: "Create backups from ProgramData and restore a selected backup with explicit confirmation. Restore creates a pre-restore backup automatically." })] }), _jsx("button", { className: "button primary", onClick: createBackup, disabled: busy, children: "Create Backup" })] }), _jsx("div", { className: "backup-list", children: backups.length === 0 ? _jsx("div", { className: "subtext", children: "No backups found or Engine API is not reachable." }) : backups.map((backup) => (_jsxs("div", { className: "backup-row", children: [_jsxs("div", { children: [_jsx("b", { children: backup.id }), _jsxs("div", { className: "subtext", children: [backup.createdAt ?? 'No manifest', " | files: ", backup.fileCount ?? '-'] })] }), _jsxs("div", { className: "button-row compact", children: [_jsx("button", { className: "button small", onClick: () => previewRestore(backup.id), disabled: busy || !backup.manifestValid, children: "Restore..." }), _jsx("button", { className: "button danger small", onClick: () => deleteBackup(backup.id), disabled: busy, children: "Delete" })] })] }, backup.id))) }), restorePreview ? (_jsxs("div", { className: "restore-panel", children: [_jsxs("h3", { children: ["Restore Preview: ", restorePreview.id] }), _jsx("p", { className: "subtext", children: "This operation replaces config, data, graphics, reports and images. Logs and backup folders are not overwritten." }), _jsx("ul", { children: restorePreview.restoreTargets.map((target) => (_jsxs("li", { children: [_jsx("b", { children: target.name }), ": ", target.existsInBackup ? 'included' : 'empty folder will be created', " -> ", target.targetDir] }, target.name))) }), _jsxs("div", { className: "warning-box", children: ["Type ", _jsx("b", { children: restorePreview.requiresConfirmation }), " to confirm restore."] }), _jsx("input", { className: "confirm-input", value: confirmation, onChange: (event) => setConfirmation(event.target.value), placeholder: restorePreview.requiresConfirmation }), _jsxs("div", { className: "button-row", children: [_jsx("button", { className: "button danger", onClick: restoreSelectedBackup, disabled: busy || confirmation !== restorePreview.requiresConfirmation, children: "Restore Backup" }), _jsx("button", { className: "button secondary", onClick: () => setRestorePreview(null), disabled: busy, children: "Cancel" })] })] })) : null] }), _jsxs("section", { className: "card", children: [_jsx("h2", { children: "Recent Engine Log" }), _jsx("pre", { className: "logbox", children: logs.join('\n') })] }), _jsxs("section", { className: "card", children: [_jsx("h2", { children: "Raw Service Status" }), _jsx("pre", { className: "rawbox", children: status?.raw ?? '' })] })] }), _jsxs("footer", { className: "statusbar", children: [_jsx("span", { children: message }), _jsxs("span", { children: ["Engine API: ", getEngineUrl()] })] })] }));
}
