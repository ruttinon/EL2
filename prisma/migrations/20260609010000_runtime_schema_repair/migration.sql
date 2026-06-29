-- Repair runtime columns that were added to Prisma schema after the older installer DB seed.
ALTER TABLE "Device" ADD COLUMN "littleEndianData" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Device" ADD COLUMN "swapRegisterBytes" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Device" ADD COLUMN "maxRegistersPerGroup" INTEGER NOT NULL DEFAULT 120;

ALTER TABLE "Tag" ADD COLUMN "registers" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Tag" ADD COLUMN "functionCode" INTEGER NOT NULL DEFAULT 3;
ALTER TABLE "Tag" ADD COLUMN "functionWriteCode" INTEGER NOT NULL DEFAULT 16;
