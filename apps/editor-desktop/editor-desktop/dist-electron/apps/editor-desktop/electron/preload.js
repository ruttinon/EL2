import { contextBridge, ipcRenderer } from 'electron';
contextBridge.exposeInMainWorld('energylink', {
    appName: 'EnergyLink Editor',
    phase: 'Phase 20 - Desktop Login Gate',
    projects: {
        list: () => ipcRenderer.invoke('projects:list'),
        create: (input) => ipcRenderer.invoke('projects:create', input),
        update: (input) => ipcRenderer.invoke('projects:update', input),
        delete: (id) => ipcRenderer.invoke('projects:delete', id),
        setActive: (id) => ipcRenderer.invoke('projects:setActive', id),
        status: () => ipcRenderer.invoke('projects:status')
    },
    devices: {
        list: (projectId) => ipcRenderer.invoke('devices:list', projectId),
        tree: (projectId) => ipcRenderer.invoke('devices:tree', projectId),
        create: (input) => ipcRenderer.invoke('devices:create', input),
        update: (input) => ipcRenderer.invoke('devices:update', input),
        delete: (id) => ipcRenderer.invoke('devices:delete', id),
        status: (projectId) => ipcRenderer.invoke('devices:status', projectId)
    },
    tags: {
        list: (projectId) => ipcRenderer.invoke('tags:list', projectId),
        listByDevice: (deviceId) => ipcRenderer.invoke('tags:listByDevice', deviceId),
        create: (input) => ipcRenderer.invoke('tags:create', input),
        update: (input) => ipcRenderer.invoke('tags:update', input),
        delete: (id) => ipcRenderer.invoke('tags:delete', id),
        status: (projectId) => ipcRenderer.invoke('tags:status', projectId)
    },
    graphics: {
        list: (projectId) => ipcRenderer.invoke('graphics:list', projectId),
        get: (id) => ipcRenderer.invoke('graphics:get', id),
        create: (input) => ipcRenderer.invoke('graphics:create', input),
        update: (input) => ipcRenderer.invoke('graphics:update', input),
        delete: (id) => ipcRenderer.invoke('graphics:delete', id),
        status: (projectId) => ipcRenderer.invoke('graphics:status', projectId)
    },
    reports: {
        list: (projectId) => ipcRenderer.invoke('reports:list', projectId),
        get: (id) => ipcRenderer.invoke('reports:get', id),
        create: (input) => ipcRenderer.invoke('reports:create', input),
        update: (input) => ipcRenderer.invoke('reports:update', input),
        delete: (id) => ipcRenderer.invoke('reports:delete', id),
        status: (projectId) => ipcRenderer.invoke('reports:status', projectId)
    },
    utils: {
        openFile: (filters) => ipcRenderer.invoke('utils:openFile', filters)
    },
    window: {
        minimize: () => ipcRenderer.send('window:minimize'),
        maximize: () => ipcRenderer.send('window:maximize'),
        close: () => ipcRenderer.send('window:close'),
        isMaximized: () => ipcRenderer.invoke('window:isMaximized')
    }
});
