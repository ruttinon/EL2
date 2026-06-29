-- Phase 29 - Data Retention and Maintenance Tools
CREATE TABLE IF NOT EXISTS "MaintenanceRun" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "jobType" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'running',
  "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" DATETIME,
  "deletedRows" INTEGER NOT NULL DEFAULT 0,
  "deletedFiles" INTEGER NOT NULL DEFAULT 0,
  "detailsJson" TEXT NOT NULL DEFAULT '{}',
  "error" TEXT
);

CREATE INDEX IF NOT EXISTS "MaintenanceRun_jobType_startedAt_idx" ON "MaintenanceRun"("jobType", "startedAt");
CREATE INDEX IF NOT EXISTS "MaintenanceRun_status_startedAt_idx" ON "MaintenanceRun"("status", "startedAt");
