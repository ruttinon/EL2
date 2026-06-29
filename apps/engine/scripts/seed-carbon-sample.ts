/**
 * Inject sample kWh readings for carbon UI testing when meters are offline.
 * Usage:
 *   npx tsx apps/engine/scripts/seed-carbon-sample.ts [projectNameOrId]
 */
import { seedCarbonSample } from '../src/services/carbonService.js';

async function main() {
  const result = await seedCarbonSample(process.argv[2] ?? 'test');
  console.log(`Seeded sample values on ${result.tagsUpdated} tag(s) for project "${result.projectName}".`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
