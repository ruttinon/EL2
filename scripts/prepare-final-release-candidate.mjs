import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = process.cwd();
const releaseDir = path.join(root, 'release', 'final-rc');
const installLayout = path.join(root, 'release', 'install-layout');
fs.mkdirSync(releaseDir, { recursive: true });

function fileHash(file) {
  const h = crypto.createHash('sha256');
  h.update(fs.readFileSync(file));
  return h.digest('hex');
}
function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}
const files = walk(installLayout).map(file => ({
  path: path.relative(installLayout, file).replaceAll('\\', '/'),
  size: fs.statSync(file).size,
  sha256: fileHash(file)
}));
const manifest = {
  product: 'EnergyLink Management',
  phase: 30,
  version: '0.30.0-rc.1',
  generatedAt: new Date().toISOString(),
  installLayout: {
    programFiles: 'C:/Program Files/EnergyLink Management',
    programData: 'C:/ProgramData/EnergyLink Management'
  },
  components: ['Editor', 'Monitor', 'EngineManager', 'Engine', 'WebViewer'],
  noRuntime generatorPolicy: true,
  files
};
fs.writeFileSync(path.join(releaseDir, 'final-rc-manifest.json'), JSON.stringify(manifest, null, 2));
fs.writeFileSync(path.join(releaseDir, 'FINAL_RC_README.md'), `# EnergyLink Management Final Installer Release Candidate\n\nVersion: 0.30.0-rc.1\n\nThis release candidate packages the project sources, install layout scripts, Windows Service configuration, Electron desktop applications, Engine API, Web Viewer, database schema, maintenance tools and build automation.\n\n## No Runtime generator Policy\n\nThis package must not include runtime generator, generated runtime value, random meter value, generated alarm, generated trend, generated history or generated report data. Runtime values must come only from real configured devices through the Engine.\n\n## Expected Windows Build\n\n1. Run \`pnpm install\`.\n2. Run \`pnpm db:generate\`.\n3. Run \`pnpm audit\`.\n4. Run \`pnpm build:windows-release\`.\n5. Compile \`installer/inno/EnergyLinkManagement.iss\` with Inno Setup.\n\n## Expected Installed Layout\n\n\`\`\`text\nC:/Program Files/EnergyLink Management/\n├── Editor/\n├── Monitor/\n├── EngineManager/\n├── Engine/\n└── WebViewer/dist/\n\nC:/ProgramData/EnergyLink Management/\n├── config/engine.json\n├── data/energylink.db\n├── logs/\n├── graphics/\n├── reports/\n├── images/\n└── backups/\n\`\`\`\n`);
console.log(`Final RC manifest written: ${path.join(releaseDir, 'final-rc-manifest.json')}`);
