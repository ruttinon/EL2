DROP INDEX IF EXISTS "Tag_projectId_name_key";

CREATE UNIQUE INDEX "Tag_deviceId_name_key" ON "Tag"("deviceId", "name");
