import fs from 'node:fs';
import path from 'node:path';
import {
  getConfigDir,
  getDataDir,
  getDatabasePath,
  getGraphicsDir,
  getImagesDir,
  getLogsDir,
  getReportsDir,
  getDriversDir
} from './paths.js';

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
    historyLogIntervalSeconds: number;
    historyMinLogIntervalSeconds: number;
    historyDeadbandPercent: number;
    webViewerEnabled: boolean;
    allowRemoteWebViewer: boolean;
    requireAuthentication: boolean;
    defaultTimezone: string;
    runtimeWriteMode: 'normal' | 'read_only';
};

export type EngineConfigValidationResult = {
    valid: boolean;
    errors: string[];
    warnings: string[];
};

export function getEngineConfigPath(): string {
    return path.join(getConfigDir(), 'engine.json');
}

export function createDefaultEngineConfig(): EngineConfig {
    return {
        engineName: 'EnergyLink Local Engine',
        apiHost: '0.0.0.0',
        port: 8081,
        databasePath: getDatabasePath(),
        dataFolder: getDataDir(),
        logFolder: getLogsDir(),
        graphicsFolder: getGraphicsDir(),
        reportsFolder: getReportsDir(),
        imagesFolder: getImagesDir(),
        driversFolder: getDriversDir(),
        autoStart: true,
        logLevel: 'info',
        serviceMode: true,
        pollingEnabled: true,
        pollingScanIntervalMs: 1000,
        historyLoggingEnabled: true,
        historyRetentionDays: 730,
        logRetentionDays: 90,
        backupRetentionDays: 365,
        historyLogIntervalSeconds: 900,
        historyMinLogIntervalSeconds: 60,
        historyDeadbandPercent: 1.0,
        webViewerEnabled: true,
        allowRemoteWebViewer: true,
        requireAuthentication: true,
        defaultTimezone: 'Asia/Bangkok',
        runtimeWriteMode: 'normal'
    };
}

function normalizeBoolean(value: any, fallback: boolean): boolean {
    if (typeof value === 'boolean')
        return value;
    return fallback;
}

function normalizeNumber(value: any, fallback: number): number {
    if (typeof value === 'number' && Number.isFinite(value))
        return value;
    if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value)))
        return Number(value);
    return fallback;
}

function normalizeString(value: any, fallback: string): string {
    if (typeof value === 'string' && value.trim() !== '')
        return value.trim();
    return fallback;
}

function normalizeLogLevel(value: any, fallback: 'debug' | 'info' | 'warn' | 'error'): 'debug' | 'info' | 'warn' | 'error' {
    return value === 'debug' || value === 'info' || value === 'warn' || value === 'error' ? value : fallback;
}

function normalizeRuntimeWriteMode(value: any, fallback: 'normal' | 'read_only'): 'normal' | 'read_only' {
    return value === 'normal' || value === 'read_only' ? value : fallback;
}

export function normalizeEngineConfig(input: Partial<EngineConfig>): EngineConfig {
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
        logLevel: normalizeLogLevel(input.logLevel, defaults.logLevel),
        serviceMode: normalizeBoolean(input.serviceMode, defaults.serviceMode),
        pollingEnabled: normalizeBoolean(input.pollingEnabled, defaults.pollingEnabled),
        pollingScanIntervalMs: normalizeNumber(input.pollingScanIntervalMs, defaults.pollingScanIntervalMs),
        historyLoggingEnabled: normalizeBoolean(input.historyLoggingEnabled, defaults.historyLoggingEnabled),
        historyRetentionDays: normalizeNumber(input.historyRetentionDays, defaults.historyRetentionDays),
        logRetentionDays: normalizeNumber(input.logRetentionDays, defaults.logRetentionDays),
        backupRetentionDays: normalizeNumber(input.backupRetentionDays, defaults.backupRetentionDays),
        historyLogIntervalSeconds: normalizeNumber(input.historyLogIntervalSeconds, defaults.historyLogIntervalSeconds),
        historyMinLogIntervalSeconds: normalizeNumber(input.historyMinLogIntervalSeconds, defaults.historyMinLogIntervalSeconds),
        historyDeadbandPercent: normalizeNumber(input.historyDeadbandPercent, defaults.historyDeadbandPercent),
        webViewerEnabled: normalizeBoolean(input.webViewerEnabled, defaults.webViewerEnabled),
        allowRemoteWebViewer: normalizeBoolean(input.allowRemoteWebViewer, defaults.allowRemoteWebViewer),
        requireAuthentication: normalizeBoolean(input.requireAuthentication, defaults.requireAuthentication),
        defaultTimezone: normalizeString(input.defaultTimezone, defaults.defaultTimezone),
        runtimeWriteMode: normalizeRuntimeWriteMode(input.runtimeWriteMode, defaults.runtimeWriteMode)
    };
}

export function validateEngineConfig(config: EngineConfig): EngineConfigValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
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
    if (!Number.isInteger(config.historyLogIntervalSeconds) || config.historyLogIntervalSeconds < 1)
        errors.push('History log interval must be at least 1 second.');
    if (!Number.isInteger(config.historyMinLogIntervalSeconds) || config.historyMinLogIntervalSeconds < 1)
        errors.push('History min log interval must be at least 1 second.');
    if (typeof config.historyDeadbandPercent !== 'number' || config.historyDeadbandPercent < 0)
        errors.push('History deadband percent must be 0 or greater.');
    if (!Number.isInteger(config.logRetentionDays) || config.logRetentionDays < 1)
        errors.push('Log retention must be at least 1 day.');
    if (!Number.isInteger(config.backupRetentionDays) || config.backupRetentionDays < 1)
        errors.push('Backup retention must be at least 1 day.');
    const folderFields: [keyof EngineConfig, string][] = [
        ['databasePath', 'Database path'],
        ['dataFolder', 'Data folder'],
        ['logFolder', 'Log folder'],
        ['graphicsFolder', 'Graphics folder'],
        ['reportsFolder', 'Reports folder'],
        ['imagesFolder', 'Images folder'],
        ['driversFolder', 'Drivers folder']
    ];
    for (const [field, label] of folderFields) {
        const value = String(config[field] ?? '').trim();
        if (!value)
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

export function readEngineConfig(): EngineConfig {
    const configPath = getEngineConfigPath();
    if (!fs.existsSync(configPath))
        return createDefaultEngineConfig();
    const raw = fs.readFileSync(configPath, 'utf8').replace(/^\uFEFF/, '');
    const parsed = JSON.parse(raw);
    return normalizeEngineConfig({ ...createDefaultEngineConfig(), ...parsed });
}

export function writeEngineConfig(config: EngineConfig): void {
    const normalized = normalizeEngineConfig(config);
    const validation = validateEngineConfig(normalized);
    if (!validation.valid) {
        throw new Error(`Invalid engine configuration: ${validation.errors.join(' ')}`);
    }
    fs.mkdirSync(getConfigDir(), { recursive: true });
    fs.writeFileSync(getEngineConfigPath(), JSON.stringify(normalized, null, 2), 'utf8');
}
