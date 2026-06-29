-- Phase 8 - Graphics Designer
-- Adds only configuration/design storage. No runtime values, no runtime generator, no generated device data.
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
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "Graphic_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "Graphic_projectId_name_key" ON "Graphic"("projectId", "name");
CREATE INDEX IF NOT EXISTS "Graphic_projectId_idx" ON "Graphic"("projectId");
CREATE INDEX IF NOT EXISTS "Graphic_isDefault_idx" ON "Graphic"("isDefault");
