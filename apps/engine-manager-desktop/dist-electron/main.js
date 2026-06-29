import { app, BrowserWindow, ipcMain, shell } from 'electron';
import { execFile, spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = process.env.NODE_ENV === 'development' || process.env.VITE_DEV_SERVER_URL;
const serviceName = 'EnergyLinkEngine';
const programData = process.env.ENERGYLINK_PROGRAM_DATA
    ?? process.env.ENERGYLINK_PROGRAMDATA
    ?? (process.platform === 'win32'
        ? path.join(process.env.ProgramData ?? process.env.PROGRAMDATA ?? 'C:\\ProgramData', 'EnergyLink Management')
        : path.join(os.homedir(), '.energylink-management'));
const configPath = path.join(programData, 'config', 'engine.json');
const logPath = path.join(programData, 'logs', 'engine.log');
const managerRoot = path.resolve(__dirname, '..');
const workspaceRoot = path.resolve(managerRoot, '..', '..');
const engineRoot = path.join(workspaceRoot, 'apps', 'engine');
const localEngineLogPath = path.join(programData, 'logs', 'engine-manager-local-engine.log');
let localEngineProcess = null;
function createDefaultEngineConfig() {
    const dataFolder = path.join(programData, 'data');
    return {
        engineName: 'EnergyLink Local Engine',
        apiHost: '0.0.0.0',
        port: 8081,
        databasePath: path.join(dataFolder, 'energylink.db'),
        dataFolder,
        logFolder: path.join(programData, 'logs'),
        graphicsFolder: path.join(programData, 'graphics'),
        reportsFolder: path.join(programData, 'reports'),
        imagesFolder: path.join(programData, 'images'),
        driversFolder: path.join(programData, 'drivers'),
        autoStart: true,
        logLevel: 'info',
        serviceMode: true,
        pollingEnabled: true,
        pollingScanIntervalMs: 1000,
        historyLoggingEnabled: true,
        historyRetentionDays: 730,
        logRetentionDays: 90,
        backupRetentionDays: 365,
        webViewerEnabled: true,
        allowRemoteWebViewer: true,
        requireAuthentication: true,
        defaultTimezone: 'Asia/Bangkok',
        runtimeWriteMode: 'normal'
    };
}
function normalizeBoolean(value, fallback) {
    return typeof value === 'boolean' ? value : fallback;
}
function normalizeNumber(value, fallback) {
    if (typeof value === 'number' && Number.isFinite(value))
        return value;
    if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value)))
        return Number(value);
    return fallback;
}
function normalizeString(value, fallback) {
    return typeof value === 'string' && value.trim() !== '' ? value.trim() : fallback;
}
function normalizeEngineConfig(input) {
    const defaults = createDefaultEngineConfig();
    return {
        engineName: normalizeString(input.engineName, defaults.engineName),
        apiHost: normalizeString(input.apiHost, defaults.apiHost),
        port: normalizeNumber(input.port, defaults.port),
        databasePath: normalizeString(input.databasePath, defaults.databasePath),
        dataFolder: normalizeString(input.dataFolder, defaults.dataFolder),
        logFolder: normalizeString(input.logFolder, defaults.logFolder),
        graphicsFolder: normalizeString(input.graphicsFolder, defaults.graphicsFolder),
        reportsFolder: normalizeString(input.reportsFolder, defaults.reportsFolder),
        imagesFolder: normalizeString(input.imagesFolder, defaults.imagesFolder),
        driversFolder: normalizeString(input.driversFolder, defaults.driversFolder),
        autoStart: normalizeBoolean(input.autoStart, defaults.autoStart),
        logLevel: input.logLevel === 'debug' || input.logLevel === 'info' || input.logLevel === 'warn' || input.logLevel === 'error' ? input.logLevel : defaults.logLevel,
        serviceMode: normalizeBoolean(input.serviceMode, defaults.serviceMode),
        pollingEnabled: normalizeBoolean(input.pollingEnabled, defaults.pollingEnabled),
        pollingScanIntervalMs: normalizeNumber(input.pollingScanIntervalMs, defaults.pollingScanIntervalMs),
        historyLoggingEnabled: normalizeBoolean(input.historyLoggingEnabled, defaults.historyLoggingEnabled),
        historyRetentionDays: normalizeNumber(input.historyRetentionDays, defaults.historyRetentionDays),
        logRetentionDays: normalizeNumber(input.logRetentionDays, defaults.logRetentionDays),
        backupRetentionDays: normalizeNumber(input.backupRetentionDays, defaults.backupRetentionDays),
        webViewerEnabled: normalizeBoolean(input.webViewerEnabled, defaults.webViewerEnabled),
        allowRemoteWebViewer: normalizeBoolean(input.allowRemoteWebViewer, defaults.allowRemoteWebViewer),
        requireAuthentication: normalizeBoolean(input.requireAuthentication, defaults.requireAuthentication),
        defaultTimezone: normalizeString(input.defaultTimezone, defaults.defaultTimezone),
        runtimeWriteMode: input.runtimeWriteMode === 'normal' || input.runtimeWriteMode === 'read_only' ? input.runtimeWriteMode : defaults.runtimeWriteMode
    };
}
function validateEngineConfig(config) {
    const errors = [];
    const warnings = [];
    if (!config.engineName.trim())
        errors.push('Engine name is required.');
    if (!config.apiHost.trim())
        errors.push('API host is required.');
    if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535)
        errors.push('API port must be an integer between 1 and 65535.');
    if (!Number.isInteger(config.pollingScanIntervalMs) || config.pollingScanIntervalMs < 250)
        errors.push('Polling interval must be at least 250 ms.');
    if (!Number.isInteger(config.historyRetentionDays) || config.historyRetentionDays < 1)
        errors.push('History retention must be at least 1 day.');
    if (!Number.isInteger(config.logRetentionDays) || config.logRetentionDays < 1)
        errors.push('Log retention must be at least 1 day.');
    if (!Number.isInteger(config.backupRetentionDays) || config.backupRetentionDays < 1)
        errors.push('Backup retention must be at least 1 day.');
    const pathFields = [
        ['databasePath', 'Database path'],
        ['dataFolder', 'Data folder'],
        ['logFolder', 'Log folder'],
        ['graphicsFolder', 'Graphics folder'],
        ['reportsFolder', 'Reports folder'],
        ['imagesFolder', 'Images folder'],
        ['driversFolder', 'Drivers folder']
    ];
    for (const [field, label] of pathFields) {
        if (!String(config[field] ?? '').trim())
            errors.push(`${label} is required.`);
    }
    if (config.port === 80)
        warnings.push('Port 80 may require administrator privileges on Windows.');
    if (config.apiHost === '0.0.0.0' && !config.requireAuthentication)
        warnings.push('Remote access should be enabled only on trusted local networks.');
    if (!config.historyLoggingEnabled)
        warnings.push('History logging is disabled. Trend and report data may not be available.');
    if (config.runtimeWriteMode === 'read_only')
        warnings.push('Runtime write mode is read-only. Polling will not write current values or history.');
    return { valid: errors.length === 0, errors, warnings };
}
async function readEngineConfig() {
    try {
        const raw = await fs.readFile(configPath, 'utf8');
        const parsed = JSON.parse(raw.replace(/^\uFEFF/, ''));
        return normalizeEngineConfig({ ...createDefaultEngineConfig(), ...parsed });
    }
    catch (error) {
        return createDefaultEngineConfig();
    }
}
async function writeEngineConfig(config) {
    const normalized = normalizeEngineConfig(config);
    const validation = validateEngineConfig(normalized);
    if (!validation.valid)
        throw new Error(`Invalid engine configuration: ${validation.errors.join(' ')}`);
    await fs.mkdir(path.dirname(configPath), { recursive: true });
    await fs.writeFile(configPath, JSON.stringify(normalized, null, 2), 'utf8');
}
function runCommand(command, args) {
    return new Promise((resolve) => {
        execFile(command, args, { windowsHide: true }, (error, stdout, stderr) => {
            const errno = error?.errno;
            const code = typeof errno === 'number' ? errno : null;
            resolve({ ok: !error, stdout: stdout?.toString() ?? '', stderr: stderr?.toString() ?? '', code });
        });
    });
}
function parseScQuery(text) {
    if (/does not exist|FAILED 1060/i.test(text))
        return { installed: false, state: 'not-installed', raw: text };
    const match = text.match(/STATE\s*:\s*\d+\s+(\w+)/i);
    return { installed: true, state: match?.[1]?.toLowerCase() ?? 'unknown', raw: text };
}
async function isEngineApiReachable() {
    const config = await readEngineConfig();
    const port = Number(process.env.ENERGYLINK_PORT ?? config.port ?? 8081);
    return new Promise((resolve) => {
        const request = http.get({ host: '127.0.0.1', port, path: '/api/health', timeout: 1200 }, (response) => {
            response.resume();
            resolve(Boolean(response.statusCode && response.statusCode < 500));
        });
        request.on('error', () => resolve(false));
        request.on('timeout', () => {
            request.destroy();
            resolve(false);
        });
    });
}
async function getWindowsServiceStatus() {
    if (process.platform !== 'win32') {
        return { installed: false, state: 'unsupported-platform', raw: 'Windows service control is available only on Windows.' };
    }
    const result = await runCommand('sc.exe', ['query', serviceName]);
    return parseScQuery(`${result.stdout}\n${result.stderr}`);
}
async function getServiceStatus() {
    const serviceStatus = await getWindowsServiceStatus();
    const localRunning = Boolean(localEngineProcess && !localEngineProcess.killed && localEngineProcess.exitCode === null);
    const apiReachable = await isEngineApiReachable();
    if (!serviceStatus.installed && (localRunning || apiReachable)) {
        return {
            installed: false,
            state: 'running-local',
            raw: `${serviceStatus.raw}\n\nLocal Engine API is reachable at http://localhost:8081.`
        };
    }
    if (serviceStatus.installed && serviceStatus.state !== 'running' && apiReachable) {
        return {
            ...serviceStatus,
            state: 'running-local',
            raw: `${serviceStatus.raw}\n\nLocal Engine API is reachable at http://localhost:8081.`
        };
    }
    return serviceStatus;
}
async function appendLocalEngineLog(text) {
    await fs.mkdir(path.dirname(localEngineLogPath), { recursive: true });
    await fs.appendFile(localEngineLogPath, text, 'utf8');
}
async function startLocalEngine() {
    if (localEngineProcess && !localEngineProcess.killed && localEngineProcess.exitCode === null) {
        return { ok: true, message: 'Local Engine is already running.' };
    }
    if (await isEngineApiReachable()) {
        return { ok: true, message: 'Engine API is already reachable.' };
    }
    const entryPath = path.join(engineRoot, 'src', 'index.ts');
    const tsxCli = path.join(engineRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs');
    try {
        await fs.access(entryPath);
        await fs.access(tsxCli);
    }
    catch {
        return { ok: false, message: `Local Engine source was not found at ${engineRoot}. Use START_ENGINE_SERVICE.cmd or install the Windows service for packaged runs.` };
    }
    const childEnv = { ...process.env };
    delete childEnv.ELECTRON_RUN_AS_NODE;
    await appendLocalEngineLog(`\n[${new Date().toISOString()}] Starting local engine from ${engineRoot}\n`);
    localEngineProcess = spawn(process.execPath, [tsxCli, 'src/index.ts'], {
        cwd: engineRoot,
        env: childEnv,
        windowsHide: true
    });
    localEngineProcess.stdout.on('data', (chunk) => {
        void appendLocalEngineLog(chunk.toString());
    });
    localEngineProcess.stderr.on('data', (chunk) => {
        void appendLocalEngineLog(chunk.toString());
    });
    localEngineProcess.on('exit', (code, signal) => {
        void appendLocalEngineLog(`[${new Date().toISOString()}] Local engine exited code=${code ?? ''} signal=${signal ?? ''}\n`);
        localEngineProcess = null;
    });
    await new Promise((resolve) => setTimeout(resolve, 1200));
    return { ok: await isEngineApiReachable(), message: 'Local Engine start requested.' };
}
async function stopLocalEngine() {
    if (!localEngineProcess || localEngineProcess.killed || localEngineProcess.exitCode !== null) {
        return { ok: false, message: 'No local Engine process is tracked by this manager window.' };
    }
    localEngineProcess.kill();
    localEngineProcess = null;
    return { ok: true, message: 'Local Engine stop requested.' };
}
async function serviceAction(action) {
    if (process.platform !== 'win32') {
        return { ok: false, message: 'Windows service control is available only on Windows.' };
    }
    const serviceStatus = await getWindowsServiceStatus();
    if (!serviceStatus.installed) {
        return action === 'start' ? startLocalEngine() : stopLocalEngine();
    }
    const verb = action === 'start' ? 'Start-Service' : 'Stop-Service';
    const result = await runCommand('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', `${verb} -Name ${serviceName}`]);
    return { ok: result.ok, message: result.ok ? `${action} requested` : (result.stderr || result.stdout || `${action} failed`) };
}
async function ensureFolder(folder) {
    await fs.mkdir(folder, { recursive: true });
    await shell.openPath(folder);
    return { ok: true, path: folder };
}
async function readRecentLogLines(limit = 200) {
    try {
        const text = await fs.readFile(logPath, 'utf8');
        return text.split(/\r?\n/).filter(Boolean).slice(-Math.max(1, Math.min(limit, 1000)));
    }
    catch (error) {
        return [`No engine log file found at ${logPath}.`];
    }
}
async function readRuntimeSettings() {
    const config = await readEngineConfig();
    return {
        config,
        validation: validateEngineConfig(config),
        configPath
    };
}
async function saveRuntimeSettings(incoming) {
    const current = await readEngineConfig();
    const next = normalizeEngineConfig({ ...current, ...incoming });
    const validation = validateEngineConfig(next);
    if (!validation.valid) {
        return {
            ok: false,
            message: validation.errors.join(' '),
            config: next,
            validation,
            configPath,
            changedKeys: [],
            restartRequired: false
        };
    }
    await writeEngineConfig(next);
    const restartKeys = new Set(['apiHost', 'port', 'databasePath', 'dataFolder', 'logFolder', 'graphicsFolder', 'reportsFolder', 'imagesFolder', 'logLevel', 'serviceMode']);
    const changedKeys = Object.keys(next).filter((key) => {
        const typedKey = key;
        return JSON.stringify(current[typedKey]) !== JSON.stringify(next[typedKey]);
    });
    const restartRequired = changedKeys.some((key) => restartKeys.has(key));
    return {
        ok: true,
        message: restartRequired ? 'Settings saved. Restart the Engine service to apply runtime changes.' : 'Settings saved.',
        config: next,
        validation,
        configPath,
        changedKeys,
        restartRequired
    };
}
function registerIpc() {
    ipcMain.handle('engine-manager:getServiceStatus', () => getServiceStatus());
    ipcMain.handle('engine-manager:startService', () => serviceAction('start'));
    ipcMain.handle('engine-manager:stopService', () => serviceAction('stop'));
    ipcMain.handle('engine-manager:restartService', async () => {
        const serviceStatus = await getWindowsServiceStatus();
        if (!serviceStatus.installed) {
            await stopLocalEngine();
            await new Promise((resolve) => setTimeout(resolve, 800));
            return startLocalEngine();
        }
        const stop = await serviceAction('stop');
        await new Promise((resolve) => setTimeout(resolve, 1500));
        const start = await serviceAction('start');
        return { ok: stop.ok && start.ok, message: `stop: ${stop.message}; start: ${start.message}` };
    });
    ipcMain.handle('engine-manager:openProgramData', () => ensureFolder(programData));
    ipcMain.handle('engine-manager:openLogs', () => ensureFolder(path.join(programData, 'logs')));
    ipcMain.handle('engine-manager:openConfig', async () => {
        await fs.mkdir(path.dirname(configPath), { recursive: true });
        await shell.openPath(configPath);
        return { ok: true, path: configPath };
    });
    ipcMain.handle('engine-manager:openEngineUrl', () => shell.openExternal('http://localhost:8081/api/status'));
    ipcMain.handle('engine-manager:readRecentLogLines', (_event, limit) => readRecentLogLines(limit));
    ipcMain.handle('engine-manager:readRuntimeSettings', () => readRuntimeSettings());
    ipcMain.handle('engine-manager:saveRuntimeSettings', (_event, incoming) => saveRuntimeSettings(incoming));
}
async function createWindow() {
    const win = new BrowserWindow({
        width: 980,
        height: 720,
        minWidth: 860,
        minHeight: 620,
        title: 'EnergyLink Engine Manager',
        backgroundColor: '#edf4f7',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });
    if (isDev && process.env.VITE_DEV_SERVER_URL) {
        await win.loadURL(process.env.VITE_DEV_SERVER_URL);
    }
    else {
        await win.loadFile(path.join(__dirname, '../dist/index.html'));
    }
}
app.whenReady().then(() => {
    registerIpc();
    createWindow();
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin')
    app.quit(); });
