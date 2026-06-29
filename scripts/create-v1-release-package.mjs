import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = process.cwd();
const outDir = path.join(root, 'release', 'v1.0');
fs.mkdirSync(outDir, { recursive: true });

function walk(dir, acc = []) {
  for (const name of fs.readdirSync(dir)) {
    if (['node_modules', '.git'].includes(name)) continue;
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

const files = walk(root).filter(p => !path.relative(root, p).startsWith('release/v1.0/v1-release-manifest.json'));
const entries = files.map(p => ({
  path: path.relative(root, p).replaceAll('\\\\', '/'),
  size: fs.statSync(p).size,
  sha256: sha256(p)
}));

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const manifest = {
  product: 'EnergyLink Management',
  version: pkg.version,
  release: 'v1.0 Release Package',
  generatedAt: new Date().toISOString(),
  installerExpected: 'release/installer/EnergyLinkManagement_Setup_v1_0_0.exe',
  noRuntime generatorPolicy: true,
  entries
};

fs.writeFileSync(path.join(outDir, 'v1-release-manifest.json'), JSON.stringify(manifest, null, 2));
console.log(`Created ${path.relative(root, path.join(outDir, 'v1-release-manifest.json'))}`);
console.log(`Files indexed: ${entries.length}`);
