-- Phase 12 - Alarm Runtime
CREATE TABLE "Alarm" (
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
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "Alarm_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Alarm_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Alarm_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "Alarm_projectId_status_startedAt_idx" ON "Alarm"("projectId", "status", "startedAt");
CREATE INDEX "Alarm_deviceId_status_idx" ON "Alarm"("deviceId", "status");
CREATE INDEX "Alarm_tagId_alarmType_status_idx" ON "Alarm"("tagId", "alarmType", "status");
