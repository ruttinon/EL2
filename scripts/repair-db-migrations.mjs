/**
 * Repairs Prisma migration history when ensureDatabaseSchema() already applied
 * additive columns (duplicate-column failures on migrate deploy).
 *
 * Usage: node scripts/repair-db-migrations.mjs
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Migrations whose SQL is already satisfied by ensureDatabaseSchema / manual repair. */
const MARK_APPLIED = [
  '20260617000000_device_image',
  '20260617100000_device_energy_mapping',
  '20260617110000_project_carbon_tag_energy_role',
  '20260618100000_publish_project_carbon',
  '20260622100000_mqtt_support',
  '20260622130000_device_model3d',
];

function runPrisma(args) {
  const result = spawnSync('npx', ['prisma', ...args], {
    cwd: rootDir,
    encoding: 'utf8',
    shell: true,
    stdio: ['inherit', 'pipe', 'pipe'],
  });
  const out = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim();
  if (out) console.log(out);
  return { ok: result.status === 0, out };
}

console.log('Repairing Prisma migration history…\n');

for (const name of MARK_APPLIED) {
  console.log(`→ mark applied: ${name}`);
  const { ok, out } = runPrisma(['migrate', 'resolve', '--applied', name]);
  if (!ok && !/already recorded as applied/i.test(out)) {
    console.error(`Failed to resolve ${name}`);
    process.exit(1);
  }
}

let deployAttempts = 0;
while (deployAttempts < 5) {
  deployAttempts += 1;
  console.log(`\n→ prisma migrate deploy (attempt ${deployAttempts})`);
  const { ok, out } = runPrisma(['migrate', 'deploy']);
  if (ok) {
    console.log('\nDatabase migrations are up to date.');
    process.exit(0);
  }
  const failed = out.match(/The `([^`]+)` migration/);
  if (failed && /duplicate column name/i.test(out)) {
    const name = failed[1];
    console.log(`→ duplicate column — recovering ${name}`);
    runPrisma(['migrate', 'resolve', '--rolled-back', name]);
    const resolved = runPrisma(['migrate', 'resolve', '--applied', name]);
    if (!resolved.ok) process.exit(1);
    continue;
  }
  console.error('\nMigrate deploy failed with an unexpected error.');
  process.exit(1);
}

console.error('\nMigrate deploy did not complete after retries.');
process.exit(1);
