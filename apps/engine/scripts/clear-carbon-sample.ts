/**
 * Remove injected sample kWh readings — carbon will use live meter data only.
 * Usage:
 *   npx tsx apps/engine/scripts/clear-carbon-sample.ts [projectNameOrId]
 */
import { clearCarbonSample } from '../src/services/carbonService.js';

async function main() {
  const result = await clearCarbonSample(process.argv[2] ?? 'test');
  console.log(`Cleared sample values on ${result.tagsCleared} tag(s) for project "${result.projectName}".`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
