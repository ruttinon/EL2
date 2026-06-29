-- AlterTable: add publish tracking fields to Project
ALTER TABLE "Project" ADD COLUMN "publishedVersion" INTEGER;
ALTER TABLE "Project" ADD COLUMN "publishedAt"      DATETIME;

-- CreateTable: PublishedSnapshot
CREATE TABLE "PublishedSnapshot" (
    "id"           TEXT     NOT NULL PRIMARY KEY,
    "projectId"    TEXT     NOT NULL,
    "version"      INTEGER  NOT NULL,
    "label"        TEXT,
    "devicesJson"  TEXT     NOT NULL,
    "tagsJson"     TEXT     NOT NULL,
    "graphicsJson" TEXT     NOT NULL,
    "reportsJson"  TEXT     NOT NULL,
    "publishedAt"  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedBy"  TEXT,
    CONSTRAINT "PublishedSnapshot_projectId_fkey"
        FOREIGN KEY ("projectId") REFERENCES "Project" ("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "PublishedSnapshot_projectId_version_key"
    ON "PublishedSnapshot"("projectId", "version");

CREATE INDEX "PublishedSnapshot_projectId_publishedAt_idx"
    ON "PublishedSnapshot"("projectId", "publishedAt");
