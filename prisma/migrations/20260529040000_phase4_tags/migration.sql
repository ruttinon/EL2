CREATE TABLE IF NOT EXISTS "Tag" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "deviceId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "address" INTEGER NOT NULL,
  "registerType" TEXT NOT NULL DEFAULT 'holding_register',
  "dataType" TEXT NOT NULL DEFAULT 'float32',
  "unit" TEXT,
  "scale" REAL NOT NULL DEFAULT 1,
  "offset" REAL NOT NULL DEFAULT 0,
  "decimalPlaces" INTEGER NOT NULL DEFAULT 2,
  "historyEnabled" BOOLEAN NOT NULL DEFAULT true,
  "alarmHigh" REAL,
  "alarmLow" REAL,
  "currentValue" REAL,
  "quality" TEXT NOT NULL DEFAULT 'unknown',
  "lastValueAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY ("deviceId") REFERENCES "Device" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "Tag_projectId_name_key" ON "Tag"("projectId", "name");
CREATE INDEX IF NOT EXISTS "Tag_projectId_idx" ON "Tag"("projectId");
CREATE INDEX IF NOT EXISTS "Tag_deviceId_idx" ON "Tag"("deviceId");
