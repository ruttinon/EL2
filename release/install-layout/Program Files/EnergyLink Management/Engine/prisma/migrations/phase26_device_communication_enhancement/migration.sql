-- Phase 26: Device Communication Enhancement
-- Adds physical serial transport settings for real Modbus RTU devices.
ALTER TABLE "Device" ADD COLUMN "baudRate" INTEGER DEFAULT 9600;
ALTER TABLE "Device" ADD COLUMN "dataBits" INTEGER DEFAULT 8;
ALTER TABLE "Device" ADD COLUMN "stopBits" INTEGER DEFAULT 1;
ALTER TABLE "Device" ADD COLUMN "parity" TEXT DEFAULT 'none';
