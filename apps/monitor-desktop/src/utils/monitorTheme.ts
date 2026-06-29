export const THEME_STORAGE_KEY = 'energylink.monitor.theme.v2';

export type MonitorThemePresetId = 'default' | 'dark' | 'ocean' | 'high-contrast' | 'custom';

export type MonitorThemeTokenKey =
  | 'teal900'
  | 'teal800'
  | 'teal700'
  | 'teal600'
  | 'teal100'
  | 'teal050'
  | 'bg'
  | 'panel'
  | 'line'
  | 'text'
  | 'muted'
  | 'ink'
  | 'green'
  | 'red'
  | 'amber'
  | 'chartPrimary'
  | 'chartPrimarySoft'
  | 'headerBg'
  | 'headerFg'
  | 'statusbarBg'
  | 'statusbarFg'
  | 'accentGlow1'
  | 'accentGlow2'
  | 'scrollbarTrack'
  | 'scrollbarThumb'
  | 'scrollbarThumbHover';

export type MonitorThemeTokens = Record<MonitorThemeTokenKey, string>;

export type MonitorThemeState = {
  presetId: MonitorThemePresetId;
  customTokens: Partial<MonitorThemeTokens>;
};

const TOKEN_TO_CSS: Record<MonitorThemeTokenKey, string> = {
  teal900: '--teal-900',
  teal800: '--teal-800',
  teal700: '--teal-700',
  teal600: '--teal-600',
  teal100: '--teal-100',
  teal050: '--teal-050',
  bg: '--bg',
  panel: '--panel',
  line: '--line',
  text: '--text',
  muted: '--muted',
  ink: '--ink',
  green: '--green',
  red: '--red',
  amber: '--amber',
  chartPrimary: '--chart-primary',
  chartPrimarySoft: '--chart-primary-soft',
  headerBg: '--header-bg',
  headerFg: '--header-fg',
  statusbarBg: '--statusbar-bg',
  statusbarFg: '--statusbar-fg',
  accentGlow1: '--accent-glow-1',
  accentGlow2: '--accent-glow-2',
  scrollbarTrack: '--scrollbar-track',
  scrollbarThumb: '--scrollbar-thumb',
  scrollbarThumbHover: '--scrollbar-thumb-hover',
};

export const DEFAULT_THEME_TOKENS: MonitorThemeTokens = {
  teal900: '#5c4a1f',
  teal800: '#7a6528',
  teal700: '#b8860b',
  teal600: '#d4af37',
  teal100: '#faf6eb',
  teal050: '#ffffff',
  bg: '#ffffff',
  panel: '#ffffff',
  line: '#ebe4d4',
  text: '#1c1c1c',
  muted: '#6b6560',
  ink: '#141414',
  green: '#6bbf8a',
  red: '#e05c5c',
  amber: '#d4a84b',
  chartPrimary: '#c9a227',
  chartPrimarySoft: '#e8d48b',
  headerBg: 'linear-gradient(180deg, #ffffff 0%, #fffef9 55%, #faf6eb 100%)',
  headerFg: '#1c1c1c',
  statusbarBg: 'linear-gradient(90deg, #ffffff 0%, #faf6eb 100%)',
  statusbarFg: '#5c4a1f',
  accentGlow1: 'rgba(212, 175, 55, 0.1)',
  accentGlow2: 'rgba(107, 187, 138, 0.07)',
  scrollbarTrack: '#f5f5f5',
  scrollbarThumb: '#ddd5c0',
  scrollbarThumbHover: '#d4af37',
};

function headerFromTeal(teal900: string, teal700: string, teal600: string): string {
  return `linear-gradient(135deg, ${teal900} 0%, ${teal700} 55%, ${teal600} 100%)`;
}

const DARK: MonitorThemeTokens = {
  teal900: '#0c4a6e',
  teal800: '#075985',
  teal700: '#0ea5e9',
  teal600: '#38bdf8',
  teal100: '#1e3a4a',
  teal050: '#0f172a',
  bg: '#0b1220',
  panel: 'rgba(15, 23, 42, 0.92)',
  line: '#1e293b',
  text: '#e2e8f0',
  muted: '#94a3b8',
  ink: '#f8fafc',
  green: '#34d399',
  red: '#f87171',
  amber: '#fbbf24',
  chartPrimary: '#38bdf8',
  chartPrimarySoft: '#0ea5e9',
  headerBg: headerFromTeal('#0c4a6e', '#0ea5e9', '#38bdf8'),
  headerFg: '#ffffff',
  statusbarBg: 'linear-gradient(90deg, #0c4a6e, #075985)',
  statusbarFg: 'rgba(255, 255, 255, 0.9)',
  accentGlow1: 'rgba(14, 165, 233, 0.12)',
  accentGlow2: 'rgba(56, 189, 248, 0.08)',
  scrollbarTrack: '#111827',
  scrollbarThumb: '#334155',
  scrollbarThumbHover: '#38bdf8',
};

const OCEAN: MonitorThemeTokens = {
  teal900: '#1e3a8a',
  teal800: '#1d4ed8',
  teal700: '#2563eb',
  teal600: '#3b82f6',
  teal100: '#dbeafe',
  teal050: '#eff6ff',
  bg: '#eef4ff',
  panel: 'rgba(255, 255, 255, 0.9)',
  line: '#c7d7fe',
  text: '#0f172a',
  muted: '#64748b',
  ink: '#0f172a',
  green: '#10b981',
  red: '#ef4444',
  amber: '#f59e0b',
  chartPrimary: '#2563eb',
  chartPrimarySoft: '#3b82f6',
  headerBg: headerFromTeal('#1e3a8a', '#2563eb', '#3b82f6'),
  headerFg: '#ffffff',
  statusbarBg: 'linear-gradient(90deg, #1e3a8a, #1d4ed8)',
  statusbarFg: 'rgba(255, 255, 255, 0.9)',
  accentGlow1: 'rgba(37, 99, 235, 0.1)',
  accentGlow2: 'rgba(59, 130, 246, 0.07)',
  scrollbarTrack: '#e8efff',
  scrollbarThumb: '#b8c9f5',
  scrollbarThumbHover: '#2563eb',
};

const HIGH_CONTRAST: MonitorThemeTokens = {
  teal900: '#003d44',
  teal800: '#004f58',
  teal700: '#006b75',
  teal600: '#00838f',
  teal100: '#b8e8ee',
  teal050: '#ffffff',
  bg: '#ffffff',
  panel: '#ffffff',
  line: '#0f172a',
  text: '#000000',
  muted: '#334155',
  ink: '#000000',
  green: '#047857',
  red: '#b91c1c',
  amber: '#b45309',
  chartPrimary: '#006b75',
  chartPrimarySoft: '#00838f',
  headerBg: headerFromTeal('#003d44', '#006b75', '#00838f'),
  headerFg: '#ffffff',
  statusbarBg: 'linear-gradient(90deg, #003d44, #004f58)',
  statusbarFg: 'rgba(255, 255, 255, 0.9)',
  accentGlow1: 'rgba(0, 107, 117, 0.06)',
  accentGlow2: 'rgba(0, 131, 143, 0.04)',
  scrollbarTrack: '#f1f5f9',
  scrollbarThumb: '#475569',
  scrollbarThumbHover: '#006b75',
};

export const THEME_PRESETS: Record<
  Exclude<MonitorThemePresetId, 'custom'>,
  { label: string; description: string; tokens: MonitorThemeTokens }
> = {
  default: {
    label: 'Premium Gold',
    description: 'Bright white with premium gold accents',
    tokens: DEFAULT_THEME_TOKENS,
  },
  dark: {
    label: 'Dark',
    description: 'Low-light operations room',
    tokens: DARK,
  },
  ocean: {
    label: 'Ocean',
    description: 'Blue accent variant',
    tokens: OCEAN,
  },
  'high-contrast': {
    label: 'High contrast',
    description: 'Strong borders and text',
    tokens: HIGH_CONTRAST,
  },
};

export const THEME_TOKEN_GROUPS: Array<{
  title: string;
  keys: MonitorThemeTokenKey[];
}> = [
  {
    title: 'Brand',
    keys: ['teal900', 'teal800', 'teal700', 'teal600', 'teal100', 'teal050'],
  },
  {
    title: 'Surfaces',
    keys: ['bg', 'panel', 'line'],
  },
  {
    title: 'Text',
    keys: ['text', 'muted', 'ink'],
  },
  {
    title: 'Status',
    keys: ['green', 'red', 'amber'],
  },
  {
    title: 'Charts',
    keys: ['chartPrimary', 'chartPrimarySoft'],
  },
];

export const THEME_TOKEN_LABELS: Record<MonitorThemeTokenKey, string> = {
  teal900: 'Teal 900',
  teal800: 'Teal 800',
  teal700: 'Primary',
  teal600: 'Teal 600',
  teal100: 'Teal 100',
  teal050: 'Teal 050',
  bg: 'Background',
  panel: 'Panel',
  line: 'Border / line',
  text: 'Text',
  muted: 'Muted text',
  ink: 'Ink',
  green: 'Success',
  red: 'Danger',
  amber: 'Warning',
  chartPrimary: 'Chart primary',
  chartPrimarySoft: 'Chart secondary',
  headerBg: 'Header gradient',
  headerFg: 'Header text',
  statusbarBg: 'Status bar background',
  statusbarFg: 'Status bar text',
  accentGlow1: 'Accent glow 1',
  accentGlow2: 'Accent glow 2',
  scrollbarTrack: 'Scrollbar track',
  scrollbarThumb: 'Scrollbar thumb',
  scrollbarThumbHover: 'Scrollbar hover',
};

const GRADIENT_KEYS = new Set<MonitorThemeTokenKey>(['headerBg', 'statusbarBg']);
const RGBA_KEYS = new Set<MonitorThemeTokenKey>(['panel', 'accentGlow1', 'accentGlow2']);

export function isGradientToken(key: MonitorThemeTokenKey): boolean {
  return GRADIENT_KEYS.has(key);
}

export function isRgbaToken(key: MonitorThemeTokenKey): boolean {
  return RGBA_KEYS.has(key);
}

export function resolveThemeTokens(state: MonitorThemeState): MonitorThemeTokens {
  const base =
    state.presetId === 'custom'
      ? DEFAULT_THEME_TOKENS
      : THEME_PRESETS[state.presetId].tokens;
  return { ...base, ...state.customTokens };
}

export function applyThemeTokens(tokens: MonitorThemeTokens): void {
  const root = document.documentElement;
  for (const [key, value] of Object.entries(tokens) as Array<[MonitorThemeTokenKey, string]>) {
    root.style.setProperty(TOKEN_TO_CSS[key], value);
  }
  applyDerivedThemeVars(tokens);
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = hex.trim().replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return null;
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
}

/** Shadow and other values derived from brand colors. */
function applyDerivedThemeVars(tokens: MonitorThemeTokens): void {
  const root = document.documentElement;
  const rgb = hexToRgb(tokens.teal900);
  if (rgb) {
    const { r, g, b } = rgb;
    root.style.setProperty('--shadow-sm', `0 2px 8px rgba(${r}, ${g}, ${b}, 0.05)`);
    root.style.setProperty('--shadow-md', `0 8px 24px rgba(${r}, ${g}, ${b}, 0.08)`);
    root.style.setProperty('--shadow-lg', `0 16px 40px rgba(${r}, ${g}, ${b}, 0.1)`);
    root.style.setProperty('--titlebar-shadow', `0 2px 16px rgba(${r}, ${g}, ${b}, 0.08)`);
    root.style.setProperty('--panel-edge-shadow', `4px 0 20px rgba(${r}, ${g}, ${b}, 0.03)`);
  }
}

export function loadThemeState(): MonitorThemeState {
  if (typeof window === 'undefined') {
    return { presetId: 'default', customTokens: {} };
  }
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (!raw) return { presetId: 'default', customTokens: {} };
    const parsed = JSON.parse(raw) as MonitorThemeState;
    const presetId = parsed.presetId ?? 'default';
    const validPreset =
      presetId === 'custom' || presetId in THEME_PRESETS ? presetId : 'default';
    return {
      presetId: validPreset as MonitorThemePresetId,
      customTokens: parsed.customTokens ?? {},
    };
  } catch {
    return { presetId: 'default', customTokens: {} };
  }
}

export function saveThemeState(state: MonitorThemeState): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(state));
}

export function exportThemeJson(state: MonitorThemeState): string {
  return JSON.stringify(
    {
      version: 1,
      presetId: state.presetId,
      customTokens: state.customTokens,
      resolved: resolveThemeTokens(state),
    },
    null,
    2,
  );
}

export function importThemeJson(raw: string): MonitorThemeState {
  const parsed = JSON.parse(raw) as {
    presetId?: MonitorThemePresetId;
    customTokens?: Partial<MonitorThemeTokens>;
    resolved?: Partial<MonitorThemeTokens>;
  };
  if (parsed.resolved) {
    return { presetId: 'custom', customTokens: parsed.resolved };
  }
  const presetId = parsed.presetId ?? 'default';
  const validPreset =
    presetId === 'custom' || presetId in THEME_PRESETS ? presetId : 'default';
  return {
    presetId: validPreset as MonitorThemePresetId,
    customTokens: parsed.customTokens ?? {},
  };
}

/** Parse #rgb / #rrggbb for color input; rgba returns fallback. */
export function toColorInputValue(value: string, fallback = '#087c8b'): string {
  const hex = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(hex)) return hex;
  if (/^#[0-9a-fA-F]{3}$/.test(hex)) {
    const [, r, g, b] = hex;
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  const match = hex.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (match) {
    const r = Number(match[1]).toString(16).padStart(2, '0');
    const g = Number(match[2]).toString(16).padStart(2, '0');
    const b = Number(match[3]).toString(16).padStart(2, '0');
    return `#${r}${g}${b}`;
  }
  return fallback;
}

export function syncHeaderFromPrimary(tokens: MonitorThemeTokens): MonitorThemeTokens {
  const isLight = tokens.bg.trim().toLowerCase() === '#ffffff' || tokens.bg.startsWith('#fff');
  return {
    ...tokens,
    headerBg: isLight
      ? `linear-gradient(180deg, #ffffff 0%, #fffef9 55%, ${tokens.teal100} 100%)`
      : headerFromTeal(tokens.teal900, tokens.teal700, tokens.teal600),
    statusbarBg: isLight
      ? `linear-gradient(90deg, #ffffff 0%, ${tokens.teal100} 100%)`
      : `linear-gradient(90deg, ${tokens.teal900}, ${tokens.teal800})`,
    chartPrimary: tokens.teal700,
    chartPrimarySoft: tokens.teal600,
    scrollbarThumbHover: tokens.teal600,
  };
}

/** Re-apply derived CSS vars after custom token edits (shadows, statusbar). */
export function applyDerivedTheme(tokens: MonitorThemeTokens): void {
  applyDerivedThemeVars(tokens);
}
