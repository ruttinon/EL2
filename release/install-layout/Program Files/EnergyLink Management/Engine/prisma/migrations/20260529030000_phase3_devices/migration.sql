-- Phase 3 - Devices
CREATE TABLE "Device" (
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
    "slaveId" INTEGER,
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
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Device_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Device_parentDeviceId_fkey" FOREIGN KEY ("parentDeviceId") REFERENCES "Device" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Device_projectId_name_key" ON "Device"("projectId", "name");
CREATE INDEX "Device_projectId_idx" ON "Device"("projectId");
CREATE INDEX "Device_parentDeviceId_idx" ON "Device"("parentDeviceId");
