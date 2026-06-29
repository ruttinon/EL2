export const DEFAULT_ENGINE_URL = 'http://localhost:8081';

export const CANONICAL_ENGINE_URL_KEY = 'energylink.engine.url';

const LEGACY_ENGINE_URL_KEYS = [
  'energylink.monitor.engineUrl',
  'energylink.editor.engineUrl',
  'energylink.web.engineUrl',
] as const;

const LEGACY_DEFAULT_URLS = ['http://localhost:8080', 'http://localhost:18765'];

export type EngineEndpointPayload = {
  apiBaseUrl?: string;
  apiPort?: number;
};

export function normalizeEngineUrl(url: string): string {
  return url.trim().replace(/\/$/, '');
}

export function buildEngineUrl(host = 'localhost', port = 8081): string {
  const cleanHost = host.trim() || 'localhost';
  const cleanPort = Number.isFinite(port) ? Math.trunc(port) : 8081;
  return `http://${cleanHost}:${cleanPort}`;
}

export function parseEnginePort(url: string): number | null {
  try {
    const parsed = new URL(normalizeEngineUrl(url));
    if (parsed.port) return Number(parsed.port);
    return parsed.protocol === 'https:' ? 443 : 80;
  } catch {
    return null;
  }
}

function readStoredEngineUrl(): string | null {
  if (typeof window === 'undefined') return null;

  const canonical = window.localStorage.getItem(CANONICAL_ENGINE_URL_KEY);
  if (canonical) return normalizeEngineUrl(canonical);

  for (const key of LEGACY_ENGINE_URL_KEYS) {
    const stored = window.localStorage.getItem(key);
    if (!stored) continue;
    const normalized = LEGACY_DEFAULT_URLS.includes(stored)
      ? DEFAULT_ENGINE_URL
      : normalizeEngineUrl(stored);
    setEngineUrl(normalized);
    return normalized;
  }

  return null;
}

export function getEngineUrl(): string {
  return readStoredEngineUrl() ?? DEFAULT_ENGINE_URL;
}

/** Writes one canonical URL and mirrors it to every client app storage key. */
export function setEngineUrl(url: string) {
  if (typeof window === 'undefined') return;
  const normalized = normalizeEngineUrl(url);
  window.localStorage.setItem(CANONICAL_ENGINE_URL_KEY, normalized);
  for (const key of LEGACY_ENGINE_URL_KEYS) {
    window.localStorage.setItem(key, normalized);
  }
}

export function syncEngineUrlFromEngine(payload: EngineEndpointPayload): string {
  if (payload.apiBaseUrl) {
    const normalized = normalizeEngineUrl(payload.apiBaseUrl);
    setEngineUrl(normalized);
    return normalized;
  }
  if (typeof payload.apiPort === 'number' && payload.apiPort > 0) {
    const url = buildEngineUrl('localhost', payload.apiPort);
    setEngineUrl(url);
    return url;
  }
  return getEngineUrl();
}

export async function probeEngineUrl(extraCandidates: string[] = []): Promise<string | null> {
  if (typeof window === 'undefined') return null;

  const candidates = new Set<string>([
    getEngineUrl(),
    DEFAULT_ENGINE_URL,
    ...LEGACY_DEFAULT_URLS,
    ...extraCandidates.map(normalizeEngineUrl),
  ]);

  for (const url of candidates) {
    try {
      const response = await fetch(`${url}/api/health`, {
        signal: AbortSignal.timeout(1500),
      });
      if (!response.ok) continue;
      const data = (await response.json().catch(() => ({}))) as EngineEndpointPayload & { ok?: boolean };
      return syncEngineUrlFromEngine(data);
    } catch {
      // try next candidate
    }
  }

  return null;
}
