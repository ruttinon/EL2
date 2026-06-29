-- Energy billing tariffs (PowerStudio-style bill simulation)
CREATE TABLE "EnergyTariff" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "configJson" TEXT NOT NULL,
    "effectiveFrom" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EnergyTariff_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "EnergyTariff_projectId_name_key" ON "EnergyTariff"("projectId", "name");
CREATE INDEX "EnergyTariff_projectId_idx" ON "EnergyTariff"("projectId");
