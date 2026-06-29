import { contextBridge, ipcRenderer } from 'electron';
contextBridge.exposeInMainWorld('engineManagerApi', {
    getServiceStatus: () => ipcRenderer.invoke('engine-manager:getServiceStatus'),
    startService: () => ipcRenderer.invoke('engine-manager:startService'),
    stopService: () => ipcRenderer.invoke('engine-manager:stopService'),
    restartService: () => ipcRenderer.invoke('engine-manager:restartService'),
    openProgramData: () => ipcRenderer.invoke('engine-manager:openProgramData'),
    openLogs: () => ipcRenderer.invoke('engine-manager:openLogs'),
    openConfig: () => ipcRenderer.invoke('engine-manager:openConfig'),
    openEngineUrl: () => ipcRenderer.invoke('engine-manager:openEngineUrl'),
    readRecentLogLines: (limit) => ipcRenderer.invoke('engine-manager:readRecentLogLines', limit),
    readRuntimeSettings: () => ipcRenderer.invoke('engine-manager:readRuntimeSettings'),
    saveRuntimeSettings: (config) => ipcRenderer.invoke('engine-manager:saveRuntimeSettings', config)
});
