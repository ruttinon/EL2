const DEFAULT_ENGINE_URL = 'http://localhost:8081';
const CANONICAL_ENGINE_URL_KEY = 'energylink.engine.url';
const LEGACY_ENGINE_URL_KEYS = [
  'energylink.monitor.engineUrl',
  'energylink.editor.engineUrl',
  'energylink.web.engineUrl',
];

export function buildEngineUrl(host = 'localhost', port = 8081) {
  return `http://${host.trim() || 'localhost'}:${Math.trunc(port)}`;
}

export function getEngineUrl() {
  const canonical = window.localStorage.getItem(CANONICAL_ENGINE_URL_KEY);
  if (canonical) return canonical.replace(/\/$/, '');
  for (const key of LEGACY_ENGINE_URL_KEYS) {
    const stored = window.localStorage.getItem(key);
    if (stored) {
      const normalized = stored.replace(/\/$/, '');
      setEngineUrl(normalized);
      return normalized;
    }
  }
  return DEFAULT_ENGINE_URL;
}

export function setEngineUrl(url: string) {
  const normalized = url.trim().replace(/\/$/, '');
  window.localStorage.setItem(CANONICAL_ENGINE_URL_KEY, normalized);
  for (const key of LEGACY_ENGINE_URL_KEYS) {
    window.localStorage.setItem(key, normalized);
  }
}
