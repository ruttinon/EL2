/**
 * One-shot backfill for tag energyTagRole — run while engine is up:
 *   pnpm exec tsx apps/engine/scripts/backfill-tag-roles.ts [projectId]
 */
import { backfillTagEnergyRoles } from '../src/services/carbonService.js';
import { ensureDatabaseSchema, disconnectPrismaClient } from '../src/services/database.js';

const projectId = process.argv[2];
const dryRun = process.argv.includes('--dry-run');

async function main() {
  await ensureDatabaseSchema();
  const result = await backfillTagEnergyRoles(projectId, dryRun);
  console.log(JSON.stringify(result, null, 2));
  await disconnectPrismaClient();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
