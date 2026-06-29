CREATE TABLE IF NOT EXISTS "HistoryValue" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "deviceId" TEXT NOT NULL,
  "tagId" TEXT NOT NULL,
  "value" REAL,
  "quality" TEXT NOT NULL DEFAULT 'unknown',
  "rawJson" TEXT,
  "error" TEXT,
  "readAt" DATETIME NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY ("deviceId") REFERENCES "Device" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY ("tagId") REFERENCES "Tag" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "HistoryValue_projectId_readAt_idx" ON "HistoryValue"("projectId", "readAt");
CREATE INDEX IF NOT EXISTS "HistoryValue_deviceId_readAt_idx" ON "HistoryValue"("deviceId", "readAt");
CREATE INDEX IF NOT EXISTS "HistoryValue_tagId_readAt_idx" ON "HistoryValue"("tagId", "readAt");
