import { contextBridge, ipcRenderer } from 'electron';
import type { CreateDeviceInput, CreateProjectInput, CreateGraphicInput, CreateReportInput, CreateTagInput, UpdateDeviceInput, UpdateGraphicInput, UpdateProjectInput, UpdateReportInput, UpdateTagInput } from '@energylink/shared-types';

contextBridge.exposeInMainWorld('energylink', {
  appName: 'EnergyLink Editor',
  phase: 'Phase 20 - Desktop Login Gate',
  projects: {
    list: () => ipcRenderer.invoke('projects:list'),
    create: (input: CreateProjectInput) => ipcRenderer.invoke('projects:create', input),
    update: (input: UpdateProjectInput) => ipcRenderer.invoke('projects:update', input),
    delete: (id: string) => ipcRenderer.invoke('projects:delete', id),
    setActive: (id: string) => ipcRenderer.invoke('projects:setActive', id),
    status: () => ipcRenderer.invoke('projects:status')
  },
  devices: {
    list: (projectId?: string) => ipcRenderer.invoke('devices:list', projectId),
    tree: (projectId?: string) => ipcRenderer.invoke('devices:tree', projectId),
    create: (input: CreateDeviceInput) => ipcRenderer.invoke('devices:create', input),
    update: (input: UpdateDeviceInput) => ipcRenderer.invoke('devices:update', input),
    delete: (id: string) => ipcRenderer.invoke('devices:delete', id),
    status: (projectId?: string) => ipcRenderer.invoke('devices:status', projectId)
  },
  tags: {
    list: (projectId?: string) => ipcRenderer.invoke('tags:list', projectId),
    listByDevice: (deviceId: string) => ipcRenderer.invoke('tags:listByDevice', deviceId),
    create: (input: CreateTagInput) => ipcRenderer.invoke('tags:create', input),
    update: (input: UpdateTagInput) => ipcRenderer.invoke('tags:update', input),
    delete: (id: string) => ipcRenderer.invoke('tags:delete', id),
    status: (projectId?: string) => ipcRenderer.invoke('tags:status', projectId)
  },
  graphics: {
    list: (projectId?: string) => ipcRenderer.invoke('graphics:list', projectId),
    get: (id: string) => ipcRenderer.invoke('graphics:get', id),
    create: (input: CreateGraphicInput) => ipcRenderer.invoke('graphics:create', input),
    update: (input: UpdateGraphicInput) => ipcRenderer.invoke('graphics:update', input),
    delete: (id: string) => ipcRenderer.invoke('graphics:delete', id),
    status: (projectId?: string) => ipcRenderer.invoke('graphics:status', projectId)
  },
  reports: {
    list: (projectId?: string) => ipcRenderer.invoke('reports:list', projectId),
    get: (id: string) => ipcRenderer.invoke('reports:get', id),
    create: (input: CreateReportInput) => ipcRenderer.invoke('reports:create', input),
    update: (input: UpdateReportInput) => ipcRenderer.invoke('reports:update', input),
    delete: (id: string) => ipcRenderer.invoke('reports:delete', id),
    status: (projectId?: string) => ipcRenderer.invoke('reports:status', projectId)
  },
  utils: {
    openFile: (filters: { name: string; extensions: string[] }[]) => ipcRenderer.invoke('utils:openFile', filters)
  },
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:isMaximized') as Promise<boolean>
  }
});
