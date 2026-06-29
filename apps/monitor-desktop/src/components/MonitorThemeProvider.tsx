import React from 'react';
import {
  applyThemeTokens,
  exportThemeJson,
  importThemeJson,
  loadThemeState,
  resolveThemeTokens,
  saveThemeState,
  syncHeaderFromPrimary,
  type MonitorThemePresetId,
  type MonitorThemeState,
  type MonitorThemeTokenKey,
  type MonitorThemeTokens,
} from '../utils/monitorTheme';

type MonitorThemeContextValue = {
  state: MonitorThemeState;
  tokens: MonitorThemeTokens;
  applyPreset: (id: Exclude<MonitorThemePresetId, 'custom'>) => void;
  setToken: (key: MonitorThemeTokenKey, value: string) => void;
  syncHeaderFromBrand: () => void;
  resetTheme: () => void;
  exportTheme: () => string;
  importTheme: (raw: string) => void;
};

const MonitorThemeContext = React.createContext<MonitorThemeContextValue | null>(null);

export function MonitorThemeProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<MonitorThemeState>(() => loadThemeState());
  const tokens = React.useMemo(() => resolveThemeTokens(state), [state]);

  React.useEffect(() => {
    applyThemeTokens(tokens);
    saveThemeState(state);
  }, [state, tokens]);

  const applyPreset = React.useCallback((id: Exclude<MonitorThemePresetId, 'custom'>) => {
    setState({ presetId: id, customTokens: {} });
  }, []);

  const setToken = React.useCallback((key: MonitorThemeTokenKey, value: string) => {
    setState(current => ({
      presetId: 'custom',
      customTokens: { ...resolveThemeTokens(current), [key]: value },
    }));
  }, []);

  const syncHeaderFromBrand = React.useCallback(() => {
    setState(current => {
      const merged = resolveThemeTokens(current);
      return {
        presetId: 'custom',
        customTokens: syncHeaderFromPrimary(merged),
      };
    });
  }, []);

  const resetTheme = React.useCallback(() => {
    setState({ presetId: 'default', customTokens: {} });
  }, []);

  const exportTheme = React.useCallback(() => exportThemeJson(state), [state]);

  const importTheme = React.useCallback((raw: string) => {
    setState(importThemeJson(raw));
  }, []);

  const value = React.useMemo(
    () => ({
      state,
      tokens,
      applyPreset,
      setToken,
      syncHeaderFromBrand,
      resetTheme,
      exportTheme,
      importTheme,
    }),
    [state, tokens, applyPreset, setToken, syncHeaderFromBrand, resetTheme, exportTheme, importTheme],
  );

  return <MonitorThemeContext.Provider value={value}>{children}</MonitorThemeContext.Provider>;
}

export function useMonitorTheme(): MonitorThemeContextValue {
  const ctx = React.useContext(MonitorThemeContext);
  if (!ctx) {
    throw new Error('useMonitorTheme must be used within MonitorThemeProvider');
  }
  return ctx;
}
