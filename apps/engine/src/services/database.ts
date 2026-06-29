import { PrismaClient } from '@prisma/client';
import { getDatabaseUrl } from '@energylink/shared-data';

let prisma: PrismaClient | undefined;

function getSqliteDatabaseUrl() {
  const baseUrl = process.env.DATABASE_URL ?? getDatabaseUrl();
  // Add SQLite parameters for better concurrent access
  // timeout: 10000ms for database operations
  // journal_mode: WAL enables concurrent reads with writes
  // synchronous: NORMAL provides good balance between speed and safety
  // temp_store: MEMORY uses memory for temporary tables
  if (baseUrl.startsWith('file:')) {
    return `${baseUrl}?timeout=30000&journal_mode=WAL&synchronous=NORMAL&temp_store=MEMORY`;
  }
  return baseUrl;
}

export function getPrismaClient() {
  if (!prisma) {
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: getSqliteDatabaseUrl()
        }
      }
    });
    void prisma.$executeRawUnsafe('PRAGMA busy_timeout = 30000').catch(() => undefined);
  }
  return prisma;
}

function isTransientSqliteError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /timed out|timeout|database is locked|SQLITE_BUSY|failed to respond/i.test(message);
}

export async function withSqliteRetry<T>(operation: () => Promise<T>, attempts = 5): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isTransientSqliteError(error) || attempt === attempts) throw error;
      await new Promise(resolve => setTimeout(resolve, 200 * attempt));
    }
  }
  throw lastError;
}

async function tableColumnExists(table: string, column: string) {
  const client = getPrismaClient();
  const rows = await client.$queryRawUnsafe<Array<{ name: string }>>(`PRAGMA table_info("${table}")`);
  return rows.some(row => row.name === column);
}

async function deviceColumnExists(column: string) {
  return tableColumnExists('Device', column);
}

/** Apply additive SQLite repairs when Prisma schema is ahead of the live DB file. */
export async function ensureDatabaseSchema() {
  const client = getPrismaClient();
  if (!(await deviceColumnExists('imageDataUrl'))) {
    await client.$executeRawUnsafe(`ALTER TABLE "Device" ADD COLUMN "imageDataUrl" TEXT`);
  }
  if (!(await deviceColumnExists('model3dUrl'))) {
    await client.$executeRawUnsafe(`ALTER TABLE "Device" ADD COLUMN "model3dUrl" TEXT`);
  }
  if (!(await deviceColumnExists('mqttUsername'))) {
    await client.$executeRawUnsafe(`ALTER TABLE "Device" ADD COLUMN "mqttUsername" TEXT`);
  }
  if (!(await deviceColumnExists('mqttPassword'))) {
    await client.$executeRawUnsafe(`ALTER TABLE "Device" ADD COLUMN "mqttPassword" TEXT`);
  }
  if (!(await deviceColumnExists('mqttClientId'))) {
    await client.$executeRawUnsafe(`ALTER TABLE "Device" ADD COLUMN "mqttClientId" TEXT`);
  }
  if (!(await deviceColumnExists('energyMappingJson'))) {
    await client.$executeRawUnsafe(`ALTER TABLE "Device" ADD COLUMN "energyMappingJson" TEXT`);
  }
  if (!(await tableColumnExists('Project', 'facilityType'))) {
    await client.$executeRawUnsafe(`ALTER TABLE "Project" ADD COLUMN "facilityType" TEXT NOT NULL DEFAULT 'mixed'`);
  }
  if (!(await tableColumnExists('Project', 'emissionFactorKgPerKwh'))) {
    await client.$executeRawUnsafe(`ALTER TABLE "Project" ADD COLUMN "emissionFactorKgPerKwh" REAL NOT NULL DEFAULT 0.45`);
  }
  if (!(await tableColumnExists('Project', 'netMetering'))) {
    await client.$executeRawUnsafe(`ALTER TABLE "Project" ADD COLUMN "netMetering" BOOLEAN NOT NULL DEFAULT false`);
  }
  if (!(await tableColumnExists('Project', 'floorAreaM2'))) {
    await client.$executeRawUnsafe(`ALTER TABLE "Project" ADD COLUMN "floorAreaM2" REAL`);
  }
  if (!(await tableColumnExists('Tag', 'energyTagRole'))) {
    await client.$executeRawUnsafe(`ALTER TABLE "Tag" ADD COLUMN "energyTagRole" TEXT NOT NULL DEFAULT 'none'`);
  }
  if (!(await tableColumnExists('Tag', 'mqttTopic'))) {
    await client.$executeRawUnsafe(`ALTER TABLE "Tag" ADD COLUMN "mqttTopic" TEXT`);
  }
  if (!(await tableColumnExists('PublishedSnapshot', 'projectCarbonJson'))) {
    await client.$executeRawUnsafe(`ALTER TABLE "PublishedSnapshot" ADD COLUMN "projectCarbonJson" TEXT`);
  }
}

/** Write carbon config onto a snapshot without relying on a regenerated Prisma client. */
export async function writePublishedSnapshotCarbonJson(snapshotId: string, projectCarbonJson: string) {
  if (!(await tableColumnExists('PublishedSnapshot', 'projectCarbonJson'))) return;
  const client = getPrismaClient();
  await client.$executeRawUnsafe(
    `UPDATE "PublishedSnapshot" SET "projectCarbonJson" = ? WHERE "id" = ?`,
    projectCarbonJson,
    snapshotId
  );
}

export async function disconnectPrismaClient() {
  if (prisma) {
    await prisma.$disconnect();
    prisma = undefined;
  }
}
