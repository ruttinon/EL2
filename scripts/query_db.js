import { PrismaClient } from '@prisma/client';

const dbPath = 'C:\\ProgramData\\EnergyLink Management\\data\\energylink.db';
const dbUrl = `file:${dbPath.replace(/\\/g, '/')}`;

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: dbUrl
    }
  }
});

async function run() {
  try {
    const reports = await prisma.report.findMany();
    console.log(`Found ${reports.length} reports in the database:`);
    for (const report of reports) {
      console.log('--- Report ID:', report.id);
      console.log('Name:', report.name);
      console.log('templateJson (raw):', report.templateJson);
      try {
        console.log('templateJson (parsed):', JSON.stringify(JSON.parse(report.templateJson), null, 2));
      } catch (e) {
        console.log('templateJson is invalid JSON:', e.message);
      }
    }
  } catch (error) {
    console.error('Error querying DB:', error);
  } finally {
    await prisma.$disconnect();
  }
}

run();
