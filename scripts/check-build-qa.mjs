import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const results = [];

function rel(p) {
  return path.relative(root, p).split(path.sep).join('/');
}

function pass(name, detail = '') {
  results.push({ status: 'PASS', name, detail });
}

function warn(name, detail = '') {
  results.push({ status: 'WARN', name, detail });
}

function fail(name, detail = '') {
  results.push({ status: 'FAIL', name, detail });
}

function readText(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function readJson(file) {
  try {
    return JSON.parse(readText(file));
  } catch (err) {
    fail(`invalid JSON: ${file}`, err.message);
    return null;
  }
}

function existsFile(file) {
  const p = path.join(root, file);
  return fs.existsSync(p) && fs.statSync(p).isFile();
}

function existsDir(dir) {
  const p = path.join(root, dir);
  return fs.existsSync(p) && fs.statSync(p).isDirectory();
}

function walk(dir, out = []) {
  const full = path.join(root, dir);
  if (!fs.existsSync(full)) return out;

  for (const name of fs.readdirSync(full)) {
    if (['node_modules', 'dist', 'dist-electron', '.git', 'release'].includes(name)) continue;
    const p = path.join(full, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(rel(p), out);
    else out.push(rel(p));
  }
  return out;
}

const rootPkg = readJson('package.json');
if (rootPkg) {
  const requiredRootScripts = [
    'dev:engine',
    'dev:editor',
    'dev:monitor',
    'dev:web',
    'build',
    'build:engine',
    'build:editor',
    'build:monitor',
    'build:web',
    'audit',
    'qa:functions',
    'qa:local'
  ];

  for (const script of requiredRootScripts) {
    rootPkg.scripts?.[script]
      ? pass(`root script exists: ${script}`)
      : fail(`root script missing: ${script}`);
  }

  if (rootPkg.scripts?.build === 'pnpm -r build') {
    pass('root build runs workspace builds');
  } else {
    warn('root build should run all workspace builds', rootPkg.scripts?.build ?? 'missing');
  }
}

const workspaces = [
  {
    name: '@energylink/editor-desktop',
    dir: 'apps/editor-desktop/editor-desktop',
    expectedScripts: ['dev', 'build'],
    expectedFiles: ['src/App.tsx', 'src/main.tsx', 'tsconfig.json', 'vite.config.ts']
  },
  {
    name: '@energylink/monitor-desktop',
    dir: 'apps/monitor-desktop',
    expectedScripts: ['dev', 'build'],
    expectedFiles: ['src/App.tsx', 'src/main.tsx', 'tsconfig.json', 'vite.config.ts']
  },
  {
    name: '@energylink/engine',
    dir: 'apps/engine',
    expectedScripts: ['dev', 'build'],
    expectedFiles: ['src/index.ts', 'tsconfig.json']
  },
  {
    name: '@energylink/web-viewer',
    dir: 'apps/web-viewer',
    expectedScripts: ['dev', 'build'],
    expectedFiles: ['src/App.tsx', 'src/main.tsx', 'tsconfig.json', 'vite.config.ts']
  }
];

for (const workspace of workspaces) {
  if (existsDir(workspace.dir)) pass(`workspace directory exists: ${workspace.dir}`);
  else fail(`workspace directory missing: ${workspace.dir}`);

  const pkgFile = `${workspace.dir}/package.json`;
  const pkg = readJson(pkgFile);
  if (pkg) {
    pkg.name === workspace.name
      ? pass(`workspace package name: ${workspace.name}`)
      : warn(`workspace package name differs: ${workspace.dir}`, pkg.name ?? 'missing');

    for (const script of workspace.expectedScripts) {
      pkg.scripts?.[script]
        ? pass(`${workspace.name} script exists: ${script}`)
        : fail(`${workspace.name} script missing: ${script}`);
    }
  }

  for (const file of workspace.expectedFiles) {
    existsFile(`${workspace.dir}/${file}`)
      ? pass(`file exists: ${workspace.dir}/${file}`)
      : fail(`file missing: ${workspace.dir}/${file}`);
  }
}

const sourceFiles = walk('apps').filter(file => /\.(ts|tsx|js|mjs)$/.test(file));

const blockedSourcePatterns = [
  {
    name: 'LoginGate usage in runtime apps',
    re: /<\s*LoginGate\b|from ['\"].*LoginGate['\"]/,
    allow: []
  },
  {
    name: 'password UI field in runtime apps',
    re: /password|Password|PASSWORD/,
    allow: []
  },
  {
    name: 'mock simulator fake runtime naming',
    re: /mock|simulator|fake|demo\s*(data|value|runtime)|Math\.random\s*\(/i,
    allow: []
  }
];

for (const pattern of blockedSourcePatterns) {
  const hits = [];
  for (const file of sourceFiles) {
    const text = readText(file);
    if (pattern.re.test(text)) hits.push(file);
  }
  hits.length === 0
    ? pass(`no blocked source pattern: ${pattern.name}`)
    : fail(`blocked source pattern found: ${pattern.name}`, hits.join(', '));
}

const appFiles = [
  'apps/editor-desktop/editor-desktop/src/App.tsx',
  'apps/monitor-desktop/src/App.tsx',
  'apps/web-viewer/src/App.tsx'
];

for (const file of appFiles) {
  if (!existsFile(file)) continue;
  const text = readText(file);
  if (/export\s+default\s+App|export\s+function\s+App|export\s+default\s+function\s+App/.test(text)) pass(`App export exists: ${file}`);
  else fail(`App export missing: ${file}`);

  if (/LoginGate/.test(text)) fail(`LoginGate still referenced: ${file}`);
  else pass(`LoginGate not referenced: ${file}`);
}

const editorCommandBus = 'apps/editor-desktop/editor-desktop/src/commandBus.ts';
if (existsFile(editorCommandBus)) {
  pass('commandBus exists', editorCommandBus);
} else {
  fail('commandBus missing', editorCommandBus);
}

const editorSourceText = sourceFiles
  .filter(file => file.startsWith('apps/editor-desktop/editor-desktop/src/'))
  .map(file => readText(file).toLowerCase())
  .join('\n');

const expectedCommands = [
  'New', 'Open', 'Save', 'Import', 'Export',
  'Add Converter', 'Add Meter', 'Add Tag', 'Modify', 'Delete',
  'New Graphic', 'Set Default', 'Object Tools', 'Bind Tag',
  'Validate', 'Preview', 'Export PDF', 'Export Excel', 'Print',
  'Preferences', 'Units', 'Styles', 'Images', 'Database', 'Backup'
];

for (const command of expectedCommands) {
  const normalized = command.toLowerCase();
  editorSourceText.includes(normalized)
    ? pass(`editor command implemented or routed: ${command}`)
    : warn(`editor command not found in editor source: ${command}`);
}

const outDir = path.join(root, 'release', 'qa');
fs.mkdirSync(outDir, { recursive: true });
const counts = results.reduce((acc, item) => {
  acc[item.status] = (acc[item.status] || 0) + 1;
  return acc;
}, {});

const report = {
  generatedAt: new Date().toISOString(),
  root,
  counts,
  results
};

fs.writeFileSync(path.join(outDir, 'build-qa.json'), JSON.stringify(report, null, 2));

const lines = [
  '# EnergyLink Round 14 Build QA Result',
  '',
  `Generated: ${report.generatedAt}`,
  '',
  `PASS: ${counts.PASS || 0}`,
  `WARN: ${counts.WARN || 0}`,
  `FAIL: ${counts.FAIL || 0}`,
  '',
  ...results.map(item => `- ${item.status}: ${item.name}${item.detail ? ` - ${item.detail}` : ''}`)
];

const text = lines.join('\n');
fs.writeFileSync(path.join(outDir, 'build-qa.md'), text);
console.log(text);

if ((counts.FAIL || 0) > 0) process.exit(1);
