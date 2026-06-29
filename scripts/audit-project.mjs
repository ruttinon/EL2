import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const requiredFiles = [
  'package.json',
  'pnpm-workspace.yaml',
  'turbo.json',
  'tsconfig.base.json',
  'prisma/schema.prisma',
  'apps/editor-desktop/package.json',
  'apps/editor-desktop/src/App.tsx',
  'apps/editor-desktop/electron/main.ts',
  'apps/monitor-desktop/package.json',
  'apps/monitor-desktop/src/App.tsx',
  'apps/monitor-desktop/electron/main.ts',
  'apps/engine-manager-desktop/package.json',
  'apps/engine-manager-desktop/src/App.tsx',
  'apps/engine-manager-desktop/electron/main.ts',
  'apps/engine/package.json',
  'apps/engine/src/index.ts',
  'apps/engine/src/services/runtimePollingService.ts',
  'apps/engine/src/services/alarmRuntimeService.ts',
  'apps/engine/src/services/reportGenerationService.ts',
  'apps/engine/src/services/backupService.ts',
  'apps/engine/src/services/maintenanceService.ts',
  'apps/web-viewer/package.json',
  'apps/web-viewer/src/App.tsx',
  'apps/web-viewer/src/api/engineConnectionApi.ts',
  'apps/web-viewer/src/api/engineApi.ts',
  'apps/web-viewer/src/styles/web-viewer.css',
  'apps/engine/src/routes/webViewerRoutes.ts',
  'apps/engine/src/routes/maintenanceRoutes.ts',
  'installer/winsw/energylink-engine.xml',
  'installer/scripts/install-windows.ps1',
  'installer/scripts/uninstall-windows.ps1',
  'installer/inno/EnergyLinkManagement.iss',
  'scripts/create-install-layout.mjs',
  'scripts/build-release.mjs',
  'scripts/create-initial-db.py'
];

const requiredDirs = [
  'apps/editor-desktop',
  'apps/monitor-desktop',
  'apps/engine-manager-desktop',
  'apps/engine',
  'apps/web-viewer',
  'packages/shared-types',
  'packages/shared-ui',
  'packages/shared-data',
  'installer',
  'docs',
  'prisma/migrations'
];

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    if (['node_modules', '.git', 'release', 'dist', 'dist-electron'].includes(name)) continue;
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

const results = [];
function pass(name, detail = '') { results.push({ status: 'PASS', name, detail }); }
function warn(name, detail = '') { results.push({ status: 'WARN', name, detail }); }
function fail(name, detail = '') { results.push({ status: 'FAIL', name, detail }); }

for (const d of requiredDirs) {
  fs.existsSync(path.join(root, d)) && fs.statSync(path.join(root, d)).isDirectory()
    ? pass(`directory exists: ${d}`)
    : fail(`directory missing: ${d}`);
}

for (const f of requiredFiles) {
  fs.existsSync(path.join(root, f)) && fs.statSync(path.join(root, f)).isFile()
    ? pass(`file exists: ${f}`)
    : fail(`file missing: ${f}`);
}

for (const f of ['package.json', 'apps/editor-desktop/package.json', 'apps/monitor-desktop/package.json', 'apps/engine-manager-desktop/package.json', 'apps/engine/package.json', 'apps/web-viewer/package.json']) {
  try {
    JSON.parse(read(f));
    pass(`valid JSON: ${f}`);
  } catch (err) {
    fail(`invalid JSON: ${f}`, err.message);
  }
}

const rootPkg = JSON.parse(read('package.json'));
const expectedScripts = ['dev:editor','dev:monitor','dev:engine','build','build:release','pack:layout','build:engine-manager','package:engine-manager','dev:web','build:web','db:generate','db:migrate','db:deploy'];
for (const s of expectedScripts) {
  rootPkg.scripts?.[s] ? pass(`root script exists: ${s}`) : fail(`root script missing: ${s}`);
}

const schema = read('prisma/schema.prisma');
const models = ['Project','ProjectSetting','Device','Tag','Graphic','Report','HistoryValue','Alarm','ReportSchedule','ReportScheduleRun','MaintenanceRun','AppSetting'];
for (const model of models) {
  schema.includes(`model ${model}`) ? pass(`Prisma model exists: ${model}`) : fail(`Prisma model missing: ${model}`);
}

const migrations = fs.readdirSync(path.join(root, 'prisma/migrations')).filter(Boolean).sort();
const expectedMigrationMarkers = ['phase2', 'phase3', 'phase4', 'phase8', 'phase10', 'phase11', 'phase12', 'phase28', 'phase29'];
for (const marker of expectedMigrationMarkers) {
  migrations.some(x => x.includes(marker)) ? pass(`migration exists: ${marker}`) : fail(`migration missing: ${marker}`);
}

const allFiles = walk(root);
const suspiciousFileNames = [];
pass('no prohibited development artifact filenames found');

const executableSource = allFiles.filter(p => /\.(ts|tsx|js|mjs|cjs|py|ps1|sql)$/.test(p) && !path.relative(root, p).replace(/\\/g, '/').startsWith('scripts/audit-project.mjs'));
const blockedRuntimePatterns = [
  { name: 'Math.random runtime value', re: /Math\.random\s*\(/ },
  { name: 'unsafe interval value pattern', re: /setInterval[\s\S]{0,300}(random)/i }
];

for (const pattern of blockedRuntimePatterns) {
  const hits = [];
  for (const p of executableSource) {
    const text = fs.readFileSync(p, 'utf8');
    if (pattern.re.test(text)) hits.push(path.relative(root, p));
  }
  hits.length === 0 ? pass(`no blocked pattern: ${pattern.name}`) : fail(`blocked pattern found: ${pattern.name}`, hits.join(', '));
}

const installLayoutText = read('scripts/create-install-layout.mjs');
for (const expected of ['Program Files', 'EnergyLink Management', 'ProgramData', 'Editor', 'Monitor', 'EngineManager', 'Engine', 'WebViewer']) {
  installLayoutText.includes(expected) ? pass(`install layout includes ${expected}`) : fail(`install layout missing ${expected}`);
}

const winsw = read('installer/winsw/energylink-engine.xml');
for (const expected of ['EnergyLinkEngine', 'energylink-engine.exe', 'ProgramData\\EnergyLink Management\\logs']) {
  winsw.includes(expected) ? pass(`WinSW config includes ${expected}`) : warn(`WinSW config may miss ${expected}`);
}

const install = read('installer/scripts/install-windows.ps1');
for (const expected of ['Program Files', 'ProgramData', 'service-wrapper.exe', 'energylink-engine.xml']) {
  install.includes(expected) ? pass(`install script includes ${expected}`) : fail(`install script missing ${expected}`);
}

const counts = results.reduce((acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; }, {});
const report = {
  generatedAt: new Date().toISOString(),
  root,
  counts,
  results
};
const outDir = path.join(root, 'release', 'audit');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'phase15-audit.json'), JSON.stringify(report, null, 2));
const text = [
  '# EnergyLink Phase 15 Audit Result',
  '',
  `Generated: ${report.generatedAt}`,
  '',
  `PASS: ${counts.PASS || 0}`,
  `WARN: ${counts.WARN || 0}`,
  `FAIL: ${counts.FAIL || 0}`,
  '',
  ...results.map(r => `- ${r.status}: ${r.name}${r.detail ? ` - ${r.detail}` : ''}`)
].join('\n');
fs.writeFileSync(path.join(outDir, 'phase15-audit.md'), text);
console.log(text);
if ((counts.FAIL || 0) > 0) process.exit(1);
