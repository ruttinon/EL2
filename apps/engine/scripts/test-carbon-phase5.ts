/**
 * Smoke test carbon APIs via service layer (no HTTP server required).
 *   pnpm exec tsx apps/engine/scripts/test-carbon-phase5.ts [projectId]
 */
import {
  buildCarbonBreakdown,
  buildCarbonSummary,
  resolveProjectId,
} from '../src/services/carbonService.js';
import { disconnectPrismaClient, ensureDatabaseSchema } from '../src/services/database.js';

const projectId = process.argv[2];

async function main() {
  await ensureDatabaseSchema();
  const resolved = await resolveProjectId(projectId);
  console.log('projectId:', resolved);

  const live = await buildCarbonSummary(projectId, { period: 'live' });
  console.log('live summary:', {
    kWhQualified: live?.kWhQualified,
    carbonKg: live?.carbonKg,
    strategy: live?.strategy,
    issues: live?.configIssues?.length,
  });

  const week = await buildCarbonSummary(projectId, { period: '7d' });
  console.log('7d summary:', {
    dataSource: week?.dataSource,
    kWhQualified: week?.kWhQualified,
    period: week?.period,
  });

  const breakdown = await buildCarbonBreakdown(projectId, 'loadCategory', { period: 'live' });
  console.log('breakdown:', {
    items: breakdown?.items.length,
    totalKwh: breakdown?.totalKwh,
    top: breakdown?.items.slice(0, 3),
  });

  await disconnectPrismaClient();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
