import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const out = path.join(root, 'release', 'install-layout');
const programFiles = path.join(out, 'Program Files', 'EnergyLink Management');
const programData = path.join(out, 'ProgramData', 'EnergyLink Management');

function mkdirp(p) { fs.mkdirSync(p, { recursive: true }); }
function copyEntry(src, dest) {
  const stat = fs.lstatSync(src);
  if (stat.isSymbolicLink()) {
    mkdirp(path.dirname(dest));
    try {
      fs.rmSync(dest, { recursive: true, force: true });
    } catch { }
    const target = fs.readlinkSync(src);
    fs.symlinkSync(target, dest, process.platform === 'win32' ? 'junction' : undefined);
    return;
  }
  if (stat.isDirectory()) {
    mkdirp(dest);
    for (const entry of fs.readdirSync(src)) {
      copyEntry(path.join(src, entry), path.join(dest, entry));
    }
    return;
  }
  if (stat.isFile()) {
    mkdirp(path.dirname(dest));
    fs.copyFileSync(src, dest);
  }
}
function copyDir(src, dest) {
  if (!fs.existsSync(src)) return false;
  copyEntry(src, dest);
  return true;
}
function writeText(file, text) { mkdirp(path.dirname(file)); fs.writeFileSync(file, text); }
function toPrismaSqliteUrl(file) { return `file:${file.replace(/\\/g, '/')}`; }
function deployPrismaMigrations(dbFile) {
  const schema = path.join('prisma', 'schema.prisma');
  const localPrismaCli = path.join(root, 'node_modules', 'prisma', 'build', 'index.js');
  const env = { ...process.env, DATABASE_URL: toPrismaSqliteUrl(dbFile) };
  if (fs.existsSync(localPrismaCli)) {
    execFileSync(process.execPath, [localPrismaCli, 'migrate', 'deploy', '--schema', schema], { cwd: root, stdio: 'inherit', env });
    return;
  }
  const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  execFileSync(npx, ['prisma', 'migrate', 'deploy', '--schema', schema], { cwd: root, stdio: 'inherit', env });
}
function createMigratedSqliteDatabase(targetDbFile) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'energylink-db-'));
  const tempDbFile = path.join(tempRoot, 'energylink.db');
  try {
    fs.closeSync(fs.openSync(tempDbFile, 'w'));
    deployPrismaMigrations(tempDbFile);
    mkdirp(path.dirname(targetDbFile));
    fs.copyFileSync(tempDbFile, targetDbFile);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

fs.rmSync(out, { recursive: true, force: true });

const dirs = [
  path.join(programFiles, 'Editor'),
  path.join(programFiles, 'Monitor'),
  path.join(programFiles, 'EngineManager'),
  path.join(programFiles, 'Engine'),
  path.join(programFiles, 'WebViewer', 'dist'),
  path.join(programData, 'config'),
  path.join(programData, 'data'),
  path.join(programData, 'logs'),
  path.join(programData, 'graphics'),
  path.join(programData, 'reports'),
  path.join(programData, 'images'),
  path.join(programData, 'drivers'),
  path.join(programData, 'backups')
];
for (const d of dirs) mkdirp(d);

// Copy built Electron app folders if available. If not available, write clear build placeholders.
const editorReleaseCandidates = [
  path.join(root, 'apps', 'editor-desktop', 'release', 'win-unpacked'),
  path.join(root, 'apps', 'editor-desktop', 'dist-electron-package', 'win-unpacked')
];
const monitorReleaseCandidates = [
  path.join(root, 'apps', 'monitor-desktop', 'release', 'win-unpacked'),
  path.join(root, 'apps', 'monitor-desktop', 'dist-electron-package', 'win-unpacked')
];
const engineManagerReleaseCandidates = [
  path.join(root, 'apps', 'engine-manager-desktop', 'release', 'win-unpacked'),
  path.join(root, 'apps', 'engine-manager-desktop', 'dist-electron-package', 'win-unpacked')
];
const editorCopied = editorReleaseCandidates.some(src => copyDir(src, path.join(programFiles, 'Editor')));
const monitorCopied = monitorReleaseCandidates.some(src => copyDir(src, path.join(programFiles, 'Monitor')));
const engineManagerCopied = engineManagerReleaseCandidates.some(src => copyDir(src, path.join(programFiles, 'EngineManager')));

if (!editorCopied) {
  writeText(path.join(programFiles, 'Editor', 'README.txt'), 'Build EnergyLink Editor first. Expected final executable: EnergyLink Editor.exe\nRun: pnpm build:editor && pnpm package:editor\n');
}
if (!monitorCopied) {
  writeText(path.join(programFiles, 'Monitor', 'README.txt'), 'Build EnergyLink Monitor first. Expected final executable: EnergyLink Monitor.exe\nRun: pnpm build:monitor && pnpm package:monitor\n');
}
if (!engineManagerCopied) {
  writeText(path.join(programFiles, 'EngineManager', 'README.txt'), 'Build EnergyLink Engine Manager first. Expected final executable: EnergyLink Engine Manager.exe\nRun: pnpm build:engine-manager && pnpm package:engine-manager\n');
}

// Engine package. The service must use real device communication only. No runtime generator is packaged.
const engineDist = path.join(root, 'apps', 'engine', 'dist');
copyDir(engineDist, path.join(programFiles, 'Engine', 'dist'));
copyDir(path.join(root, 'node_modules'), path.join(programFiles, 'Engine', 'node_modules'));
copyDir(path.join(root, 'prisma'), path.join(programFiles, 'Engine', 'prisma'));
copyDir(path.join(root, 'packages'), path.join(programFiles, 'Engine', 'packages'));

const winswSourceExe = path.join(root, 'installer', 'winsw', 'service-wrapper.exe');
if (fs.existsSync(winswSourceExe)) {
  fs.copyFileSync(winswSourceExe, path.join(programFiles, 'Engine', 'service-wrapper.exe'));
} else {
  writeText(path.join(programFiles, 'Engine', 'service-wrapper.exe.placeholder'), 'Place WinSW executable here and rename it to service-wrapper.exe.\n');
}
fs.copyFileSync(path.join(root, 'installer', 'winsw', 'energylink-engine.xml'), path.join(programFiles, 'Engine', 'energylink-engine.xml'));
writeText(path.join(programFiles, 'Engine', 'energylink-engine.cmd'), '@echo off\r\ncd /d "%~dp0"\r\nnode dist/index.js\r\n');
writeText(path.join(programFiles, 'Engine', 'README.txt'), 'EnergyLink Engine Service files. Install with service-wrapper.exe install. This package contains no runtime generator and no generated runtime values.\n');

// Web viewer static build.
const webDist = path.join(root, 'apps', 'web-viewer', 'dist');
if (!copyDir(webDist, path.join(programFiles, 'WebViewer', 'dist'))) {
  writeText(path.join(programFiles, 'WebViewer', 'dist', 'README.txt'), 'Build Web Viewer first. Run: pnpm build:web\n');
}

const engineConfig = {
  engineName: 'EnergyLink Local Engine',
  port: 8081,
  apiHost: '0.0.0.0',
  database: 'C:/ProgramData/EnergyLink Management/data/energylink.db',
  dataFolder: 'C:/ProgramData/EnergyLink Management/data',
  logFolder: 'C:/ProgramData/EnergyLink Management/logs',
  graphicsFolder: 'C:/ProgramData/EnergyLink Management/graphics',
  reportsFolder: 'C:/ProgramData/EnergyLink Management/reports',
  imagesFolder: 'C:/ProgramData/EnergyLink Management/images',
  driversFolder: 'C:/ProgramData/EnergyLink Management/drivers',
  backupsFolder: 'C:/ProgramData/EnergyLink Management/backups',
  autoStart: true,
  logLevel: 'info',
  serviceMode: true
};
writeText(path.join(programData, 'config', 'engine.json'), JSON.stringify(engineConfig, null, 2));

try {
  createMigratedSqliteDatabase(path.join(programData, 'data', 'energylink.db'));
} catch {
  writeText(path.join(programData, 'data', 'energylink.db.placeholder'), 'Run Prisma migrations to create the SQLite database: pnpm db:deploy\n');
}
writeText(path.join(programData, 'logs', 'engine.log.placeholder'), 'Engine log file placeholder.\n');

// Copy installer helpers into layout.
copyDir(path.join(root, 'installer', 'scripts'), path.join(out, 'installer', 'scripts'));
copyDir(path.join(root, 'installer', 'winsw'), path.join(out, 'installer', 'winsw'));
copyDir(path.join(root, 'installer', 'inno'), path.join(out, 'installer', 'inno'));

console.log(`EnergyLink install layout created at ${out}`);
console.log('Program Files layout:');
console.log(path.join(programFiles));
console.log('ProgramData layout:');
console.log(path.join(programData));

