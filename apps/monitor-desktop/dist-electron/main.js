import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
async function createWindow() {
    const win = new BrowserWindow({ width: 1366, height: 840, title: 'EnergyLink Monitor', backgroundColor: '#edf4f7' });
    if (process.env.VITE_DEV_SERVER_URL)
        await win.loadURL(process.env.VITE_DEV_SERVER_URL);
    else
        await win.loadFile(path.join(__dirname, '../dist/index.html'));
}
app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin')
    app.quit(); });
