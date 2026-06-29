import type {
  CreateDeviceInput,
  CreateGraphicInput,
  CreateProjectInput,
  CreateReportInput,
  CreateTagInput,
  DeviceSummary,
  DeviceTreeNode,
  GraphicSummary,
  ReportSummary,
  TagSummary,
  UpdateDeviceInput,
  UpdateGraphicInput,
  UpdateProjectInput,
  UpdateReportInput,
  UpdateTagInput
} from '@energylink/shared-types';
import type {
  SpreadsheetPreviewRequest,
  SpreadsheetPreviewResult,
  SpreadsheetSheetSnapshot,
  SpreadsheetTemplateImportInput,
  SpreadsheetTemplateImportResult,
} from './api/reportsSpreadsheetApi';

const STORAGE_KEY = 'energylink.local.runtime.store.v1';

type Store = {
  activeProjectId?: string;
  projects: ProjectRecord[];
  devices: DeviceSummary[];
  tags: TagSummary[];
  graphics: GraphicSummary[];
  reports: ReportSummary[];
};

type ProjectRecord = {
  id: string;
  name: string;
  customerName?: string | null;
  location?: string | null;
  timezone: string;
  currency: string;
  energyCostRate: number;
  status: 'draft' | 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
};

function now() {
  return new Date().toISOString();
}

let fallbackIdCounter = 0;

function id(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return `${prefix}_${crypto.randomUUID()}`;
  fallbackIdCounter += 1;
  return `${prefix}_${Date.now()}_${fallbackIdCounter}`;
}

function emptyStore(): Store {
  return { projects: [], devices: [], tags: [], graphics: [], reports: [] };
}

function loadStore(): Store {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return emptyStore();
  try {
    const parsed = JSON.parse(raw) as Partial<Store>;
    return {
      activeProjectId: parsed.activeProjectId,
      projects: Array.isArray(parsed.projects) ? parsed.projects : [],
      devices: Array.isArray(parsed.devices) ? parsed.devices : [],
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
      graphics: Array.isArray(parsed.graphics) ? parsed.graphics : [],
      reports: Array.isArray(parsed.reports) ? parsed.reports : []
    };
  } catch {
    return emptyStore();
  }
}

function saveStore(store: Store) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function activeProjectId(store: Store, inputProjectId?: string) {
  if (inputProjectId) return inputProjectId;
  if (store.activeProjectId && store.projects.some((p) => p.id === store.activeProjectId)) return store.activeProjectId;
  const first = store.projects[0];
  if (!first) throw new Error('No projects found. Please create a project first.');
  store.activeProjectId = first.id;
  return first.id;
}

function defaultGraphicLayout() {
  return { version: 1 as const, backgroundColor: '#fbfdff', backgroundImage: null, objects: [] };
}

function defaultReportTemplate() {
  return { version: 1 as const, pages: [{ id: 'page_1', name: 'Page 1', width: 1123, height: 794, backgroundColor: '#ffffff', objects: [] }] };
}

function defaultSpreadsheetSnapshot(): { sheets: SpreadsheetSheetSnapshot[] } {
  return {
    sheets: [{
      id: 'sheet_1',
      name: 'Sheet1',
      rowCount: 20,
      colCount: 10,
      usedRange: 'A1:J20',
      columns: Array.from({ length: 10 }, (_, index) => ({ index: index + 1, width: 14 })),
      merges: [],
      cells: [],
    }],
  };
}

function spreadsheetSnapshotFromTemplate(template: unknown): { sheets: SpreadsheetSheetSnapshot[] } {
  const root = template && typeof template === 'object' ? template as Record<string, unknown> : null;
  const spreadsheet = root?.spreadsheet && typeof root.spreadsheet === 'object'
    ? root.spreadsheet as Record<string, unknown>
    : null;
  const snapshot = spreadsheet?.snapshot && typeof spreadsheet.snapshot === 'object'
    ? spreadsheet.snapshot as Record<string, unknown>
    : null;
  return Array.isArray(snapshot?.sheets) && snapshot.sheets.length
    ? snapshot as { sheets: SpreadsheetSheetSnapshot[] }
    : defaultSpreadsheetSnapshot();
}

function resolveLocalSpreadsheetPreview(
  report: ReportSummary,
  input: SpreadsheetPreviewRequest,
): SpreadsheetPreviewResult {
  const from = input.from ?? new Date().toISOString();
  const to = input.to ?? from;
  return {
    mode: 'spreadsheet',
    range: {
      from,
      to,
      label: report.defaultDateRange ?? 'custom',
    },
    source: {
      historyCount: 0,
      alarmCount: 0,
    },
    sheets: spreadsheetSnapshotFromTemplate(report.template).sheets,
    warnings: ['Engine API is offline. Preview is showing the saved spreadsheet snapshot only.'],
  };
}


function cleanName(value: string) {
  return value.trim().replace(/\s+/g, '_');
}

function registerLengthForDataType(dataType?: string) {
  if (dataType === 'int32' || dataType === 'uint32' || dataType === 'float32') return 2;
  if (dataType === 'float64') return 4;
  return 1;
}

function normalizedRegisterCount(registers: unknown, dataType?: string) {
  const parsed = Number(registers ?? 1);
  return Math.max(Number.isFinite(parsed) ? parsed : 1, registerLengthForDataType(dataType));
}

function scaleFromDecimals(decimals: unknown) {
  const parsed = Number(decimals);
  if (!Number.isInteger(parsed) || parsed <= 0) return 1;
  return 1 / Math.pow(10, Math.min(parsed, 12));
}

function validateLocalDeviceInput(store: Store, input: CreateDeviceInput, existingId?: string) {
  const name = cleanName(input.name ?? '');
  if (!name) throw new Error('Device Name is required');
  const pid = activeProjectId(store, input.projectId);
  return { pid, name };
}

function validateLocalTagInput(store: Store, input: CreateTagInput, existingId?: string) {
  const device = store.devices.find((item) => item.id === input.deviceId);
  if (!device) throw new Error('Please select a Device before creating a Tag');
  const name = cleanName(input.name ?? '');
  if (!name) throw new Error('Tag Name is required');
  if (!Number.isInteger(input.address) || Number(input.address) <= 0) throw new Error('Address must be an integer greater than 0');
  if (input.decimalPlaces !== undefined && (Number(input.decimalPlaces) < 0 || Number(input.decimalPlaces) > 8)) throw new Error('Decimal Places must be between 0 and 8');
  if (input.alarmHigh != null && input.alarmLow != null && Number(input.alarmLow) >= Number(input.alarmHigh)) throw new Error('Alarm Low must be less than Alarm High');
  const duplicate = store.tags.find((tag) => tag.id !== existingId && tag.deviceId === device.id && tag.name.toLowerCase() === name.toLowerCase());
  if (duplicate) throw new Error(`Tag Name conflicts with duplicate tag: ${duplicate.name}`);
  return { device, name };
}

function withStore<T>(fn: (store: Store) => T): T {
  const store = loadStore();
  const result = fn(store);
  saveStore(store);
  return result;
}

export function installLocalEnergylinkFallback() {
  if ((window as any).energylink) return;

  (window as any).energylink = {
    appName: 'EnergyLink Editor',
    phase: 'Local working mode',
    projects: {
      list: async () => loadStore().projects,
      create: async (input: CreateProjectInput) => withStore((store) => {
        if (!input.name?.trim()) throw new Error('Project Name is required');
        if (store.projects.some((p) => p.name.toLowerCase() === input.name.trim().toLowerCase())) throw new Error('Project name already exists');
        const t = now();
        const project: ProjectRecord = {
          id: id('project'),
          name: input.name.trim(),
          customerName: input.customerName?.trim() || null,
          location: input.location?.trim() || null,
          timezone: input.timezone || 'Asia/Bangkok',
          currency: input.currency || 'THB',
          energyCostRate: Number(input.energyCostRate ?? 0),
          status: 'draft',
          createdAt: t,
          updatedAt: t
        };
        store.projects.unshift(project);
        store.activeProjectId = project.id;
        return project;
      }),
      update: async (input: UpdateProjectInput) => withStore((store) => {
        const project = store.projects.find((p) => p.id === input.id);
        if (!project) throw new Error('Project not found');
        if (input.name !== undefined) project.name = input.name.trim();
        if (input.customerName !== undefined) project.customerName = input.customerName;
        if (input.location !== undefined) project.location = input.location;
        if (input.timezone !== undefined) project.timezone = input.timezone;
        if (input.currency !== undefined) project.currency = input.currency;
        if (input.energyCostRate !== undefined) project.energyCostRate = Number(input.energyCostRate);
        if (input.status !== undefined) project.status = input.status;
        project.updatedAt = now();
        return project;
      }),
      delete: async (projectId: string) => withStore((store) => {
        store.projects = store.projects.filter((p) => p.id !== projectId);
        store.devices = store.devices.filter((d) => d.projectId !== projectId);
        store.tags = store.tags.filter((t) => t.projectId !== projectId);
        store.graphics = store.graphics.filter((g) => g.projectId !== projectId);
        store.reports = store.reports.filter((r) => r.projectId !== projectId);
        if (store.activeProjectId === projectId) store.activeProjectId = store.projects[0]?.id;
        return true;
      }),
      setActive: async (projectId: string) => withStore((store) => {
        const project = store.projects.find((p) => p.id === projectId);
        if (!project) throw new Error('Project not found');
        store.activeProjectId = project.id;
        return project;
      }),
      status: async () => {
        const store = loadStore();
        return { databasePath: 'Browser local storage / Electron SQLite when packaged', connected: true, activeProjectId: store.activeProjectId, projectCount: store.projects.length };
      }
    },
    devices: {
      list: async (projectId?: string) => {
        const store = loadStore();
        const pid = activeProjectId(store, projectId);
        return store.devices.filter((d) => d.projectId === pid);
      },
      tree: async (projectId?: string) => {
        const store = loadStore();
        const pid = activeProjectId(store, projectId);
        const devices = store.devices.filter((d) => d.projectId === pid);
        const map = new Map<string, DeviceTreeNode>();
        devices.forEach((d) => map.set(d.id, { ...d, children: [] }));
        const roots: DeviceTreeNode[] = [];
        for (const node of map.values()) {
          if (node.parentDeviceId && map.has(node.parentDeviceId)) map.get(node.parentDeviceId)!.children.push(node);
          else roots.push(node);
        }
        return roots;
      },
      create: async (input: CreateDeviceInput) => withStore((store) => {
        const { pid, name } = validateLocalDeviceInput(store, input);
        const t = now();
        const device: DeviceSummary = {
          id: id('device'),
          projectId: pid,
          parentDeviceId: input.parentDeviceId ?? null,
          name,
          description: input.description ?? null,
          type: input.type,
          protocol: input.protocol ?? 'modbus_tcp',
          ipAddress: input.ipAddress ?? null,
          port: input.port ?? null,
          serialPort: input.serialPort ?? null,
          baudRate: input.baudRate ?? null,
          dataBits: input.dataBits ?? null,
          stopBits: input.stopBits ?? null,
          parity: input.parity ?? null,
          peripheralNumber: input.peripheralNumber ?? null,
          model: input.model ?? null,
          location: input.location ?? null,
          littleEndianData: input.littleEndianData ?? false,
          swapRegisterBytes: input.swapRegisterBytes ?? false,
          maxRegistersPerGroup: input.maxRegistersPerGroup ?? 120,
          communicationEnabled: input.communicationEnabled ?? true,
          historyEnabled: input.historyEnabled ?? true,
          visible: input.visible ?? true,
          pollingIntervalMs: input.pollingIntervalMs ?? 1000,
          timeoutMs: input.timeoutMs ?? 2000,
          status: 'unknown',
          lastTestAt: null,
          lastError: null,
          createdAt: t,
          updatedAt: t
        };
        store.devices.unshift(device);

        // Bulk create tags if provided
        if ((input as any).tags && Array.isArray((input as any).tags)) {
          for (const tagInput of (input as any).tags) {
            const tagName = cleanName(tagInput.name ?? '');
            if (!tagName) continue;
            const dataType = tagInput.dataType ?? 'float32';
            const decimalPlaces = Number(tagInput.decimals ?? tagInput.decimalPlaces ?? 2);
            
            // Skip validation that requires deviceId in store for bulk create
            const tag: any = {
               id: id('tag'),
               projectId: pid,
               deviceId: device.id,
               name: tagName,
               description: tagInput.description ?? null,
               address: Number(tagInput.address ?? 0),
               registers: normalizedRegisterCount(tagInput.registers, dataType),
               functionCode: Number(tagInput.functionCode ?? 3),
               functionWriteCode: Number(tagInput.functionWriteCode ?? 16),
               registerType: tagInput.registerType ?? 'holding_register',
               dataType,
               unit: tagInput.unit ?? tagInput.units ?? null,
               scale: Number(tagInput.scale ?? scaleFromDecimals(tagInput.decimals)),
               offset: Number(tagInput.offset ?? 0),
               decimalPlaces,
               historyEnabled: tagInput.historyEnabled ?? true,
               alarmHigh: tagInput.alarmHigh ?? null,
               alarmLow: tagInput.alarmLow ?? null,
               currentValue: null,
               quality: 'unknown',
               lastValueAt: null,
               createdAt: t,
               updatedAt: t,
               deviceName: device.name
             };
            store.tags.unshift(tag);
          }
        }
        return device;
      }),
      update: async (input: UpdateDeviceInput) => withStore((store) => {
        const device = store.devices.find((d) => d.id === input.id);
        if (!device) throw new Error('Device not found');
        const nextInput = { ...device, ...input, name: input.name ?? device.name } as CreateDeviceInput;
        const { name } = validateLocalDeviceInput(store, nextInput, device.id);
        Object.assign(device, input, { name, updatedAt: now() });
        return device;
      }),
      delete: async (deviceId: string) => withStore((store) => {
        const descendants = new Set<string>([deviceId]);
        let changed = true;
        while (changed) {
          changed = false;
          for (const d of store.devices) {
            if (d.parentDeviceId && descendants.has(d.parentDeviceId) && !descendants.has(d.id)) { descendants.add(d.id); changed = true; }
          }
        }
        store.devices = store.devices.filter((d) => !descendants.has(d.id));
        store.tags = store.tags.filter((t) => !descendants.has(t.deviceId));
        return true;
      }),
      status: async (projectId?: string) => {
        const store = loadStore();
        const pid = activeProjectId(store, projectId);
        const devices = store.devices.filter((d) => d.projectId === pid);
        return { activeProjectId: pid, deviceCount: devices.length, converterCount: devices.filter((d) => d.type === 'converter').length, meterCount: devices.filter((d) => d.type === 'meter').length, sensorCount: devices.filter((d) => d.type === 'sensor').length };
      }
    },
    tags: {
      list: async (projectId?: string) => {
        const store = loadStore();
        const pid = activeProjectId(store, projectId);
        return store.tags.filter((t) => t.projectId === pid).map((tag) => ({ ...tag, deviceName: store.devices.find((d) => d.id === tag.deviceId)?.name }));
      },
      listByDevice: async (deviceId: string) => loadStore().tags.filter((t) => t.deviceId === deviceId),
      create: async (input: CreateTagInput) => withStore((store) => {
        const { device, name } = validateLocalTagInput(store, input);
        const t = now();
        const dataType = input.dataType ?? 'float32';
        const decimalPlaces = Number((input as any).decimals ?? input.decimalPlaces ?? 2);
        const tag: TagSummary = {
          id: id('tag'),
          projectId: device.projectId,
          deviceId: device.id,
          name,
          description: input.description ?? null,
          address: Number(input.address),
          registers: normalizedRegisterCount(input.registers, dataType),
          functionCode: Number(input.functionCode ?? 3),
          functionWriteCode: Number(input.functionWriteCode ?? 16),
          registerType: input.registerType ?? 'holding_register',
          dataType,
          unit: input.unit ?? null,
          scale: input.scale ?? scaleFromDecimals((input as any).decimals),
          offset: input.offset ?? 0,
          decimalPlaces,
          historyEnabled: input.historyEnabled ?? true,
          alarmHigh: input.alarmHigh ?? null,
          alarmLow: input.alarmLow ?? null,
          currentValue: null,
          quality: 'unknown',
          lastValueAt: null,
          createdAt: t,
          updatedAt: t,
          deviceName: device.name
        };
        store.tags.unshift(tag);
        return tag;
      }),
      update: async (input: UpdateTagInput) => withStore((store) => {
        const tag = store.tags.find((t) => t.id === input.id);
        if (!tag) throw new Error('Tag not found');
        const nextInput = { ...tag, ...input, name: input.name ?? tag.name } as CreateTagInput;
        const { name } = validateLocalTagInput(store, nextInput, tag.id);
        Object.assign(tag, input, { name, updatedAt: now() });
        tag.deviceName = store.devices.find((d) => d.id === tag.deviceId)?.name;
        return tag;
      }),
      delete: async (tagId: string) => withStore((store) => { store.tags = store.tags.filter((t) => t.id !== tagId); return true; }),
      status: async (projectId?: string) => {
        const store = loadStore();
        const pid = activeProjectId(store, projectId);
        const tags = store.tags.filter((t) => t.projectId === pid);
        return { activeProjectId: pid, tagCount: tags.length, historyEnabledCount: tags.filter((t) => t.historyEnabled).length, alarmConfiguredCount: tags.filter((t) => t.alarmHigh != null || t.alarmLow != null).length };
      }
    },
    graphics: {
      list: async (projectId?: string) => {
        const store = loadStore();
        const pid = activeProjectId(store, projectId);
        return store.graphics.filter((g) => g.projectId === pid);
      },
      get: async (graphicId: string) => loadStore().graphics.find((g) => g.id === graphicId) ?? null,
      create: async (input: CreateGraphicInput) => withStore((store) => {
        const pid = activeProjectId(store, input.projectId);
        const t = now();
        if (input.isDefault) store.graphics.forEach((g) => { if (g.projectId === pid) g.isDefault = false; });
        const graphic: GraphicSummary = { id: id('graphic'), projectId: pid, name: input.name.trim(), description: input.description ?? null, width: input.width ?? 1366, height: input.height ?? 768, refreshIntervalMs: input.refreshIntervalMs ?? 1000, isDefault: input.isDefault ?? store.graphics.filter((g) => g.projectId === pid).length === 0, layout: input.layout ?? defaultGraphicLayout(), createdAt: t, updatedAt: t };
        store.graphics.unshift(graphic);
        return graphic;
      }),
      update: async (input: UpdateGraphicInput) => {
        const graphic = await withStore((store) => {
          const item = store.graphics.find((g) => g.id === input.id);
          if (!item) throw new Error('Graphic not found');
          if (input.isDefault) store.graphics.forEach((g) => { if (g.projectId === item.projectId) g.isDefault = false; });
          Object.assign(item, input, { updatedAt: now() });
          return item;
        });
        if (input.layout) {
          const { pushGraphicSnapshot } = await import('./features/graphics/graphicHistory');
          pushGraphicSnapshot(graphic);
        }
        return graphic;
      },
      delete: async (graphicId: string) => withStore((store) => { store.graphics = store.graphics.filter((g) => g.id !== graphicId); return true; }),
      status: async (projectId?: string) => {
        const store = loadStore();
        const pid = activeProjectId(store, projectId);
        const graphics = store.graphics.filter((g) => g.projectId === pid);
        return { activeProjectId: pid, graphicCount: graphics.length, objectCount: graphics.reduce((sum, g) => sum + g.layout.objects.length, 0), defaultGraphicId: graphics.find((g) => g.isDefault)?.id ?? null };
      },
      listHistory: async (graphicId: string) => {
        const { listGraphicSnapshots } = await import('./features/graphics/graphicHistory');
        return listGraphicSnapshots(graphicId);
      },
      restoreHistory: async (graphicId: string, revisionId: string) => {
        const { listGraphicSnapshots, restoreGraphicSnapshot } = await import('./features/graphics/graphicHistory');
        const graphic = loadStore().graphics.find((g) => g.id === graphicId);
        if (!graphic) throw new Error('Graphic not found');
        const snap = listGraphicSnapshots(graphicId).find((s) => s.id === revisionId);
        if (!snap) throw new Error('Snapshot not found');
        const restored = restoreGraphicSnapshot(graphic, snap);
        return withStore((store) => {
          const item = store.graphics.find((g) => g.id === graphicId);
          if (!item) throw new Error('Graphic not found');
          Object.assign(item, {
            width: restored.width,
            height: restored.height,
            refreshIntervalMs: restored.refreshIntervalMs,
            layout: restored.layout,
            updatedAt: now(),
          });
          return item;
        });
      },
      deleteHistory: async (graphicId: string, revisionId: string) => {
        const { deleteGraphicSnapshot } = await import('./features/graphics/graphicHistory');
        return deleteGraphicSnapshot(graphicId, revisionId);
      },
    },
    reports: {
      list: async (projectId?: string) => {
        const store = loadStore();
        const pid = activeProjectId(store, projectId);
        return store.reports.filter((r) => r.projectId === pid);
      },
      get: async (reportId: string) => loadStore().reports.find((r) => r.id === reportId) ?? null,
      create: async (input: CreateReportInput) => withStore((store) => {
        const pid = activeProjectId(store, input.projectId);
        const t = now();
        if (input.isDefault) store.reports.forEach((r) => { if (r.projectId === pid) r.isDefault = false; });
        const report: ReportSummary = { id: id('report'), projectId: pid, name: input.name.trim(), description: input.description ?? null, reportType: input.reportType ?? 'daily_energy', paperSize: input.paperSize ?? 'A4', orientation: input.orientation ?? 'landscape', defaultDateRange: input.defaultDateRange ?? 'this_month', outputFormat: input.outputFormat ?? 'pdf', isDefault: input.isDefault ?? store.reports.filter((r) => r.projectId === pid).length === 0, template: input.template ?? defaultReportTemplate(), createdAt: t, updatedAt: t };
        store.reports.unshift(report);
        return report;
      }),
      update: async (input: UpdateReportInput) => withStore((store) => {
        const report = store.reports.find((r) => r.id === input.id);
        if (!report) throw new Error('Report not found');
        if (input.isDefault) store.reports.forEach((r) => { if (r.projectId === report.projectId) r.isDefault = false; });
        Object.assign(report, input, { updatedAt: now() });
        return report;
      }),
      delete: async (reportId: string) => withStore((store) => { store.reports = store.reports.filter((r) => r.id !== reportId); return true; }),
      status: async (projectId?: string) => {
        const store = loadStore();
        const pid = activeProjectId(store, projectId);
        const reports = store.reports.filter((r) => r.projectId === pid);
        return { activeProjectId: pid, reportCount: reports.length, objectCount: reports.reduce((sum, r) => sum + r.template.pages.reduce((pageSum, p) => pageSum + p.objects.length, 0), 0), defaultReportId: reports.find((r) => r.isDefault)?.id ?? null };
      },
      importSpreadsheetTemplate: async (_input: SpreadsheetTemplateImportInput & { reportId: string }): Promise<SpreadsheetTemplateImportResult> => {
        throw new Error('Spreadsheet import requires Engine API mode. Start the engine and try again.');
      },
      resolveSpreadsheetPreview: async (input: SpreadsheetPreviewRequest & { reportId: string }) => {
        const report = loadStore().reports.find((item) => item.id === input.reportId);
        if (!report) throw new Error('Report not found');
        return resolveLocalSpreadsheetPreview(report, input);
      },
    }
  };
}
