import React from 'react';
import { Download, RotateCcw, Upload, X } from 'lucide-react';
import { useMonitorTheme } from './MonitorThemeProvider';
import {
  isGradientToken,
  isRgbaToken,
  THEME_PRESETS,
  THEME_TOKEN_GROUPS,
  THEME_TOKEN_LABELS,
  toColorInputValue,
  type MonitorThemePresetId,
  type MonitorThemeTokenKey,
} from '../utils/monitorTheme';

type ThemeCustomizerProps = {
  open: boolean;
  onClose: () => void;
};

export function ThemeCustomizer({ open, onClose }: ThemeCustomizerProps) {
  const { state, tokens, applyPreset, setToken, syncHeaderFromBrand, resetTheme, exportTheme, importTheme } =
    useMonitorTheme();
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [importError, setImportError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleExport = () => {
    const blob = new Blob([exportTheme()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'energylink-monitor-theme.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        importTheme(String(reader.result ?? ''));
        setImportError(null);
      } catch {
        setImportError('Invalid theme file');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const activePreset: MonitorThemePresetId =
    state.presetId === 'custom' ? 'custom' : state.presetId;

  return (
    <div className="theme-customizer-backdrop" onClick={onClose} role="presentation">
      <aside
        className="theme-customizer-panel"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Theme customization"
      >
        <header className="theme-customizer-header">
          <div>
            <h2>Theme</h2>
            <p>Presets and custom colors for Monitor</p>
          </div>
          <button type="button" className="theme-customizer-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>

        <section className="theme-customizer-section">
          <h3>Presets</h3>
          <div className="theme-preset-grid">
            {(Object.keys(THEME_PRESETS) as Array<Exclude<MonitorThemePresetId, 'custom'>>).map(id => {
              const preset = THEME_PRESETS[id];
              const selected = activePreset === id;
              return (
                <button
                  key={id}
                  type="button"
                  className={`theme-preset-card${selected ? ' selected' : ''}`}
                  onClick={() => applyPreset(id)}
                >
                  <span className="theme-preset-swatches" aria-hidden="true">
                    <span style={{ background: preset.tokens.teal900 }} />
                    <span style={{ background: preset.tokens.teal700 }} />
                    <span style={{ background: preset.tokens.bg }} />
                    <span style={{ background: preset.tokens.chartPrimary }} />
                  </span>
                  <span className="theme-preset-label">{preset.label}</span>
                  <span className="theme-preset-desc">{preset.description}</span>
                </button>
              );
            })}
            <button
              type="button"
              className={`theme-preset-card${activePreset === 'custom' ? ' selected' : ''}`}
              onClick={() => {
                /* custom is implicit when editing colors */
              }}
              disabled
              aria-current={activePreset === 'custom' ? 'true' : undefined}
            >
              <span className="theme-preset-swatches custom" aria-hidden="true">
                <span style={{ background: tokens.teal700 }} />
                <span style={{ background: tokens.bg }} />
                <span style={{ background: tokens.chartPrimary }} />
                <span style={{ background: tokens.green }} />
              </span>
              <span className="theme-preset-label">Custom</span>
              <span className="theme-preset-desc">Edit colors below</span>
            </button>
          </div>
        </section>

        <section className="theme-customizer-section theme-customizer-colors">
          <div className="theme-customizer-section-head">
            <h3>Colors</h3>
            <button type="button" className="btn-outline btn-sm" onClick={syncHeaderFromBrand}>
              Sync header from brand
            </button>
          </div>

          {THEME_TOKEN_GROUPS.map(group => (
            <div key={group.title} className="theme-token-group">
              <h4>{group.title}</h4>
              <div className="theme-token-list">
                {group.keys.map(key => (
                  <ThemeTokenRow key={key} tokenKey={key} value={tokens[key]} onChange={setToken} />
                ))}
              </div>
            </div>
          ))}
        </section>

        <footer className="theme-customizer-footer">
          {importError && <span className="theme-import-error">{importError}</span>}
          <button type="button" className="btn-outline" onClick={resetTheme}>
            <RotateCcw size={14} />
            Reset
          </button>
          <button type="button" className="btn-outline" onClick={handleExport}>
            <Download size={14} />
            Export
          </button>
          <button type="button" className="btn-outline" onClick={() => fileRef.current?.click()}>
            <Upload size={14} />
            Import
          </button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={handleImportFile} />
        </footer>
      </aside>
    </div>
  );
}

function ThemeTokenRow({
  tokenKey,
  value,
  onChange,
}: {
  tokenKey: MonitorThemeTokenKey;
  value: string;
  onChange: (key: MonitorThemeTokenKey, value: string) => void;
}) {
  const label = THEME_TOKEN_LABELS[tokenKey];
  const gradient = isGradientToken(tokenKey);
  const rgba = isRgbaToken(tokenKey);

  if (gradient || (rgba && !value.startsWith('#'))) {
    return (
      <label className="theme-token-row theme-token-row-text">
        <span>{label}</span>
        <input
          type="text"
          value={value}
          onChange={e => onChange(tokenKey, e.target.value)}
          spellCheck={false}
        />
      </label>
    );
  }

  const colorValue = toColorInputValue(value);

  return (
    <label className="theme-token-row">
      <span>{label}</span>
      <span className="theme-token-inputs">
        <input
          type="color"
          value={colorValue}
          onChange={e => onChange(tokenKey, e.target.value)}
          aria-label={`${label} color`}
        />
        <input
          type="text"
          value={value}
          onChange={e => onChange(tokenKey, e.target.value)}
          spellCheck={false}
        />
      </span>
    </label>
  );
}
