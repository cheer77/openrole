ALTER TABLE "Job" ADD COLUMN "categoryVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Job" ADD COLUMN "employmentKind" TEXT;
CREATE INDEX "Job_categoryVersion_id_idx" ON "Job"("categoryVersion", "id");
CREATE INDEX "Job_status_employmentKind_idx" ON "Job"("status", "employmentKind");
