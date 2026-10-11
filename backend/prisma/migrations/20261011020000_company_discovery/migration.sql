ALTER TABLE "Company"
  ADD COLUMN "websiteDomain" TEXT,
  ADD COLUMN "normalizedName" TEXT,
  ADD COLUMN "discoveredFrom" TEXT,
  ADD COLUMN "discoveredAt" TIMESTAMP(3),
  ADD COLUMN "discoveryStatus" TEXT NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "lastDiscoveryAt" TIMESTAMP(3),
  ADD COLUMN "discoveryAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "nextRetryAt" TIMESTAMP(3),
  ADD COLUMN "detectedAts" TEXT,
  ADD COLUMN "detectedIdentifier" TEXT,
  ADD COLUMN "discoveryConfidence" TEXT,
  ADD COLUMN "validationStatus" TEXT,
  ADD COLUMN "discoveryError" TEXT,
  ADD COLUMN "discoverySourceId" TEXT;
CREATE INDEX "Company_websiteDomain_idx" ON "Company"("websiteDomain");
CREATE INDEX "Company_normalizedName_idx" ON "Company"("normalizedName");
CREATE INDEX "Company_discoveryStatus_nextRetryAt_idx" ON "Company"("discoveryStatus", "nextRetryAt");
CREATE INDEX "Company_discoverySourceId_idx" ON "Company"("discoverySourceId");
