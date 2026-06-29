import type {
  CreateDeviceInput,
  CreateGraphicInput,
  CreateProjectInput,
  CreateReportInput,
  CreateTagInput,
  DeviceSummary,
  DeviceTreeNode,
  GraphicSummary,
  ProjectSummary,
  ReportSummary,
  TagSummary,
  UpdateDeviceInput,
  UpdateGraphicInput,
  UpdateProjectInput,
  UpdateReportInput,
  UpdateTagInput
} from '@energylink/shared-types';

import { getEngineUrl, setEngineUrl } from '@energylink/shared-ui';
import { listGraphicSnapshots as listGraphicSnapshotsLocal, restoreGraphicSnapshot as restoreGraphicSnapshotLocal, deleteGraphicSnapshot as deleteGraphicSnapshotLocal } from './features/graphics/graphicHistory';
import type {
  SpreadsheetPreviewRequest,
  SpreadsheetPreviewResult,
  SpreadsheetTemplateImportInput,
  SpreadsheetTemplateImportResult,
} from './api/reportsSpreadsheetApi';

const ACTIVE_PROJECT_KEY = 'energylink.editor.activeProjectId';

function engineUrl() {
  return getEngineUrl();
}

function activeProjectId() {
  return window.localStorage.getItem(ACTIVE_PROJECT_KEY) || undefined;
}

function setActiveProjectId(projectId?: string | null) {
  if (projectId) window.localStorage.setItem(ACTIVE_PROJECT_KEY, projectId);
  else window.localStorage.removeItem(ACTIVE_PROJECT_KEY);
}

class EngineApiError extends Error {
  constructor(message: string, readonly status: number, readonly body: unknown) {
    super(message);
    this.name = 'EngineApiError';
  }
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {};
  if (init?.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (init?.headers) {
    Object.assign(headers, init.headers);
  }

  const response = await fetch(`${engineUrl()}${path}`, {
    ...init,
    headers
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    let message = typeof data?.message === 'string'
      ? data.message
      : typeof data?.error === 'string'
        ? data.error
        : `HTTP ${response.status}`;
    
    if (Array.isArray(data?.errors) && data.errors.length > 0) {
      message += `: ${data.errors.join(' / ')}`;
    }
    
    throw new EngineApiError(message, response.status, data);
  }

  return data as T;
}

async function isEngineOnline() {
  try {
    await requestJson('/api/status');
    return true;
  } catch {
    return false;
  }
}

function unwrapProject(data: { project?: ProjectSummary }) {
  if (!data.project) throw new Error('Engine response did not include project.');
  return data.project;
}

function unwrapDevice(data: { device?: DeviceSummary }) {
  if (!data.device) throw new Error('Engine response did not include device.');
  return data.device;
}

function unwrapTag(data: { tag?: TagSummary }) {
  if (!data.tag) throw new Error('Engine response did not include tag.');
  return data.tag;
}

function unwrapGraphic(data: { graphic?: GraphicSummary }) {
  if (!data.graphic) throw new Error('Engine response did not include graphic.');
  return data.graphic;
}

function unwrapReport(data: { report?: ReportSummary }) {
  if (!data.report) throw new Error('Engine response did not include report.');
  return data.report;
}

function filterByProject<T extends { projectId?: string }>(rows: T[], projectId?: string) {
  const pid = projectId || activeProjectId();
  return pid ? rows.filter(row => row.projectId === pid) : rows;
}

function buildDeviceTree(devices: DeviceSummary[]): DeviceTreeNode[] {
  const map = new Map<string, DeviceTreeNode>();
  const roots: DeviceTreeNode[] = [];

  for (const device of devices) {
    map.set(device.id, { ...device, children: [] });
  }

  for (const node of map.values()) {
    if (node.parentDeviceId && map.has(node.parentDeviceId)) {
      map.get(node.parentDeviceId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

function withProjectId<T extends { projectId?: string }>(input: T): T {
  return {
    ...input,
    projectId: input.projectId || activeProjectId()
  };
}

export function installEngineBackedEnergylinkBridge() {
  const existing = window.energylink;

  if (!existing) return;
  if (existing.phase !== 'Local working mode') return;

  const local = existing;

  async function engineOrLocal<T>(engineCall: () => Promise<T>, localCall: () => Promise<T>) {
    try {
      return await engineCall();
    } catch (error) {
      if (error instanceof EngineApiError) throw error;
      return localCall();
    }
  }

  window.energylink = {
    appName: 'EnergyLink Editor',
    phase: 'Engine API first / Local store when Engine is offline',

    projects: {
      list: () => engineOrLocal(
        async () => (await requestJson<{ projects: ProjectSummary[] }>('/api/projects')).projects,
        () => local.projects.list()
      ),

      create: (input: CreateProjectInput) => engineOrLocal(
        async () => {
          const project = unwrapProject(await requestJson<{ project: ProjectSummary }>('/api/projects', {
            method: 'POST',
            body: JSON.stringify(input)
          }));
          setActiveProjectId(project.id);
          return project;
        },
        () => local.projects.create(input)
      ),

      update: (input: UpdateProjectInput) => engineOrLocal(
        async () => unwrapProject(await requestJson<{ project: ProjectSummary }>(`/api/projects/${encodeURIComponent(input.id)}`, {
          method: 'PUT',
          body: JSON.stringify(input)
        })),
        () => local.projects.update(input)
      ),

      delete: (id: string) => engineOrLocal(
        async () => {
          await requestJson(`/api/projects/${encodeURIComponent(id)}`, { method: 'DELETE' });
          if (activeProjectId() === id) setActiveProjectId(null);
          return true;
        },
        () => local.projects.delete(id)
      ),

      setActive: (id: string) => engineOrLocal(
        async () => {
          await requestJson(`/api/projects/${encodeURIComponent(id)}/activate`, { method: 'POST' });
          const project = unwrapProject(await requestJson<{ project: ProjectSummary }>(`/api/projects/${encodeURIComponent(id)}`));
          setActiveProjectId(project.id);
          return project;
        },
        () => local.projects.setActive(id)
      ),

      status: () => engineOrLocal(
        async () => {
          const projects = (await requestJson<{ projects: ProjectSummary[] }>('/api/projects')).projects;
          const pid = activeProjectId() || projects[0]?.id;
          if (pid) setActiveProjectId(pid);
          return {
            databasePath: 'Engine API / SQLite / Prisma',
            connected: true,
            activeProjectId: pid,
            projectCount: projects.length
          };
        },
        () => local.projects.status()
      )
    },

    devices: {
      list: (projectId?: string) => engineOrLocal(
        async () => filterByProject((await requestJson<{ devices: DeviceSummary[] }>('/api/devices')).devices, projectId),
        () => local.devices.list(projectId)
      ),

      tree: (projectId?: string) => engineOrLocal(
        async () => buildDeviceTree(filterByProject((await requestJson<{ devices: DeviceSummary[] }>('/api/devices')).devices, projectId)),
        () => local.devices.tree(projectId)
      ),

      create: (input: CreateDeviceInput) => engineOrLocal(
        async () => unwrapDevice(await requestJson<{ device: DeviceSummary }>('/api/devices', {
          method: 'POST',
          body: JSON.stringify(withProjectId(input))
        })),
        () => local.devices.create(input)
      ),

      update: (input: UpdateDeviceInput) => engineOrLocal(
        async () => unwrapDevice(await requestJson<{ device: DeviceSummary }>(`/api/devices/${encodeURIComponent(input.id)}`, {
          method: 'PUT',
          body: JSON.stringify(input)
        })),
        () => local.devices.update(input)
      ),

      delete: (id: string) => engineOrLocal(
        async () => {
          await requestJson(`/api/devices/${encodeURIComponent(id)}`, { method: 'DELETE' });
          return true;
        },
        () => local.devices.delete(id)
      ),

      status: (projectId?: string) => engineOrLocal(
        async () => {
          const devices = filterByProject((await requestJson<{ devices: DeviceSummary[] }>('/api/devices')).devices, projectId);
          return {
            activeProjectId: projectId || activeProjectId() || '',
            deviceCount: devices.length,
            converterCount: devices.filter(device => device.type === 'converter').length,
            meterCount: devices.filter(device => device.type === 'meter').length,
            sensorCount: devices.filter(device => device.type === 'sensor').length
          };
        },
        () => local.devices.status(projectId)
      )
    },

    tags: {
      list: (projectId?: string) => engineOrLocal(
        async () => filterByProject((await requestJson<{ tags: TagSummary[] }>('/api/editor/tags')).tags, projectId),
        () => local.tags.list(projectId)
      ),

      listByDevice: (deviceId: string) => engineOrLocal(
        async () => (await requestJson<{ tags: TagSummary[] }>(`/api/editor/tags?deviceId=${encodeURIComponent(deviceId)}`)).tags,
        () => local.tags.listByDevice(deviceId)
      ),

      create: (input: CreateTagInput) => engineOrLocal(
        async () => unwrapTag(await requestJson<{ tag: TagSummary }>('/api/tags', {
          method: 'POST',
          body: JSON.stringify(withProjectId(input))
        })),
        () => local.tags.create(input)
      ),

      update: (input: UpdateTagInput) => engineOrLocal(
        async () => unwrapTag(await requestJson<{ tag: TagSummary }>(`/api/tags/${encodeURIComponent(input.id)}`, {
          method: 'PUT',
          body: JSON.stringify(input)
        })),
        () => local.tags.update(input)
      ),

      delete: (id: string) => engineOrLocal(
        async () => {
          await requestJson(`/api/tags/${encodeURIComponent(id)}`, { method: 'DELETE' });
          return true;
        },
        () => local.tags.delete(id)
      ),

      status: (projectId?: string) => engineOrLocal(
        async () => {
          const tags = filterByProject((await requestJson<{ tags: TagSummary[] }>('/api/editor/tags')).tags, projectId);
          return {
            activeProjectId: projectId || activeProjectId() || '',
            tagCount: tags.length,
            historyEnabledCount: tags.filter(tag => tag.historyEnabled).length,
            alarmConfiguredCount: tags.filter(tag => tag.alarmHigh != null || tag.alarmLow != null).length
          };
        },
        () => local.tags.status(projectId)
      )
    },

    graphics: {
      list: (projectId?: string) => engineOrLocal(
        async () => filterByProject((await requestJson<{ graphics: GraphicSummary[] }>('/api/graphics')).graphics, projectId),
        () => local.graphics.list(projectId)
      ),

      get: (id: string) => engineOrLocal(
        async () => unwrapGraphic(await requestJson<{ graphic: GraphicSummary }>(`/api/graphics/${encodeURIComponent(id)}`)),
        () => local.graphics.get(id)
      ),

      create: (input: CreateGraphicInput) => engineOrLocal(
        async () => unwrapGraphic(await requestJson<{ graphic: GraphicSummary }>('/api/graphics', {
          method: 'POST',
          body: JSON.stringify(withProjectId(input))
        })),
        () => local.graphics.create(input)
      ),

      update: (input: UpdateGraphicInput) => engineOrLocal(
        async () => unwrapGraphic(await requestJson<{ graphic: GraphicSummary }>(`/api/graphics/${encodeURIComponent(input.id)}`, {
          method: 'PUT',
          body: JSON.stringify(input)
        })),
        () => local.graphics.update(input)
      ),

      delete: (id: string) => engineOrLocal(
        async () => {
          await requestJson(`/api/graphics/${encodeURIComponent(id)}`, { method: 'DELETE' });
          return true;
        },
        () => local.graphics.delete(id)
      ),

      status: (projectId?: string) => engineOrLocal(
        async () => {
          const graphics = filterByProject((await requestJson<{ graphics: GraphicSummary[] }>('/api/graphics')).graphics, projectId);
          return {
            activeProjectId: projectId || activeProjectId() || '',
            graphicCount: graphics.length,
            objectCount: graphics.reduce((total, graphic) => total + (graphic.layout?.objects?.length || 0), 0),
            defaultGraphicId: graphics.find(graphic => graphic.isDefault)?.id ?? null
          };
        },
        () => local.graphics.status(projectId)
      ),

      listHistory: (graphicId: string) => engineOrLocal(
        async () => {
          try {
            const res = await requestJson<{ revisions: import('@energylink/shared-types').GraphicLayoutSnapshot[] }>(`/api/graphics/${encodeURIComponent(graphicId)}/history`);
            return res.revisions ?? [];
          } catch (error) {
            if (error instanceof EngineApiError && error.status >= 500) {
              return listGraphicSnapshotsLocal(graphicId);
            }
            throw error;
          }
        },
        () => Promise.resolve(listGraphicSnapshotsLocal(graphicId)),
      ),

      restoreHistory: (graphicId: string, revisionId: string) => engineOrLocal(
        async () => unwrapGraphic(await requestJson<{ graphic: GraphicSummary }>(`/api/graphics/${encodeURIComponent(graphicId)}/history/${encodeURIComponent(revisionId)}/restore`, { method: 'POST' })),
        async () => {
          const snaps = listGraphicSnapshotsLocal(graphicId);
          const snap = snaps.find((s) => s.id === revisionId);
          if (!snap) throw new Error('Snapshot not found');
          const current = await local.graphics.get(graphicId);
          if (!current) throw new Error('Graphic not found');
          const restored = restoreGraphicSnapshotLocal(current, snap);
          return local.graphics.update({
            id: graphicId,
            width: restored.width,
            height: restored.height,
            refreshIntervalMs: restored.refreshIntervalMs,
            layout: restored.layout,
          });
        },
      ),

      deleteHistory: (graphicId: string, revisionId: string) => engineOrLocal(
        async () => {
          const res = await requestJson<{ revisions: import('@energylink/shared-types').GraphicLayoutSnapshot[] }>(
            `/api/graphics/${encodeURIComponent(graphicId)}/history/${encodeURIComponent(revisionId)}`,
            { method: 'DELETE' },
          );
          return res.revisions ?? [];
        },
        () => Promise.resolve(deleteGraphicSnapshotLocal(graphicId, revisionId)),
      ),
    },

    reports: {
      list: (projectId?: string) => engineOrLocal(
        // Engine returns all reports; skip client-side project filtering to avoid
        // mismatches between localStorage activeProjectId and engine DB projectIds.
        async () => (await requestJson<{ reports: ReportSummary[] }>('/api/reports')).reports,
        () => local.reports.list(projectId)
      ),

      get: (id: string) => engineOrLocal(
        async () => unwrapReport(await requestJson<{ report: ReportSummary }>(`/api/reports/${encodeURIComponent(id)}`)),
        () => local.reports.get(id)
      ),

      create: (input: CreateReportInput) => engineOrLocal(
        async () => unwrapReport(await requestJson<{ report: ReportSummary }>('/api/reports', {
          method: 'POST',
          body: JSON.stringify(withProjectId(input))
        })),
        () => local.reports.create(input)
      ),

      update: (input: UpdateReportInput) => engineOrLocal(
        async () => unwrapReport(await requestJson<{ report: ReportSummary }>(`/api/reports/${encodeURIComponent(input.id)}`, {
          method: 'PUT',
          body: JSON.stringify(input)
        })),
        () => local.reports.update(input)
      ),

      delete: (id: string) => engineOrLocal(
        async () => {
          await requestJson(`/api/reports/${encodeURIComponent(id)}`, { method: 'DELETE' });
          return true;
        },
        () => local.reports.delete(id)
      ),

      status: (projectId?: string) => engineOrLocal(
        async () => {
          const reports = filterByProject((await requestJson<{ reports: ReportSummary[] }>('/api/reports')).reports, projectId);
          return {
            activeProjectId: projectId || activeProjectId() || '',
            reportCount: reports.length,
            objectCount: reports.reduce((total, report) => total + (report.template?.pages?.reduce((pageTotal, page) => pageTotal + page.objects.length, 0) || 0), 0),
            defaultReportId: reports.find(report => report.isDefault)?.id ?? null
          };
        },
        () => local.reports.status(projectId)
      ),

      importSpreadsheetTemplate: (input: SpreadsheetTemplateImportInput & { reportId: string }) => engineOrLocal(
        async () => requestJson<SpreadsheetTemplateImportResult>(
          `/api/reports/${encodeURIComponent(input.reportId)}/import-spreadsheet`,
          {
            method: 'POST',
            body: JSON.stringify({
              filename: input.filename,
              dataBase64: input.dataBase64,
              kind: input.kind,
            }),
          },
        ),
        () => local.reports.importSpreadsheetTemplate(input)
      ),

      resolveSpreadsheetPreview: (input: SpreadsheetPreviewRequest & { reportId: string }) => engineOrLocal(
        async () => {
          const result = await requestJson<{ preview: SpreadsheetPreviewResult }>(
            `/api/reports/${encodeURIComponent(input.reportId)}/resolve-spreadsheet-preview`,
            {
              method: 'POST',
              body: JSON.stringify({
                from: input.from,
                to: input.to,
                tariffId: input.tariffId,
              }),
            },
          );
          return result.preview;
        },
        () => local.reports.resolveSpreadsheetPreview(input)
      )
    },

    utils: local.utils ?? {
      openFile: async () => undefined,
    },

    window: local.window ?? {
      minimize: () => undefined,
      maximize: () => undefined,
      close: () => undefined,
      isMaximized: async () => false,
    },
  };

  void isEngineOnline().then((online) => {
    window.dispatchEvent(new CustomEvent('energylink-engine-mode', {
      detail: {
        mode: online ? 'engine-api' : 'local-store',
        engineUrl: engineUrl()
      }
    }));
  });
}


