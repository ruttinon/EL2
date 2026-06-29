import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

const ignored = new Set(['node_modules', '.git']);
const root = process.cwd();
const files = [];

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (ignored.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(full);
    } else if (entry.isFile()) {
      const rel = path.relative(root, full).replace(/\\/g, '/');
      const buf = await readFile(full);
      files.push({
        path: rel,
        sha256: createHash('sha256').update(buf).digest('hex'),
        bytes: (await stat(full)).size,
      });
    }
  }
}

await walk(root);
files.sort((a, b) => a.path.localeCompare(b.path));

const manifest = {
  product: 'EnergyLink Management',
  phase: 'Phase 16 - Release Candidate Handoff',
  version: '0.16.0-phase16',
  createdUtc: new Date().toISOString(),
  technology: ['Electron', 'React', 'TypeScript', 'Node.js', 'Prisma', 'SQLite', 'WinSW', 'Inno Setup'],
  noRuntime generatorPolicy: true,
  installedLayout: {
    programFiles: 'C:/Program Files/EnergyLink Management',
    programData: 'C:/ProgramData/EnergyLink Management',
  },
  fileCount: files.length,
  files,
};

await writeFile('release/manifest.json', `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(`Wrote release/manifest.json with ${files.length} files.`);
