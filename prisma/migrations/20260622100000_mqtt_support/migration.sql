-- MQTT broker credentials on devices + per-tag subscribe topics
ALTER TABLE "Device" ADD COLUMN "mqttUsername" TEXT;
ALTER TABLE "Device" ADD COLUMN "mqttPassword" TEXT;
ALTER TABLE "Device" ADD COLUMN "mqttClientId" TEXT;
ALTER TABLE "Tag" ADD COLUMN "mqttTopic" TEXT;
