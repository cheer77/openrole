CREATE TYPE "SyncRunTrigger" AS ENUM ('AUTO', 'MANUAL');
CREATE TYPE "SyncRunStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCESS', 'PARTIAL', 'FAILED', 'INTERRUPTED', 'SKIPPED');
CREATE TYPE "SyncRunSourceStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCESS', 'FAILED', 'INTERRUPTED', 'SKIPPED');

CREATE TABLE "SyncRun" (
  "id" TEXT NOT NULL,
  "trigger" "SyncRunTrigger" NOT NULL,
  "status" "SyncRunStatus" NOT NULL DEFAULT 'QUEUED',
  "totalSources" INTEGER NOT NULL DEFAULT 0,
  "completedSources" INTEGER NOT NULL DEFAULT 0,
  "failedSources" INTEGER NOT NULL DEFAULT 0,
  "jobsCreated" INTEGER NOT NULL DEFAULT 0,
  "jobsUpdated" INTEGER NOT NULL DEFAULT 0,
  "jobsClosed" INTEGER NOT NULL DEFAULT 0,
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SyncRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SyncRunSource" (
  "id" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "status" "SyncRunSourceStatus" NOT NULL DEFAULT 'QUEUED',
  "jobsFound" INTEGER NOT NULL DEFAULT 0,
  "jobsCreated" INTEGER NOT NULL DEFAULT 0,
  "jobsUpdated" INTEGER NOT NULL DEFAULT 0,
  "jobsClosed" INTEGER NOT NULL DEFAULT 0,
  "error" TEXT,
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SyncRunSource_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ImportLog" ADD COLUMN "syncRunSourceId" TEXT;
CREATE INDEX "SyncRun_createdAt_idx" ON "SyncRun"("createdAt");
CREATE INDEX "SyncRun_status_createdAt_idx" ON "SyncRun"("status", "createdAt");
CREATE UNIQUE INDEX "SyncRunSource_runId_sourceId_key" ON "SyncRunSource"("runId", "sourceId");
CREATE INDEX "SyncRunSource_runId_status_idx" ON "SyncRunSource"("runId", "status");
CREATE INDEX "SyncRunSource_sourceId_createdAt_idx" ON "SyncRunSource"("sourceId", "createdAt");
CREATE INDEX "ImportLog_syncRunSourceId_idx" ON "ImportLog"("syncRunSourceId");
ALTER TABLE "SyncRunSource" ADD CONSTRAINT "SyncRunSource_runId_fkey" FOREIGN KEY ("runId") REFERENCES "SyncRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SyncRunSource" ADD CONSTRAINT "SyncRunSource_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ImportLog" ADD CONSTRAINT "ImportLog_syncRunSourceId_fkey" FOREIGN KEY ("syncRunSourceId") REFERENCES "SyncRunSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;
