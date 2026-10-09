ALTER TABLE "Job" ADD COLUMN "lastSeenAt" TIMESTAMP(3);
ALTER TABLE "Job" ADD COLUMN "missingCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Job" ADD COLUMN "closedAt" TIMESTAMP(3);

UPDATE "Job" SET
  "lastSeenAt" = "lastCheckedAt",
  "missingCount" = CASE WHEN "status" = 'ACTIVE' AND "missingSince" IS NOT NULL THEN 1 ELSE 0 END,
  "closedAt" = CASE WHEN "status" = 'CLOSED' THEN CURRENT_TIMESTAMP ELSE NULL END;

CREATE TABLE "ExpiredJob" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "companyName" TEXT NOT NULL,
  "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExpiredJob_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ExpiredJob_deletedAt_idx" ON "ExpiredJob"("deletedAt");
CREATE INDEX "ExpiredJob_slug_deletedAt_idx" ON "ExpiredJob"("slug", "deletedAt");
CREATE INDEX "ExpiredJob_sourceId_externalId_deletedAt_idx" ON "ExpiredJob"("sourceId", "externalId", "deletedAt");
CREATE INDEX "Job_status_closedAt_idx" ON "Job"("status", "closedAt");
CREATE INDEX "Job_status_category_idx" ON "Job"("status", "category");
CREATE INDEX "Job_status_country_idx" ON "Job"("status", "country");
CREATE INDEX "Job_status_remoteType_idx" ON "Job"("status", "remoteType");
CREATE INDEX "Job_status_companyId_idx" ON "Job"("status", "companyId");
