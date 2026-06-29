import { getPrismaClient, ensureDatabaseSchema, disconnectPrismaClient, writePublishedSnapshotCarbonJson } from '../src/services/database.js';
import { serializeProjectCarbon, validateCarbonForPublish } from '../src/services/carbonService.js';

const projectId = process.argv[2] ?? 'cmq2hte3v4msulcb03vbhtgi2';

async function main() {
  await ensureDatabaseSchema();
  const prisma = getPrismaClient();

  const cols = await prisma.$queryRawUnsafe<Array<{ name: string }>>(`PRAGMA table_info("PublishedSnapshot")`);
  console.log('PublishedSnapshot columns:', cols.map(c => c.name));

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new Error('project not found');
  console.log('project carbon fields:', {
    facilityType: project.facilityType,
    emissionFactorKgPerKwh: project.emissionFactorKgPerKwh,
    netMetering: project.netMetering,
  });

  const carbonCheck = await validateCarbonForPublish(projectId);
  console.log('carbonCheck ok:', carbonCheck.ok, 'issues:', carbonCheck.issues?.length);

  const [devices, tags] = await Promise.all([
    prisma.device.findMany({ where: { projectId } }),
    prisma.tag.findMany({ where: { projectId } }),
  ]);
  console.log('counts:', { devices: devices.length, tags: tags.length });
  console.log('tagsJson length:', JSON.stringify(tags).length);

  try {
    const projectCarbonJson = serializeProjectCarbon({
      facilityType: project.facilityType,
      emissionFactorKgPerKwh: project.emissionFactorKgPerKwh,
      netMetering: project.netMetering,
      floorAreaM2: project.floorAreaM2,
    });

    const snapshot = await prisma.publishedSnapshot.create({
      data: {
        projectId,
        version: 99999,
        label: 'test-publish-script',
        devicesJson: JSON.stringify(devices),
        tagsJson: JSON.stringify(tags),
        graphicsJson: '[]',
        reportsJson: '[]',
        publishedBy: 'test-script',
      },
    });
    await writePublishedSnapshotCarbonJson(snapshot.id, projectCarbonJson);
    console.log('create ok:', snapshot.id);
    await prisma.publishedSnapshot.delete({ where: { id: snapshot.id } });
    console.log('cleanup ok');
  } catch (err) {
    console.error('create failed:', err);
  }

  await disconnectPrismaClient();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
