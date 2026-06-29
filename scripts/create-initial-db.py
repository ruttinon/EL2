import sqlite3
import pathlib
import sys
from datetime import datetime

root = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else pathlib.Path('release/install-layout/ProgramData/EnergyLink Management/data')
root.mkdir(parents=True, exist_ok=True)
db_path = root / 'energylink.db'
conn = sqlite3.connect(db_path)
cur = conn.cursor()
cur.executescript('''
CREATE TABLE IF NOT EXISTS "Project" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL UNIQUE,
  "customerName" TEXT,
  "location" TEXT,
  "timezone" TEXT NOT NULL DEFAULT 'Asia/Bangkok',
  "currency" TEXT NOT NULL DEFAULT 'THB',
  "energyCostRate" REAL NOT NULL DEFAULT 4.20,
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
  FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "ProjectSetting_projectId_key_key" ON "ProjectSetting"("projectId", "key");
CREATE TABLE IF NOT EXISTS "Device" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "parentDeviceId" TEXT,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "type" TEXT NOT NULL,
  "protocol" TEXT NOT NULL DEFAULT 'modbus_tcp',
  "ipAddress" TEXT,
  "port" INTEGER,
  "serialPort" TEXT,
  "baudRate" INTEGER DEFAULT 9600,
  "dataBits" INTEGER DEFAULT 8,
  "stopBits" INTEGER DEFAULT 1,
  "parity" TEXT DEFAULT 'none',
  "peripheralNumber" INTEGER,
  "model" TEXT,
  "location" TEXT,
  "communicationEnabled" BOOLEAN NOT NULL DEFAULT true,
  "historyEnabled" BOOLEAN NOT NULL DEFAULT true,
  "visible" BOOLEAN NOT NULL DEFAULT true,
  "pollingIntervalMs" INTEGER NOT NULL DEFAULT 1000,
  "timeoutMs" INTEGER NOT NULL DEFAULT 2000,
  "status" TEXT NOT NULL DEFAULT 'unknown',
  "lastTestAt" DATETIME,
  "lastError" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY ("parentDeviceId") REFERENCES "Device" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "Device_projectId_name_key" ON "Device"("projectId", "name");
CREATE INDEX IF NOT EXISTS "Device_projectId_idx" ON "Device"("projectId");
CREATE INDEX IF NOT EXISTS "Device_parentDeviceId_idx" ON "Device"("parentDeviceId");

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
CREATE TABLE IF NOT EXISTS "Graphic" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "width" INTEGER NOT NULL DEFAULT 1366,
  "height" INTEGER NOT NULL DEFAULT 768,
  "refreshIntervalMs" INTEGER NOT NULL DEFAULT 1000,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "layoutJson" TEXT NOT NULL DEFAULT '{"version":1,"backgroundColor":"#fbfdff","objects":[]}',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "Graphic_projectId_name_key" ON "Graphic"("projectId", "name");
CREATE INDEX IF NOT EXISTS "Graphic_projectId_idx" ON "Graphic"("projectId");
CREATE INDEX IF NOT EXISTS "Graphic_isDefault_idx" ON "Graphic"("isDefault");


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


CREATE TABLE IF NOT EXISTS "Alarm" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "deviceId" TEXT NOT NULL,
  "tagId" TEXT NOT NULL,
  "alarmType" TEXT NOT NULL,
  "severity" TEXT NOT NULL DEFAULT 'high',
  "status" TEXT NOT NULL DEFAULT 'active',
  "acknowledged" BOOLEAN NOT NULL DEFAULT false,
  "message" TEXT NOT NULL,
  "limitValue" REAL,
  "triggerValue" REAL,
  "startedAt" DATETIME NOT NULL,
  "endedAt" DATETIME,
  "ackAt" DATETIME,
  "ackUser" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY ("deviceId") REFERENCES "Device" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY ("tagId") REFERENCES "Tag" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "Alarm_projectId_status_startedAt_idx" ON "Alarm"("projectId", "status", "startedAt");
CREATE INDEX IF NOT EXISTS "Alarm_deviceId_status_idx" ON "Alarm"("deviceId", "status");
CREATE INDEX IF NOT EXISTS "Alarm_tagId_alarmType_status_idx" ON "Alarm"("tagId", "alarmType", "status");

CREATE TABLE IF NOT EXISTS "AppSetting" (
  "key" TEXT NOT NULL PRIMARY KEY,
  "value" TEXT NOT NULL,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
''')
now = datetime.utcnow().isoformat()
cur.execute('INSERT OR REPLACE INTO "AppSetting" (key,value,updatedAt) VALUES (?,?,?)', ('schemaVersion','15',now))
cur.execute('INSERT OR REPLACE INTO "AppSetting" (key,value,updatedAt) VALUES (?,?,?)', ('databasePath',str(db_path),now))
conn.commit()
conn.close()
print(db_path)
