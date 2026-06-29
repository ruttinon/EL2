-- Phase 28: Report Scheduler
CREATE TABLE IF NOT EXISTS "ReportSchedule" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "reportId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'enabled',
  "frequency" TEXT NOT NULL DEFAULT 'daily',
  "timeOfDay" TEXT NOT NULL DEFAULT '06:00',
  "dayOfWeek" INTEGER,
  "dayOfMonth" INTEGER,
  "formatsJson" TEXT NOT NULL DEFAULT '["pdf"]',
  "dateRange" TEXT NOT NULL DEFAULT 'report_default',
  "lastRunAt" DATETIME,
  "nextRunAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "ReportSchedule_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ReportSchedule_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "ReportSchedule_projectId_name_key" ON "ReportSchedule"("projectId", "name");
CREATE INDEX IF NOT EXISTS "ReportSchedule_projectId_status_nextRunAt_idx" ON "ReportSchedule"("projectId", "status", "nextRunAt");
CREATE INDEX IF NOT EXISTS "ReportSchedule_reportId_idx" ON "ReportSchedule"("reportId");

CREATE TABLE IF NOT EXISTS "ReportScheduleRun" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "scheduleId" TEXT,
  "reportId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'running',
  "format" TEXT NOT NULL,
  "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" DATETIME,
  "generatedFileName" TEXT,
  "generatedFilePath" TEXT,
  "error" TEXT,
  CONSTRAINT "ReportScheduleRun_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ReportScheduleRun_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "ReportSchedule" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ReportScheduleRun_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "ReportScheduleRun_projectId_startedAt_idx" ON "ReportScheduleRun"("projectId", "startedAt");
CREATE INDEX IF NOT EXISTS "ReportScheduleRun_scheduleId_startedAt_idx" ON "ReportScheduleRun"("scheduleId", "startedAt");
CREATE INDEX IF NOT EXISTS "ReportScheduleRun_reportId_startedAt_idx" ON "ReportScheduleRun"("reportId", "startedAt");
CREATE INDEX IF NOT EXISTS "ReportScheduleRun_status_idx" ON "ReportScheduleRun"("status");
