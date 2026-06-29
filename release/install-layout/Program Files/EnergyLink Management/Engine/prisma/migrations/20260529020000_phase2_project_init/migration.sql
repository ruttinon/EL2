-- Phase 2: Project + SQLite foundation
CREATE TABLE IF NOT EXISTS "Project" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL UNIQUE,
  "customerName" TEXT,
  "location" TEXT,
  "timezone" TEXT NOT NULL DEFAULT 'Asia/Bangkok',
  "currency" TEXT NOT NULL DEFAULT 'THB',
  "energyCostRate" REAL NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "ProjectSetting" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectSetting_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProjectSetting_projectId_key_key" ON "ProjectSetting"("projectId", "key");

CREATE TABLE IF NOT EXISTS "AppSetting" (
  "key" TEXT NOT NULL PRIMARY KEY,
  "value" TEXT NOT NULL,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO "AppSetting" ("key", "value") VALUES
  ('schemaVersion', '2'),
  ('activeProjectId', ''),
  ('programDataPath', 'C:\\ProgramData\\EnergyLink Management'),
  ('databasePath', 'C:\\ProgramData\\EnergyLink Management\\data\\energylink.db');
