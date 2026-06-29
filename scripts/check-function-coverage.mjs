import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

const editorAppPath = path.join(root, 'apps/editor-desktop/src/App.tsx');
const workspacePaths = {
  file: path.join(root, 'apps/editor-desktop/src/features/file/FileWorkspace.tsx'),
  devices: path.join(root, 'apps/editor-desktop/src/features/devices/DevicesWorkspace.tsx'),
  graphics: path.join(root, 'apps/editor-desktop/src/features/graphics/GraphicsWorkspace.tsx'),
  reports: path.join(root, 'apps/editor-desktop/src/features/reports/ReportsWorkspace.tsx'),
  setup: path.join(root, 'apps/editor-desktop/src/features/setup/SetupWorkspace.tsx')
};

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function normalize(item) {
  return item.trim().toLowerCase().replace(/\s+/g, ' ');
}

function extractArrayLiteral(source, key) {
  const marker = `${key}: [`;
  const start = source.indexOf(marker);
  if (start < 0) throw new Error(`Cannot find ribbon module ${key}`);

  const arrayStart = source.indexOf('[', start);
  let depth = 0;
  for (let i = arrayStart; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '[') depth += 1;
    if (ch === ']') depth -= 1;
    if (depth === 0) return source.slice(arrayStart, i + 1);
  }

  throw new Error(`Cannot parse ribbon module ${key}`);
}

function extractStringItems(arrayLiteral) {
  const result = [];
  const re = /'([^']+)'|"([^"]+)"/g;
  let match;
  while ((match = re.exec(arrayLiteral))) {
    result.push(match[1] ?? match[2]);
  }
  return result;
}

function commandHandled(workspaceSource, command) {
  const escaped = command.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const commandCompare = new RegExp(`item\\s*={2,3}\\s*['\"]${escaped}['\"]`);
  const directString = new RegExp(`['\"]${escaped}['\"]`);

  return commandCompare.test(workspaceSource) || directString.test(workspaceSource);
}

const appSource = read(editorAppPath);
const modules = Object.keys(workspacePaths);
const failures = [];
const rows = [];

for (const moduleName of modules) {
  const arrayLiteral = extractArrayLiteral(appSource, moduleName);
  const commands = extractStringItems(arrayLiteral).map(normalize);
  const workspaceSource = read(workspacePaths[moduleName]);

  for (const command of commands) {
    const handled = commandHandled(workspaceSource, command);
    rows.push({ module: moduleName, command, handled });
    if (!handled) failures.push(`${moduleName}: ${command}`);
  }
}

const reportDir = path.join(root, 'release', 'qa');
fs.mkdirSync(reportDir, { recursive: true });

const markdown = [
  '# EnergyLink Function Coverage Check',
  '',
  `Generated: ${new Date().toISOString()}`,
  '',
  `Commands checked: ${rows.length}`,
  `Unhandled commands: ${failures.length}`,
  '',
  '| Module | Ribbon command | Handler status |',
  '|---|---|---|',
  ...rows.map(row => `| ${row.module} | ${row.command} | ${row.handled ? 'PASS' : 'FAIL'} |`)
].join('\n');

fs.writeFileSync(path.join(reportDir, 'function-coverage.md'), markdown);
fs.writeFileSync(path.join(reportDir, 'function-coverage.json'), JSON.stringify({ generatedAt: new Date().toISOString(), rows, failures }, null, 2));

console.log(markdown);

if (failures.length > 0) {
  console.error('\nUnhandled ribbon commands:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
