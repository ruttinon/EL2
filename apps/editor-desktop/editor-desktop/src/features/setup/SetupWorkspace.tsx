import { useEffect, useMemo, useState } from 'react';
import { Icon } from '@iconify/react';
import { useModal } from '../../context/ModalContext';
import { buildEngineUrl, getEngineUrl, setEngineUrl } from '../../api/engineConnectionApi';
import { settingsApi, type EngineRuntimeConfig, type RuntimeConfigResponse } from '../../api/settingsApi';
import { notificationApi, type NotificationChannel, type NotificationRule } from '../../api/notificationApi';
import { EDITOR_COMMAND_EVENT, normalizeCommand, type EditorCommand } from '../../commandBus';
import type { GraphicAsset, GraphicAssetKind } from '@energylink/shared-types';
import {
  loadGraphicAssets,
  saveGraphicAssets,
  assetKindFromFile,
  readFileAsDataUrl,
  acceptFilterForKind,
  LS_ASSETS,
  syncSharedAssetsFromEngine,
} from '../graphics/graphicAssets';
import { loadGraphicSymbols, saveGraphicSymbols, readSvgFile } from '../graphics/graphicSymbols';
import type { GraphicSymbol } from '@energylink/shared-types';

type Tab =
  | 'runtime'
  | 'units'
  | 'styles'
  | 'images'
  | 'symbols'
  | 'variables'
  | 'events'
  | 'web'
  | 'database'
  | 'backup'
  | 'maintenance'
  | 'about';

type ValidationResult = {
  ok: boolean;
  errors: string[];
  warnings: string[];
};

type UnitSettings = {
  electricityUnit: string;
  demandUnit: string;
  voltageUnit: string;
  currentUnit: string;
  powerFactorLabel: string;
  currency: string;
  costRate: number;
  decimalPlaces: number;
};

type StyleSettings = {
  themeName: string;
  canvasBackground: string;
  primaryColor: string;
  alarmHighColor: string;
  alarmMediumColor: string;
  alarmLowColor: string;
  defaultFontSize: number;
  gridSize: number;
};

type ImageItem = {
  id: string;
  name: string;
  dataUrl: string;
  createdAt: string;
};

type CalculatedVariable = {
  id: string;
  name: string;
  expression: string;
  unit: string;
  description: string;
  enabled: boolean;
  createdAt: string;
};

type LocalBackup = {
  id: string;
  name: string;
  createdAt: string;
  payloadJson: string;
};

const defaultRuntime: EngineRuntimeConfig = {
  engineName: 'EnergyLink Local Engine',
  apiHost: '0.0.0.0',
  port: 8081,
  databasePath: '',
  dataFolder: '',
  logFolder: '',
  graphicsFolder: '',
  reportsFolder: '',
  imagesFolder: '',
  autoStart: true,
  logLevel: 'info',
  serviceMode: false,
  pollingEnabled: true,
  pollingScanIntervalMs: 1000,
  historyLoggingEnabled: true,
  historyRetentionDays: 365,
  logRetentionDays: 30,
  backupRetentionDays: 30,
  webViewerEnabled: true,
  allowRemoteWebViewer: false,
  requireAuthentication: false,
  defaultTimezone: 'Asia/Bangkok',
  runtimeWriteMode: 'normal'
};

const defaultUnits: UnitSettings = {
  electricityUnit: 'kWh',
  demandUnit: 'kW',
  voltageUnit: 'V',
  currentUnit: 'A',
  powerFactorLabel: 'PF',
  currency: 'THB',
  costRate: 0,
  decimalPlaces: 2
};

const defaultStyles: StyleSettings = {
  themeName: 'EnergyLink Default',
  canvasBackground: '#f8fafc',
  primaryColor: '#2563eb',
  alarmHighColor: '#dc2626',
  alarmMediumColor: '#f97316',
  alarmLowColor: '#facc15',
  defaultFontSize: 14,
  gridSize: 20
};

const LS_UNITS = 'energylink.setup.units.v1';
const LS_STYLES = 'energylink.setup.styles.v1';
const LS_IMAGES = 'energylink.setup.images.v1';
const LS_VARIABLES = 'energylink.setup.variables.v1';
const LS_BACKUPS = 'energylink.setup.backups.v1';
const LS_WEB_VIEWER = 'energylink.setup.webviewer.v1';
const LS_DATABASE = 'energylink.setup.database.v1';

function nowIso() {
  return new Date().toISOString();
}

let setupIdCounter = 0;

function makeId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return `${prefix}_${crypto.randomUUID()}`;
  setupIdCounter += 1;
  return `${prefix}_${Date.now()}_${setupIdCounter}`;
}

function loadJson<T>(key: string, fallback: T): T {
  const raw = window.localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    if (parsed === null || parsed === undefined) return fallback;
    if (Array.isArray(fallback)) {
      return (Array.isArray(parsed) ? parsed : fallback) as T;
    }
    if (typeof fallback === 'object') {
      return { ...fallback, ...parsed } as T;
    }
    return parsed as T;
  } catch {
    return fallback;
  }
}

function saveJson<T>(key: string, value: T) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

function validateRuntimeConfig(config: EngineRuntimeConfig): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const engineName = (config?.engineName || '').trim();
  const apiHost = (config?.apiHost || '').trim();

  if (!engineName) errors.push('Engine Name is required.');
  if (!apiHost) errors.push('API Host is required.');
  if (!Number.isInteger(config?.port) || (config?.port ?? 0) < 1 || (config?.port ?? 0) > 65535) errors.push('API Port must be 1-65535.');
  if (!Number.isInteger(config?.pollingScanIntervalMs) || (config?.pollingScanIntervalMs ?? 0) < 250) errors.push('Polling interval must be at least 250 ms.');
  if (!Number.isInteger(config?.historyRetentionDays) || (config?.historyRetentionDays ?? 0) < 1) errors.push('History retention must be at least 1 day.');
  if (!Number.isInteger(config?.logRetentionDays) || (config?.logRetentionDays ?? 0) < 1) errors.push('Log retention must be at least 1 day.');
  if (!Number.isInteger(config?.backupRetentionDays) || (config?.backupRetentionDays ?? 0) < 1) errors.push('Backup retention must be at least 1 day.');
  if (config?.allowRemoteWebViewer && apiHost === '127.0.0.1') warnings.push('Remote Web Viewer is enabled but API Host is loopback.');
  if (!config?.historyLoggingEnabled) warnings.push('History logging is disabled, so reports and trends may have no records.');

  return { ok: errors.length === 0, errors, warnings };
}

function validateUnits(units: UnitSettings): ValidationResult {
  const errors: string[] = [];
  const electricityUnit = (units?.electricityUnit || '').trim();
  const demandUnit = (units?.demandUnit || '').trim();
  const currency = (units?.currency || '').trim();

  if (!electricityUnit) errors.push('Electricity unit is required.');
  if (!demandUnit) errors.push('Demand unit is required.');
  if (!currency) errors.push('Currency is required.');
  if (!Number.isFinite(units?.costRate) || (units?.costRate ?? 0) < 0) errors.push('Cost rate must be zero or greater.');
  if (!Number.isInteger(units?.decimalPlaces) || (units?.decimalPlaces ?? 0) < 0 || (units?.decimalPlaces ?? 0) > 8) errors.push('Decimal places must be 0-8.');
  return { ok: errors.length === 0, errors, warnings: [] };
}

function validateStyles(styles: StyleSettings): ValidationResult {
  const errors: string[] = [];
  const colorFields: Array<keyof Pick<StyleSettings, 'canvasBackground' | 'primaryColor' | 'alarmHighColor' | 'alarmMediumColor' | 'alarmLowColor'>> = [
    'canvasBackground',
    'primaryColor',
    'alarmHighColor',
    'alarmMediumColor',
    'alarmLowColor'
  ];

  const themeName = (styles?.themeName || '').trim();
  if (!themeName) errors.push('Theme name is required.');
  for (const field of colorFields) {
    const colorVal = styles?.[field] || '';
    if (!/^#[0-9a-f]{6}$/i.test(colorVal)) errors.push(`${field} must be a hex color such as #2563eb.`);
  }
  if (!Number.isInteger(styles?.defaultFontSize) || (styles?.defaultFontSize ?? 0) < 8 || (styles?.defaultFontSize ?? 0) > 72) errors.push('Default font size must be 8-72.');
  if (!Number.isInteger(styles?.gridSize) || (styles?.gridSize ?? 0) < 5 || (styles?.gridSize ?? 0) > 100) errors.push('Grid size must be 5-100.');

  return { ok: errors.length === 0, errors, warnings: [] };
}

function validateVariable(variable: CalculatedVariable): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const name = (variable?.name || '').trim();
  const expression = (variable?.expression || '').trim();

  if (!name) errors.push('Variable name is required.');
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) errors.push('Variable name must start with a letter or underscore and contain letters, numbers, or underscore only.');
  if (!expression) errors.push('Expression is required.');
  if (/Math\.random|random\s*\(/i.test(expression)) errors.push('Expression cannot use random values.');
  if (/simulat|dummy|placeholder/i.test(expression)) errors.push('Expression contains a blocked word.');
  if (!/[A-Za-z_][A-Za-z0-9_]*|\d/.test(expression)) warnings.push('Expression does not appear to reference any tag or number.');
  return { ok: errors.length === 0, errors, warnings };
}

function validationText(result: ValidationResult) {
  const lines: string[] = [];
  if (result.ok) lines.push('Valid');
  if (result.errors.length) lines.push(`Errors: ${result.errors.join(' | ')}`);
  if (result.warnings.length) lines.push(`Warnings: ${result.warnings.join(' | ')}`);
  return lines.join('\n');
}

export function SetupWorkspace() {
  const [tab, setTab] = useState<Tab>('runtime');
  const [commandMessage, setCommandMessage] = useState('');

  useEffect(() => {
    function onCommand(event: Event) {
      const detail = (event as CustomEvent<EditorCommand>).detail;
      if (detail.module !== 'setup') return;
      const item = normalizeCommand(detail.item);

      if (item === 'preferences' || item === 'engine') {
        setTab('runtime');
        setCommandMessage(`${detail.item}: Runtime Configuration opened.`);
      } else if (item === 'units') {
        setTab('units');
        setCommandMessage('Units: Unit and cost settings opened.');
      } else if (item === 'styles') {
        setTab('styles');
        setCommandMessage('Styles: Editor visual style settings opened.');
      } else if (item === 'images') {
        setTab('images');
        setCommandMessage('Images: Image manager opened.');
      } else if (item === 'calculated variables') {
        setTab('variables');
        setCommandMessage('Calculated Variables: Formula manager opened.');
      } else if (item === 'events') {
        setTab('events');
        setCommandMessage('Events: Alarm notification settings opened.');
      } else if (item === 'web viewer') {
        setTab('web');
        setCommandMessage('Web Viewer: Web settings opened.');
      } else if (item === 'database') {
        setTab('database');
        setCommandMessage('Database: Database status opened.');
      } else if (item === 'backup') {
        setTab('backup');
        setCommandMessage('Backup: Backup tools opened.');
      }
    }

    window.addEventListener(EDITOR_COMMAND_EVENT, onCommand);
    return () => window.removeEventListener(EDITOR_COMMAND_EVENT, onCommand);
  }, []);

  const menuItems: Array<{ id: Tab; label: string; icon: string; color: string }> = [
    { id: 'runtime',     label: 'Runtime',    icon: 'solar:settings-bold-duotone',             color: '#10b981' },
    { id: 'units',       label: 'Units',      icon: 'solar:bolt-circle-bold-duotone',           color: '#f59e0b' },
    { id: 'styles',      label: 'Styles',     icon: 'solar:palette-bold-duotone',               color: '#ec4899' },
    { id: 'images',      label: 'Assets',     icon: 'solar:folder-with-files-bold-duotone',     color: '#0ea5e9' },
    { id: 'symbols',     label: 'Symbols',    icon: 'solar:plug-circle-bold-duotone',           color: '#f59e0b' },
    { id: 'variables',   label: 'Variables',  icon: 'solar:calculator-bold-duotone',            color: '#8b5cf6' },
    { id: 'events',      label: 'Events',     icon: 'solar:bell-bing-bold-duotone',             color: '#f43f5e' },
    { id: 'web',         label: 'Web Viewer', icon: 'solar:global-bold-duotone',                color: '#06b6d4' },
    { id: 'database',    label: 'Database',   icon: 'solar:database-bold-duotone',              color: '#6366f1' },
    { id: 'backup',      label: 'Backup',     icon: 'solar:archive-bold-duotone',               color: '#4b5563' },
    { id: 'maintenance', label: 'Maintenance',icon: 'solar:tuning-square-bold-duotone',         color: '#14b8a6' },
    { id: 'about',       label: 'About',      icon: 'solar:info-circle-bold-duotone',           color: '#3b82f6' },
  ];

  const activeItem = menuItems.find((m) => m.id === tab);

  return (
    <div className="setup-layout">
      {/* Left: vertical settings navigation sidebar */}
      <aside className="setup-sidebar">
        <div className="setup-sidebar-header">
          <div className="setup-sidebar-icon">
            <Icon icon="solar:settings-minimalistic-bold-duotone" width="20" height="20" style={{ color: '#fff' }} />
          </div>
          <div>
            <div className="setup-sidebar-title">Setup</div>
          </div>
        </div>
        <nav className="setup-menu" aria-label="Setup categories">
          {menuItems.map((item) => (
            <button
              key={item.id}
              className={`setup-menu-btn${tab === item.id ? ' active' : ''}`}
              onClick={() => setTab(item.id)}
            >
              <span className="setup-menu-btn-icon">
                <Icon icon={item.icon} width="18" height="18" style={{ color: tab === item.id ? item.color : undefined }} />
              </span>
              <span className="setup-menu-btn-label">{item.label}</span>
              {tab === item.id && <span className="setup-menu-btn-dot" />}
            </button>
          ))}
        </nav>
        <div className="setup-sidebar-footer">
          <span>EnergyLink Local Open</span>
        </div>
      </aside>

      {/* Right: active panel content */}
      <main className="setup-content-panel">
        {commandMessage && (
          <div className="setup-cmd-alert">
            <Icon icon="solar:info-circle-bold-duotone" width="15" height="15" style={{ marginRight: 6, verticalAlign: 'middle' }} />
            {commandMessage}
          </div>
        )}
        <div className="setup-panel-header">
          {activeItem && (
            <div className="setup-panel-header-icon" style={{ background: `${activeItem.color}18`, border: `1px solid ${activeItem.color}33` }}>
              <Icon icon={activeItem.icon} width="20" height="20" style={{ color: activeItem.color }} />
            </div>
          )}
          <div>
            <h2 className="setup-panel-title">{activeItem?.label}</h2>
          </div>
        </div>
        {tab === 'runtime' && <RuntimeSettings />}
        {tab === 'units' && <UnitsPanel />}
        {tab === 'styles' && <StylesPanel />}
        {tab === 'images' && <ImagesPanel />}
        {tab === 'symbols' && <SymbolsPanel />}
        {tab === 'variables' && <VariablesPanel />}
        {tab === 'events' && <NotificationSettings />}
        {tab === 'web' && <WebViewerPanel />}
        {tab === 'database' && <DatabasePanel />}
        {tab === 'backup' && <BackupPanel />}
        {tab === 'maintenance' && <MaintenancePanel />}
        {tab === 'about' && <AboutPanel />}
      </main>
    </div>
  );
}

function RuntimeSettings() {
  const [engineUrl, setUrl] = useState(getEngineUrl());
  const [config, setConfig] = useState<EngineRuntimeConfig>(loadJson('energylink.setup.runtime.local.v1', defaultRuntime));
  const [response, setResponse] = useState<RuntimeConfigResponse | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function load() {
    setError('');
    setMessage('');
    setEngineUrl(engineUrl);

    try {
      const result = await settingsApi.getRuntimeConfig();
      const next = { ...defaultRuntime, ...result.config, requireAuthentication: false };
      setConfig(next);
      saveJson('energylink.setup.runtime.local.v1', next);
      const syncedUrl = buildEngineUrl('localhost', next.port);
      setUrl(syncedUrl);
      setEngineUrl(syncedUrl);
      setResponse(result);
      setMessage('Runtime Configuration loaded from Engine.');
    } catch (err) {
      const local = loadJson('energylink.setup.runtime.local.v1', defaultRuntime);
      setConfig({ ...defaultRuntime, ...local, requireAuthentication: false });
      setError(`Engine is not connected. Local setup values are available. ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  useEffect(() => { void load(); }, []);

  function patch<K extends keyof EngineRuntimeConfig>(key: K, value: EngineRuntimeConfig[K]) {
    setConfig((current) => ({ ...current, [key]: value, requireAuthentication: false }));
  }

  async function validate() {
    setError('');
    const localValidation = validateRuntimeConfig({ ...config, requireAuthentication: false });

    try {
      const result = await settingsApi.validateRuntimeConfig({ ...config, requireAuthentication: false });
      setResponse(result);
      setMessage(result.validation.valid ? 'Runtime Configuration is valid.' : result.validation.errors.join(', '));
    } catch {
      setResponse({ config, validation: { valid: localValidation.ok, errors: localValidation.errors, warnings: localValidation.warnings } });
      setMessage(validationText(localValidation));
    }
  }

  async function save() {
    setError('');
    const next = { ...config, requireAuthentication: false };
    const localValidation = validateRuntimeConfig(next);
    if (!localValidation.ok) {
      setResponse({ config: next, validation: { valid: false, errors: localValidation.errors, warnings: localValidation.warnings } });
      setError(localValidation.errors.join(', '));
      return;
    }

    saveJson('energylink.setup.runtime.local.v1', next);
    const syncedUrl = buildEngineUrl('localhost', next.port);
    setUrl(syncedUrl);
    setEngineUrl(syncedUrl);

    try {
      const result = await settingsApi.saveRuntimeConfig(next);
      setResponse(result);
      setConfig({ ...defaultRuntime, ...result.config, requireAuthentication: false });
      setMessage(result.message ?? 'Runtime Configuration saved to Engine.');
    } catch (err) {
      setResponse({ config: next, validation: { valid: true, errors: [], warnings: ['Saved locally. Start Engine to write engine.json.'] } });
      setMessage(`Saved locally. Engine write is pending. ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return (
    <section className="card setup-card">
      <div className="card-title">Runtime Configuration</div>
      {message && <div className="alert success">{message}</div>}
      {error && <div className="alert error">{error}</div>}
      <div className="form-grid">
        <label>Engine API URL<input value={engineUrl} onChange={(event) => setUrl(event.target.value)} onBlur={() => setEngineUrl(engineUrl)} /></label>
        <label>Engine Name<input value={config.engineName} onChange={(event) => patch('engineName', event.target.value)} /></label>
        <label>API Host<input value={config.apiHost} onChange={(event) => patch('apiHost', event.target.value)} /></label>
        <label>API Port<input type="number" value={config.port} onChange={(event) => {
          const port = Number(event.target.value);
          patch('port', port);
          if (port >= 1 && port <= 65535) {
            const nextUrl = buildEngineUrl('localhost', port);
            setUrl(nextUrl);
          }
        }} /></label>
        <label>Log Level<select value={config.logLevel} onChange={(event) => patch('logLevel', event.target.value as EngineRuntimeConfig['logLevel'])}><option>debug</option><option>info</option><option>warn</option><option>error</option></select></label>
        <label>Polling Enabled<select value={String(config.pollingEnabled)} onChange={(event) => patch('pollingEnabled', event.target.value === 'true')}><option value="true">Enabled</option><option value="false">Disabled</option></select></label>
        <label>Polling Interval<input type="number" value={config.pollingScanIntervalMs} onChange={(event) => patch('pollingScanIntervalMs', Number(event.target.value))} /></label>
        <label>History Logging<select value={String(config.historyLoggingEnabled)} onChange={(event) => patch('historyLoggingEnabled', event.target.value === 'true')}><option value="true">Enabled</option><option value="false">Disabled</option></select></label>
        <label>History Retention Days<input type="number" value={config.historyRetentionDays} onChange={(event) => patch('historyRetentionDays', Number(event.target.value))} /></label>
        <label>Log Retention Days<input type="number" value={config.logRetentionDays} onChange={(event) => patch('logRetentionDays', Number(event.target.value))} /></label>
        <label>Backup Retention Days<input type="number" value={config.backupRetentionDays} onChange={(event) => patch('backupRetentionDays', Number(event.target.value))} /></label>
        <label>Timezone<input value={config.defaultTimezone} onChange={(event) => patch('defaultTimezone', event.target.value)} /></label>
        <label>Database Path<input value={config.databasePath} onChange={(event) => patch('databasePath', event.target.value)} /></label>
        <label>Data Folder<input value={config.dataFolder} onChange={(event) => patch('dataFolder', event.target.value)} /></label>
        <label>Reports Folder<input value={config.reportsFolder} onChange={(event) => patch('reportsFolder', event.target.value)} /></label>
        <label>Graphics Folder<input value={config.graphicsFolder} onChange={(event) => patch('graphicsFolder', event.target.value)} /></label>
        <label>Images Folder<input value={config.imagesFolder} onChange={(event) => patch('imagesFolder', event.target.value)} /></label>
      </div>
      <div className="button-row">
        <button className="btn secondary" onClick={() => void load()}>
          <Icon icon="solar:refresh-bold-duotone" width="16" height="16" style={{ marginRight: 6, color: '#3b82f6', verticalAlign: 'middle' }} />
          Reload
        </button>
        <button className="btn secondary" onClick={() => void validate()}>
          <Icon icon="solar:shield-check-bold-duotone" width="16" height="16" style={{ marginRight: 6, color: '#f59e0b', verticalAlign: 'middle' }} />
          Validate
        </button>
        <button className="btn primary" onClick={() => void save()}>
          <Icon icon="solar:check-circle-bold-duotone" width="16" height="16" style={{ marginRight: 6, color: '#10b981', verticalAlign: 'middle' }} />
          Save Runtime Settings
        </button>
      </div>
      {response?.validation && <pre className="path-box">Validation: {response.validation.valid ? 'Valid' : response.validation.errors.join(', ')}{response.validation.warnings?.length ? `\nWarnings: ${response.validation.warnings.join(', ')}` : ''}</pre>}
    </section>
  );
}

function UnitsPanel() {
  const [units, setUnits] = useState<UnitSettings>(loadJson(LS_UNITS, defaultUnits));
  const [message, setMessage] = useState('');
  const validation = useMemo(() => validateUnits(units), [units]);

  function patch<K extends keyof UnitSettings>(key: K, value: UnitSettings[K]) {
    setUnits((current) => ({ ...current, [key]: value }));
  }

  function save() {
    const result = validateUnits(units);
    if (!result.ok) {
      setMessage(validationText(result));
      return;
    }
    saveJson(LS_UNITS, units);
    setMessage('Unit settings saved. Reports and graphics can read these defaults.');
  }

  return (
    <section className="card setup-card">
      <div className="card-title">Units and Cost</div>
      {message && <div className={validation.ok ? 'alert success' : 'alert error'}>{message}</div>}
      <div className="form-grid">
        <label>Energy Unit<input value={units.electricityUnit} onChange={(event) => patch('electricityUnit', event.target.value)} /></label>
        <label>Demand Unit<input value={units.demandUnit} onChange={(event) => patch('demandUnit', event.target.value)} /></label>
        <label>Voltage Unit<input value={units.voltageUnit} onChange={(event) => patch('voltageUnit', event.target.value)} /></label>
        <label>Current Unit<input value={units.currentUnit} onChange={(event) => patch('currentUnit', event.target.value)} /></label>
        <label>Power Factor Label<input value={units.powerFactorLabel} onChange={(event) => patch('powerFactorLabel', event.target.value)} /></label>
        <label>Currency<input value={units.currency} onChange={(event) => patch('currency', event.target.value.toUpperCase())} /></label>
        <label>Cost Rate<input type="number" value={units.costRate} onChange={(event) => patch('costRate', Number(event.target.value))} /></label>
        <label>Decimal Places<input type="number" value={units.decimalPlaces} onChange={(event) => patch('decimalPlaces', Number(event.target.value))} /></label>
      </div>
      <div className="button-row">
        <button className="btn primary" onClick={save}>
          <Icon icon="solar:check-circle-bold-duotone" width="16" height="16" style={{ marginRight: 6, color: '#f59e0b', verticalAlign: 'middle' }} />
          Save Units
        </button>
      </div>
      <pre className="path-box">{validationText(validation)}</pre>
    </section>
  );
}

function StylesPanel() {
  const [styles, setStyles] = useState<StyleSettings>(loadJson(LS_STYLES, defaultStyles));
  const [message, setMessage] = useState('');
  const validation = useMemo(() => validateStyles(styles), [styles]);

  function patch<K extends keyof StyleSettings>(key: K, value: StyleSettings[K]) {
    setStyles((current) => ({ ...current, [key]: value }));
  }

  function save() {
    const result = validateStyles(styles);
    if (!result.ok) {
      setMessage(validationText(result));
      return;
    }
    saveJson(LS_STYLES, styles);
    setMessage('Style settings saved. New graphic and report objects can use these defaults.');
  }

  return (
    <section className="card setup-card">
      <div className="card-title">Styles</div>
      {message && <div className={validation.ok ? 'alert success' : 'alert error'}>{message}</div>}
      <div className="form-grid">
        <label>Theme Name<input value={styles.themeName} onChange={(event) => patch('themeName', event.target.value)} /></label>
        <label>Canvas Background<input value={styles.canvasBackground} onChange={(event) => patch('canvasBackground', event.target.value)} /></label>
        <label>Primary Color<input value={styles.primaryColor} onChange={(event) => patch('primaryColor', event.target.value)} /></label>
        <label>High Alarm Color<input value={styles.alarmHighColor} onChange={(event) => patch('alarmHighColor', event.target.value)} /></label>
        <label>Medium Alarm Color<input value={styles.alarmMediumColor} onChange={(event) => patch('alarmMediumColor', event.target.value)} /></label>
        <label>Low Alarm Color<input value={styles.alarmLowColor} onChange={(event) => patch('alarmLowColor', event.target.value)} /></label>
        <label>Default Font Size<input type="number" value={styles.defaultFontSize} onChange={(event) => patch('defaultFontSize', Number(event.target.value))} /></label>
        <label>Grid Size<input type="number" value={styles.gridSize} onChange={(event) => patch('gridSize', Number(event.target.value))} /></label>
      </div>
      <div className="button-row">
        <button className="btn primary" onClick={save}>
          <Icon icon="solar:check-circle-bold-duotone" width="16" height="16" style={{ marginRight: 6, color: '#ec4899', verticalAlign: 'middle' }} />
          Save Styles
        </button>
      </div>
      <pre className="path-box">{validationText(validation)}</pre>
    </section>
  );
}

function AssetsPanel() {
  const { showConfirm } = useModal();
  const [assets, setAssets] = useState<GraphicAsset[]>(() => loadGraphicAssets());
  const [filter, setFilter] = useState<GraphicAssetKind | 'all'>('all');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function importAssets(files: FileList | null) {
    if (!files?.length) return;
    setError('');
    const next = [...assets];

    for (const file of Array.from(files)) {
      const kind = assetKindFromFile(file);
      if (!kind) {
        setError(`${file.name}: unsupported type. Use image, GLB/GLTF, Lottie JSON, or video.`);
        continue;
      }
      const url = await readFileAsDataUrl(file);
      next.unshift({
        id: makeId('asset'),
        name: file.name,
        kind,
        url,
        mimeType: file.type || undefined,
        fileSize: file.size,
        createdAt: nowIso(),
      });
    }

    setAssets(next);
    saveGraphicAssets(next);
    saveJson(LS_IMAGES, next.filter((a) => a.kind === 'image').map((a) => ({ id: a.id, name: a.name, dataUrl: a.url, createdAt: a.createdAt })));
    setMessage(`${files.length} file(s) imported to asset library.`);
  }

  async function importFromSharedLibrary() {
    setError('');
    setMessage('');
    try {
      const { added } = await syncSharedAssetsFromEngine(getEngineUrl());
      setAssets(loadGraphicAssets());
      setMessage(added.length > 0
        ? `Synced ${added.length} asset(s) from Engine shared library.`
        : 'No new shared assets on Engine (upload via API or convert FBX).');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function removeAsset(id: string) {
    if (!await showConfirm('Delete selected asset from library?')) return;
    const next = assets.filter((a) => a.id !== id);
    setAssets(next);
    saveGraphicAssets(next);
    saveJson(LS_IMAGES, next.filter((a) => a.kind === 'image').map((a) => ({ id: a.id, name: a.name, dataUrl: a.url, createdAt: a.createdAt })));
    setMessage('Asset deleted.');
  }

  const filtered = filter === 'all' ? assets : assets.filter((a) => a.kind === filter);
  const kindLabel: Record<GraphicAssetKind, string> = {
    image: 'Image',
    model3d: '3D',
    lottie: 'Lottie',
    video: 'Video',
    sprite: 'Sprite',
    svg: 'SVG',
    spline: 'Spline',
    html: 'HTML',
  };

  return (
    <section className="card setup-card">
      <div className="card-title">Asset Library</div>
      <p className="prop-hint" style={{ marginBottom: 10 }}>Images, GLB/GLTF 3D models, Lottie JSON, and video loops for graphics scenes.</p>
      {message && <div className="alert success">{message}</div>}
      {error && <div className="alert error">{error}</div>}
      <div className="button-row" style={{ alignItems: 'center', gap: 8 }}>
        <label className="btn primary">
          <Icon icon="solar:upload-bold-duotone" width="16" height="16" style={{ marginRight: 6, color: '#0ea5e9', verticalAlign: 'middle' }} />
          Import Assets
          <input type="file" accept={acceptFilterForKind('all')} multiple hidden onChange={(event) => void importAssets(event.target.files)} />
        </label>
        <button type="button" className="btn secondary" onClick={() => void importFromSharedLibrary()}>
          <Icon icon="solar:cloud-download-bold-duotone" width="16" height="16" style={{ marginRight: 6, verticalAlign: 'middle' }} />
          Sync from Engine
        </button>
        <select value={filter} onChange={(e) => setFilter(e.target.value as GraphicAssetKind | 'all')}>
          <option value="all">All types</option>
          <option value="image">Images</option>
          <option value="model3d">3D Models</option>
          <option value="lottie">Lottie</option>
          <option value="video">Video</option>
        </select>
      </div>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Preview</th>
            <th>Created</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {filtered.map((asset) => (
            <tr key={asset.id}>
              <td>{asset.name}</td>
              <td>{kindLabel[asset.kind]}</td>
              <td>
                {asset.kind === 'image' ? (
                  <img src={asset.url} alt={asset.name} style={{ width: 72, height: 42, objectFit: 'contain' }} />
                ) : asset.kind === 'model3d' ? (
                  <Icon icon="solar:cube-bold-duotone" width="32" height="32" style={{ color: '#6366f1' }} />
                ) : (
                  <Icon icon="solar:file-bold-duotone" width="28" height="28" style={{ color: '#64748b' }} />
                )}
              </td>
              <td>{new Date(asset.createdAt).toLocaleString()}</td>
              <td>
                <button className="btn danger" type="button" onClick={() => void removeAsset(asset.id)}>
                  <Icon icon="solar:trash-bin-trash-bold-duotone" width="14" height="14" style={{ marginRight: 4, color: '#fca5a5', verticalAlign: 'middle' }} />
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {filtered.length === 0 && <div className="empty-state">No assets imported yet. GLB/GLTF import directly; FBX/OBJ convert to GLB externally for now.</div>}
    </section>
  );
}

function ImagesPanel() {
  return <AssetsPanel />;
}

function SymbolsPanel() {
  const { showConfirm } = useModal();
  const [symbols, setSymbols] = useState<GraphicSymbol[]>(() => loadGraphicSymbols());
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function importSymbols(files: FileList | null) {
    if (!files?.length) return;
    setError('');
    const next = [...symbols];
    for (const file of Array.from(files)) {
      if (!file.name.toLowerCase().endsWith('.svg')) {
        setError(`${file.name}: use .svg files only.`);
        continue;
      }
      try {
        const svgContent = await readSvgFile(file);
        next.unshift({
          id: makeId('sym'),
          name: file.name.replace(/\.svg$/i, ''),
          svgContent,
          createdAt: nowIso(),
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    }
    setSymbols(next);
    saveGraphicSymbols(next);
    setMessage(`${files.length} symbol(s) imported. Use in Elec Symbol → Custom Symbol.`);
  }

  async function removeSymbol(id: string) {
    if (!await showConfirm('Delete symbol from library?')) return;
    const next = symbols.filter((s) => s.id !== id);
    setSymbols(next);
    saveGraphicSymbols(next);
  }

  return (
    <section className="card setup-card">
      <div className="card-title">Custom SVG Symbol Library</div>
      <p className="prop-hint">Import SVG files for SLD equipment symbols. Assign via Graphics → Elec Symbol → Custom Symbol.</p>
      {message && <div className="alert success">{message}</div>}
      {error && <div className="alert error">{error}</div>}
      <label className="btn secondary" style={{ display: 'inline-flex', cursor: 'pointer' }}>
        Import SVG
        <input type="file" accept=".svg,image/svg+xml" multiple hidden onChange={(e) => void importSymbols(e.target.files)} />
      </label>
      <table className="setup-table" style={{ marginTop: 12 }}>
        <thead><tr><th>Preview</th><th>Name</th><th>Added</th><th></th></tr></thead>
        <tbody>
          {symbols.map((sym) => (
            <tr key={sym.id}>
              <td><div className="symbol-preview-thumb" dangerouslySetInnerHTML={{ __html: sym.svgContent.includes('<svg') ? sym.svgContent : `<svg viewBox="0 0 64 64">${sym.svgContent}</svg>` }} /></td>
              <td>{sym.name}</td>
              <td>{new Date(sym.createdAt).toLocaleString()}</td>
              <td><button type="button" className="btn danger" onClick={() => void removeSymbol(sym.id)}>Delete</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      {symbols.length === 0 && <div className="empty-state">No custom symbols yet. Built-in breaker, meter, door, lamp still available.</div>}
    </section>
  );
}

function VariablesPanel() {
  const { showConfirm } = useModal();
  const [variables, setVariables] = useState<CalculatedVariable[]>(loadJson(LS_VARIABLES, []));
  const [draft, setDraft] = useState<CalculatedVariable>({ id: '', name: '', expression: '', unit: 'kWh', description: '', enabled: true, createdAt: '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  function resetDraft() {
    setDraft({ id: '', name: '', expression: '', unit: 'kWh', description: '', enabled: true, createdAt: '' });
  }

  function saveVariable() {
    setError('');
    const nextVariable = { ...draft, id: draft.id || makeId('calc'), createdAt: draft.createdAt || nowIso() };
    const validation = validateVariable(nextVariable);
    if (!validation.ok) {
      setError(validation.errors.join(', '));
      return;
    }
    const duplicate = variables.find((item) => item.id !== nextVariable.id && item.name.toLowerCase() === nextVariable.name.toLowerCase());
    if (duplicate) {
      setError('Calculated variable name already exists.');
      return;
    }
    const next = variables.some((item) => item.id === nextVariable.id)
      ? variables.map((item) => item.id === nextVariable.id ? nextVariable : item)
      : [nextVariable, ...variables];
    setVariables(next);
    saveJson(LS_VARIABLES, next);
    setMessage('Calculated variable saved. It will be evaluated only when referenced tag values exist.');
    resetDraft();
  }

  function editVariable(variable: CalculatedVariable) {
    setDraft(variable);
  }

  async function deleteVariable(id: string) {
    if (!await showConfirm('Delete calculated variable?')) return;
    const next = variables.filter((item) => item.id !== id);
    setVariables(next);
    saveJson(LS_VARIABLES, next);
  }

  return (
    <section className="card setup-card">
      <div className="card-title">Calculated Variables</div>
      {message && <div className="alert success">{message}</div>}
      {error && <div className="alert error">{error}</div>}
      <div className="form-grid">
        <label>Name<input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} /></label>
        <label>Expression<input value={draft.expression} onChange={(event) => setDraft((current) => ({ ...current, expression: event.target.value }))} /></label>
        <label>Unit<input value={draft.unit} onChange={(event) => setDraft((current) => ({ ...current, unit: event.target.value }))} /></label>
        <label>Description<input value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} /></label>
        <label>Enabled<select value={String(draft.enabled)} onChange={(event) => setDraft((current) => ({ ...current, enabled: event.target.value === 'true' }))}><option value="true">Enabled</option><option value="false">Disabled</option></select></label>
      </div>
      <div className="button-row">
        <button className="btn primary" onClick={saveVariable}>
          <Icon icon="solar:check-circle-bold-duotone" width="16" height="16" style={{ marginRight: 6, color: '#8b5cf6', verticalAlign: 'middle' }} />
          Save Variable
        </button>
        <button className="btn secondary" onClick={resetDraft}>
          <Icon icon="solar:eraser-bold-duotone" width="16" height="16" style={{ marginRight: 6, color: '#9ca3af', verticalAlign: 'middle' }} />
          Clear
        </button>
      </div>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Expression</th>
            <th>Unit</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {variables.map((variable) => (
            <tr key={variable.id}>
              <td>{variable.name}</td>
              <td>{variable.expression}</td>
              <td>{variable.unit}</td>
              <td>{variable.enabled ? 'Enabled' : 'Disabled'}</td>
              <td>
                <button className="btn secondary" onClick={() => editVariable(variable)}>
                  <Icon icon="solar:pen-bold-duotone" width="14" height="14" style={{ marginRight: 4, color: '#8b5cf6', verticalAlign: 'middle' }} />
                  Edit
                </button>
                <button className="btn danger" onClick={() => deleteVariable(variable.id)}>
                  <Icon icon="solar:trash-bin-trash-bold-duotone" width="14" height="14" style={{ marginRight: 4, color: '#fca5a5', verticalAlign: 'middle' }} />
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {variables.length === 0 && <div className="empty-state">No calculated variables created yet.</div>}
    </section>
  );
}

function NotificationSettings() {
  const [channels, setChannels] = useState<NotificationChannel[]>([]);
  const [rules, setRules] = useState<NotificationRule[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function load() {
    setError('');
    setMessage('');
    try {
      const [nextChannels, nextRules] = await Promise.all([notificationApi.listChannels(), notificationApi.listRules()]);
      setChannels(nextChannels);
      setRules(nextRules);
      setMessage('Notification settings loaded from Engine.');
    } catch (err) {
      setError(`Engine is not connected. Notification settings need the Engine API. ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  useEffect(() => { void load(); }, []);

  async function addSoundChannel() {
    setError('');
    try {
      await notificationApi.createChannel({ name: 'Local Alarm Sound', type: 'sound', enabled: true, configJson: JSON.stringify({ tone: 'default' }) });
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : String(err)); }
  }

  async function addAlarmRule() {
    if (!channels[0]) { setError('Create a channel before creating a rule.'); return; }
    try {
      await notificationApi.createRule({ name: 'Alarm Raised Notification', channelId: channels[0].id, enabled: true, eventType: 'alarm_raised', minSeverity: 'medium' });
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : String(err)); }
  }

  return (
    <section className="card setup-card">
      <div className="card-title">Alarm Events and Notification</div>
      {message && <div className="alert success">{message}</div>}
      {error && <div className="alert error">{error}</div>}
      <div className="button-row">
        <button className="btn secondary" onClick={() => void load()}>
          <Icon icon="solar:refresh-bold-duotone" width="16" height="16" style={{ marginRight: 6, color: '#3b82f6', verticalAlign: 'middle' }} />
          Refresh
        </button>
        <button className="btn primary" onClick={() => void addSoundChannel()}>
          <Icon icon="solar:music-library-2-bold-duotone" width="16" height="16" style={{ marginRight: 6, color: '#f43f5e', verticalAlign: 'middle' }} />
          Add Sound Channel
        </button>
        <button className="btn primary" onClick={() => void addAlarmRule()}>
          <Icon icon="solar:bell-bing-bold-duotone" width="16" height="16" style={{ marginRight: 6, color: '#f43f5e', verticalAlign: 'middle' }} />
          Add Alarm Rule
        </button>
      </div>
      <h3>Channels</h3>
      <table>
        <tbody>
          {channels.map((channel) => (
            <tr key={channel.id}>
              <td>{channel.name}</td>
              <td>{channel.type}</td>
              <td>{channel.enabled ? 'Enabled' : 'Disabled'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h3>Rules</h3>
      <table>
        <tbody>
          {rules.map((rule) => (
            <tr key={rule.id}>
              <td>{rule.name}</td>
              <td>{rule.eventType}</td>
              <td>{rule.minSeverity}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function WebViewerPanel() {
  const [settings, setSettings] = useState(loadJson(LS_WEB_VIEWER, { enabled: true, port: 8081, remoteAccess: false, startPath: '/' }));
  const [message, setMessage] = useState('');

  function save() {
    if (!Number.isInteger(Number(settings.port)) || Number(settings.port) < 1 || Number(settings.port) > 65535) {
      setMessage('Web Viewer port must be 1-65535.');
      return;
    }
    saveJson(LS_WEB_VIEWER, settings);
    setMessage('Web Viewer settings saved.');
  }

  return (
    <section className="card setup-card">
      <div className="card-title">Web Viewer</div>
      {message && <div className="alert success">{message}</div>}
      <div className="form-grid">
        <label>
          Enabled
          <select value={String(settings.enabled)} onChange={(event) => setSettings({ ...settings, enabled: event.target.value === 'true' })}>
            <option value="true">Enabled</option>
            <option value="false">Disabled</option>
          </select>
        </label>
        <label>
          Port
          <input type="number" value={settings.port} onChange={(event) => setSettings({ ...settings, port: Number(event.target.value) })} />
        </label>
        <label>
          Remote Access
          <select value={String(settings.remoteAccess)} onChange={(event) => setSettings({ ...settings, remoteAccess: event.target.value === 'true' })}>
            <option value="false">Local Only</option>
            <option value="true">Allow Remote</option>
          </select>
        </label>
        <label>
          Start Path
          <input value={settings.startPath} onChange={(event) => setSettings({ ...settings, startPath: event.target.value })} />
        </label>
      </div>
      <div className="button-row">
        <button className="btn primary" onClick={save}>
          <Icon icon="solar:check-circle-bold-duotone" width="16" height="16" style={{ marginRight: 6, color: '#06b6d4', verticalAlign: 'middle' }} />
          Save Web Viewer Settings
        </button>
        <button className="btn secondary" onClick={() => window.open(`${getEngineUrl()}${settings.startPath}`, '_blank')}>
          <Icon icon="solar:link-bold-duotone" width="16" height="16" style={{ marginRight: 6, color: '#0891b2', verticalAlign: 'middle' }} />
          Open Web Viewer
        </button>
      </div>
    </section>
  );
}

function DatabasePanel() {
  const [state, setState] = useState(loadJson(LS_DATABASE, { path: 'ProgramData/EnergyLink Management/data/energylink.db', lastChecked: '', connected: false, message: 'Not checked' }));

  async function check() {
    try {
      const response = await fetch(`${getEngineUrl()}/api/status`);
      const data = await response.json().catch(() => ({}));
      const next = { ...state, lastChecked: nowIso(), connected: response.ok, message: response.ok ? JSON.stringify(data, null, 2) : `HTTP ${response.status}` };
      setState(next);
      saveJson(LS_DATABASE, next);
    } catch (err) {
      const next = { ...state, lastChecked: nowIso(), connected: false, message: err instanceof Error ? err.message : String(err) };
      setState(next);
      saveJson(LS_DATABASE, next);
    }
  }

  return (
    <section className="card setup-card">
      <div className="card-title">Database</div>
      <div className="button-row">
        <button className="btn primary" onClick={() => void check()}>
          <Icon icon="solar:shield-check-bold-duotone" width="16" height="16" style={{ marginRight: 6, color: '#818cf8', verticalAlign: 'middle' }} />
          Check Engine / Database
        </button>
      </div>
      <pre className="path-box">
        Path: {state.path}
        {'\n'}Connected: {String(state.connected)}
        {'\n'}Last Checked: {state.lastChecked || '-'}
        {'\n'}{state.message}
      </pre>
    </section>
  );
}

function BackupPanel() {
  const { showConfirm } = useModal();
  const [backups, setBackups] = useState<LocalBackup[]>(loadJson(LS_BACKUPS, []));
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');

  async function createBackup() {
    setError('');
    const localPayload = {
      createdAt: nowIso(),
      units: loadJson(LS_UNITS, defaultUnits),
      styles: loadJson(LS_STYLES, defaultStyles),
      images: loadJson<ImageItem[]>(LS_IMAGES, []),
      variables: loadJson<CalculatedVariable[]>(LS_VARIABLES, []),
      runtime: loadJson('energylink.setup.runtime.local.v1', defaultRuntime),
      webViewer: loadJson(LS_WEB_VIEWER, {})
    };

    try {
      const response = await fetch(`${getEngineUrl()}/api/backups`, { method: 'POST' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || data.message || `HTTP ${response.status}`);
      setOutput(JSON.stringify(data, null, 2));
    } catch (err) {
      const backup: LocalBackup = { id: makeId('backup'), name: `Local setup backup ${new Date().toLocaleString()}`, createdAt: nowIso(), payloadJson: JSON.stringify(localPayload, null, 2) };
      const next = [backup, ...backups];
      setBackups(next);
      saveJson(LS_BACKUPS, next);
      setOutput(`Engine backup is not available, so local setup backup was created.\n${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async function restoreBackup(backup: LocalBackup) {
    if (!await showConfirm('Restore this local setup backup? Current local setup values will be overwritten.')) return;
    const payload = JSON.parse(backup.payloadJson) as Record<string, unknown>;
    if (payload.units) saveJson(LS_UNITS, payload.units);
    if (payload.styles) saveJson(LS_STYLES, payload.styles);
    if (payload.images) saveJson(LS_IMAGES, payload.images);
    if (payload.variables) saveJson(LS_VARIABLES, payload.variables);
    if (payload.runtime) saveJson('energylink.setup.runtime.local.v1', payload.runtime);
    if (payload.webViewer) saveJson(LS_WEB_VIEWER, payload.webViewer);
    setOutput('Local setup backup restored. Reload Editor to apply all screens.');
  }

  async function deleteBackup(id: string) {
    if (!await showConfirm('Delete selected local setup backup?')) return;
    const next = backups.filter((backup) => backup.id !== id);
    setBackups(next);
    saveJson(LS_BACKUPS, next);
  }

  return (
    <section className="card setup-card">
      <div className="card-title">Backup</div>
      {error && <div className="alert error">{error}</div>}
      <div className="button-row">
        <button className="btn primary" onClick={() => void createBackup()}>
          <Icon icon="solar:archive-bold-duotone" width="16" height="16" style={{ marginRight: 6, color: '#9ca3af', verticalAlign: 'middle' }} />
          Create Backup
        </button>
      </div>
      <pre className="path-box">{output || 'No backup action yet.'}</pre>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Created</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {backups.map((backup) => (
            <tr key={backup.id}>
              <td>{backup.name}</td>
              <td>{new Date(backup.createdAt).toLocaleString()}</td>
              <td>
                <button className="btn secondary" onClick={() => restoreBackup(backup)}>
                  <Icon icon="solar:history-bold-duotone" width="14" height="14" style={{ marginRight: 4, color: '#4b5563', verticalAlign: 'middle' }} />
                  Restore
                </button>
                <button className="btn danger" onClick={() => deleteBackup(backup.id)}>
                  <Icon icon="solar:trash-bin-trash-bold-duotone" width="14" height="14" style={{ marginRight: 4, color: '#fca5a5', verticalAlign: 'middle' }} />
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function MaintenancePanel() {
  const [output, setOutput] = useState('No maintenance action yet.');

  async function runMaintenance() {
    try {
      const response = await fetch(`${getEngineUrl()}/api/maintenance/run`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jobs: ['history_retention', 'log_retention', 'backup_retention', 'database_vacuum'] }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || data.message || `HTTP ${response.status}`);
      setOutput(JSON.stringify(data, null, 2));
    } catch (err) {
      const backups = loadJson<LocalBackup[]>(LS_BACKUPS, []);
      const retentionDays = loadJson('energylink.setup.runtime.local.v1', defaultRuntime).backupRetentionDays;
      const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
      const kept = backups.filter((backup) => new Date(backup.createdAt).getTime() >= cutoff);
      saveJson(LS_BACKUPS, kept);
      setOutput(`Engine maintenance is not available. Local setup backup retention completed. Removed ${backups.length - kept.length} local backup(s).\n${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return (
    <section className="card setup-card">
      <div className="card-title">Maintenance</div>
      <div className="button-row">
        <button className="btn primary" onClick={() => void runMaintenance()}>
          <Icon icon="solar:tuning-square-bold-duotone" width="16" height="16" style={{ marginRight: 6, color: '#2dd4bf', verticalAlign: 'middle' }} />
          Run Maintenance
        </button>
      </div>
      <pre className="path-box">{output}</pre>
    </section>
  );
}

function AboutPanel() {
  return <section className="card setup-card"><div className="card-title">EnergyLink Management</div><p>Desktop-first SCADA/EMS software with Editor, Monitor, Engine, and Web Viewer. This build is Local Open and contains no login and no account gate requirement. Runtime values are never generated by Setup; values appear only when real device communication and history records exist.</p></section>;
}

