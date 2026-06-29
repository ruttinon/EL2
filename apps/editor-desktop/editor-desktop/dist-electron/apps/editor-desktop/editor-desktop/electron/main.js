import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProject, deleteProject, disconnectProjectStore, getProjectDatabaseStatus, listProjects, setActiveProject, updateProject } from './services/projectStore.js';
import { createDevice, deleteDevice, disconnectDeviceStore, getDeviceDatabaseStatus, getDeviceTree, listDevices, updateDevice } from './services/deviceStore.js';
import { createTag, deleteTag, disconnectTagStore, getTagDatabaseStatus, listTags, listTagsByDevice, updateTag } from './services/tagStore.js';
import { createGraphic, deleteGraphic, disconnectGraphicStore, getGraphic, getGraphicDatabaseStatus, listGraphics, updateGraphic } from './services/graphicStore.js';
import { createReport, deleteReport, disconnectReportStore, getReport, getReportDatabaseStatus, listReports, updateReport } from './services/reportStore.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isDev = process.env.NODE_ENV === 'development' || process.env.VITE_DEV_SERVER_URL;
function registerReportIpc() {
    ipcMain.handle('reports:list', (_event, projectId) => listReports(projectId));
    ipcMain.handle('reports:get', (_event, id) => getReport(id));
    ipcMain.handle('reports:create', (_event, input) => createReport(input));
    ipcMain.handle('reports:update', (_event, input) => updateReport(input));
    ipcMain.handle('reports:delete', (_event, id) => deleteReport(id));
    ipcMain.handle('reports:status', (_event, projectId) => getReportDatabaseStatus(projectId));
}
function registerGraphicIpc() {
    ipcMain.handle('graphics:list', (_event, projectId) => listGraphics(projectId));
    ipcMain.handle('graphics:get', (_event, id) => getGraphic(id));
    ipcMain.handle('graphics:create', (_event, input) => createGraphic(input));
    ipcMain.handle('graphics:update', (_event, input) => updateGraphic(input));
    ipcMain.handle('graphics:delete', (_event, id) => deleteGraphic(id));
    ipcMain.handle('graphics:status', (_event, projectId) => getGraphicDatabaseStatus(projectId));
}
function registerDeviceIpc() {
    ipcMain.handle('devices:list', (_event, projectId) => listDevices(projectId));
    ipcMain.handle('devices:tree', (_event, projectId) => getDeviceTree(projectId));
    ipcMain.handle('devices:create', (_event, input) => createDevice(input));
    ipcMain.handle('devices:update', (_event, input) => updateDevice(input));
    ipcMain.handle('devices:delete', (_event, id) => deleteDevice(id));
    ipcMain.handle('devices:status', (_event, projectId) => getDeviceDatabaseStatus(projectId));
}
function registerTagIpc() {
    ipcMain.handle('tags:list', (_event, projectId) => listTags(projectId));
    ipcMain.handle('tags:listByDevice', (_event, deviceId) => listTagsByDevice(deviceId));
    ipcMain.handle('tags:create', (_event, input) => createTag(input));
    ipcMain.handle('tags:update', (_event, input) => updateTag(input));
    ipcMain.handle('tags:delete', (_event, id) => deleteTag(id));
    ipcMain.handle('tags:status', (_event, projectId) => getTagDatabaseStatus(projectId));
}
function registerProjectIpc() {
    ipcMain.handle('projects:list', () => listProjects());
    ipcMain.handle('projects:create', (_event, input) => createProject(input));
    ipcMain.handle('projects:update', (_event, input) => updateProject(input));
    ipcMain.handle('projects:delete', (_event, id) => deleteProject(id));
    ipcMain.handle('projects:setActive', (_event, id) => setActiveProject(id));
    ipcMain.handle('projects:status', () => getProjectDatabaseStatus());
}
function registerUtilsIpc() {
    ipcMain.handle('utils:openFile', async (_event, filters) => {
        const result = await dialog.showOpenDialog({
            properties: ['openFile'],
            filters
        });
        return result.filePaths[0];
    });
}
let mainWindow = null;
function registerWindowIpc() {
    ipcMain.on('window:minimize', () => mainWindow?.minimize());
    ipcMain.on('window:maximize', () => {
        if (!mainWindow)
            return;
        if (mainWindow.isMaximized())
            mainWindow.unmaximize();
        else
            mainWindow.maximize();
    });
    ipcMain.on('window:close', () => mainWindow?.close());
    ipcMain.handle('window:isMaximized', () => mainWindow?.isMaximized() ?? false);
}
async function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1440,
        height: 900,
        minWidth: 1200,
        minHeight: 760,
        title: 'EnergyLink Editor',
        backgroundColor: '#f3fbfc',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });
    if (isDev && process.env.VITE_DEV_SERVER_URL) {
        await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    }
    else {
        await mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }
}
registerProjectIpc();
registerDeviceIpc();
registerTagIpc();
registerGraphicIpc();
registerReportIpc();
registerUtilsIpc();
registerWindowIpc();
app.whenReady().then(createWindow);
app.on('window-all-closed', async () => {
    await Promise.all([disconnectProjectStore(), disconnectDeviceStore(), disconnectTagStore(), disconnectGraphicStore(), disconnectReportStore()]);
    if (process.platform !== 'darwin')
        app.quit();
});
app.on('before-quit', () => { void Promise.all([disconnectProjectStore(), disconnectDeviceStore(), disconnectTagStore(), disconnectGraphicStore(), disconnectReportStore()]); });
app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0)
        createWindow();
});
