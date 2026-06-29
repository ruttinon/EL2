-- Project carbon profile + tag energy role
ALTER TABLE "Project" ADD COLUMN "facilityType" TEXT NOT NULL DEFAULT 'mixed';
ALTER TABLE "Project" ADD COLUMN "emissionFactorKgPerKwh" REAL NOT NULL DEFAULT 0.45;
ALTER TABLE "Project" ADD COLUMN "netMetering" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Project" ADD COLUMN "floorAreaM2" REAL;
ALTER TABLE "Tag" ADD COLUMN "energyTagRole" TEXT NOT NULL DEFAULT 'none';
