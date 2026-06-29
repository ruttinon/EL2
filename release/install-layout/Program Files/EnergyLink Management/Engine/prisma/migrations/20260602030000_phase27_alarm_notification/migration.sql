-- Phase 27: Alarm Notification / Email / Sound Foundation

CREATE TABLE "AlarmNotificationChannel" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "projectId" TEXT,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "configJson" TEXT NOT NULL DEFAULT '{}',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "AlarmNotificationChannel_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "AlarmNotificationChannel_projectId_name_key" ON "AlarmNotificationChannel"("projectId", "name");
CREATE INDEX "AlarmNotificationChannel_projectId_idx" ON "AlarmNotificationChannel"("projectId");
CREATE INDEX "AlarmNotificationChannel_type_idx" ON "AlarmNotificationChannel"("type");
CREATE INDEX "AlarmNotificationChannel_enabled_idx" ON "AlarmNotificationChannel"("enabled");

CREATE TABLE "AlarmNotificationRule" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "projectId" TEXT,
  "channelId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "eventType" TEXT NOT NULL,
  "minSeverity" TEXT NOT NULL DEFAULT 'low',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "AlarmNotificationRule_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AlarmNotificationRule_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "AlarmNotificationChannel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "AlarmNotificationRule_projectId_idx" ON "AlarmNotificationRule"("projectId");
CREATE INDEX "AlarmNotificationRule_channelId_idx" ON "AlarmNotificationRule"("channelId");
CREATE INDEX "AlarmNotificationRule_enabled_idx" ON "AlarmNotificationRule"("enabled");
CREATE INDEX "AlarmNotificationRule_eventType_idx" ON "AlarmNotificationRule"("eventType");

CREATE TABLE "AlarmNotificationEvent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "alarmId" TEXT NOT NULL,
  "channelId" TEXT,
  "eventType" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "message" TEXT NOT NULL,
  "error" TEXT,
  "deliveredAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AlarmNotificationEvent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AlarmNotificationEvent_alarmId_fkey" FOREIGN KEY ("alarmId") REFERENCES "Alarm" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AlarmNotificationEvent_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "AlarmNotificationChannel" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "AlarmNotificationEvent_projectId_createdAt_idx" ON "AlarmNotificationEvent"("projectId", "createdAt");
CREATE INDEX "AlarmNotificationEvent_alarmId_idx" ON "AlarmNotificationEvent"("alarmId");
CREATE INDEX "AlarmNotificationEvent_channelId_idx" ON "AlarmNotificationEvent"("channelId");
CREATE INDEX "AlarmNotificationEvent_status_idx" ON "AlarmNotificationEvent"("status");
CREATE INDEX "AlarmNotificationEvent_eventType_idx" ON "AlarmNotificationEvent"("eventType");
