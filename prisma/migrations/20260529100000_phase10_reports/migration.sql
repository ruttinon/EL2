CREATE TABLE IF NOT EXISTS "Report" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "reportType" TEXT NOT NULL DEFAULT 'daily_energy',
  "paperSize" TEXT NOT NULL DEFAULT 'A4',
  "orientation" TEXT NOT NULL DEFAULT 'landscape',
  "defaultDateRange" TEXT NOT NULL DEFAULT 'this_month',
  "outputFormat" TEXT NOT NULL DEFAULT 'pdf',
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "templateJson" TEXT NOT NULL DEFAULT '{"version":1,"pages":[{"id":"page_1","width":1123,"height":794,"objects":[]}]}',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "Report_projectId_name_key" ON "Report"("projectId", "name");
CREATE INDEX IF NOT EXISTS "Report_projectId_idx" ON "Report"("projectId");
CREATE INDEX IF NOT EXISTS "Report_isDefault_idx" ON "Report"("isDefault");
