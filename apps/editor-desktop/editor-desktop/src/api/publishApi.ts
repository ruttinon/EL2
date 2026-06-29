import { getEngineUrl } from './engineConnectionApi';

export type PublishSnapshot = {
  version:     number;
  label:       string | null;
  publishedAt: string;
  publishedBy: string | null;
};

export type PublishResult = {
  ok:       boolean;
  message?: string;
  project?: {
    id:              string;
    name:            string;
    status:          string;
    publishedVersion: number | null;
    publishedAt:     string | null;
  };
  snapshot?: PublishSnapshot;
  counts?:  { devices: number; tags: number; graphics: number; reports: number };
};

/** Publish the current draft → Engine creates a versioned snapshot. */
export async function publishProject(projectId: string, label?: string): Promise<PublishResult> {
  try {
    const res = await fetch(
      `${getEngineUrl()}/api/projects/${encodeURIComponent(projectId)}/publish`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ label, publishedBy: 'editor' })
      }
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, message: data?.message ?? `HTTP ${res.status}` };
    return { ok: true, ...data };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) };
  }
}

/** List all published versions for a project. */
export async function getPublishHistory(projectId: string): Promise<{ ok: boolean; snapshots?: PublishSnapshot[]; message?: string }> {
  try {
    const res  = await fetch(`${getEngineUrl()}/api/projects/${encodeURIComponent(projectId)}/published/history`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, message: data?.message ?? `HTTP ${res.status}` };
    return { ok: true, snapshots: data.snapshots ?? [] };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) };
  }
}

/** Roll back to an older published version. */
export async function rollbackVersion(projectId: string, version: number): Promise<PublishResult> {
  try {
    const res = await fetch(
      `${getEngineUrl()}/api/projects/${encodeURIComponent(projectId)}/published/${version}/rollback`,
      { method: 'POST' }
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, message: data?.message ?? `HTTP ${res.status}` };
    return { ok: true, ...data };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) };
  }
}
