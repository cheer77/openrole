-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('GREENHOUSE', 'LEVER', 'ASHBY', 'MANUAL');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('ACTIVE', 'CLOSED', 'HIDDEN');

-- CreateEnum
CREATE TYPE "RemoteType" AS ENUM ('REMOTE', 'HYBRID', 'ON_SITE', 'UNKNOWN');

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logoUrl" TEXT,
    "website" TEXT,
    "careerUrl" TEXT,
    "country" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Source" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "SourceType" NOT NULL,
    "companyId" TEXT NOT NULL,
    "sourceIdentifier" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "lastSyncAt" TIMESTAMP(3),
    "lastSuccessfulSync" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Source_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "shortDescription" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "city" TEXT,
    "country" TEXT,
    "region" TEXT,
    "remoteType" "RemoteType" NOT NULL DEFAULT 'UNKNOWN',
    "employmentType" TEXT,
    "experienceLevel" TEXT,
    "salaryMin" DOUBLE PRECISION,
    "salaryMax" DOUBLE PRECISION,
    "currency" TEXT,
    "technologies" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sourceUrl" TEXT NOT NULL,
    "applyUrl" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastCheckedAt" TIMESTAMP(3) NOT NULL,
    "sortDate" TIMESTAMP(3) NOT NULL,
    "missingSince" TIMESTAMP(3),
    "status" "JobStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Company_slug_key" ON "Company"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Source_type_sourceIdentifier_key" ON "Source"("type", "sourceIdentifier");

-- CreateIndex
CREATE UNIQUE INDEX "Job_slug_key" ON "Job"("slug");

-- CreateIndex
CREATE INDEX "Job_status_sortDate_id_idx" ON "Job"("status", "sortDate", "id");

-- CreateIndex
CREATE INDEX "Job_publishedAt_idx" ON "Job"("publishedAt");

-- CreateIndex
CREATE INDEX "Job_category_idx" ON "Job"("category");

-- CreateIndex
CREATE INDEX "Job_country_idx" ON "Job"("country");

-- CreateIndex
CREATE INDEX "Job_region_idx" ON "Job"("region");

-- CreateIndex
CREATE INDEX "Job_remoteType_idx" ON "Job"("remoteType");

-- CreateIndex
CREATE INDEX "Job_companyId_idx" ON "Job"("companyId");

-- CreateIndex
CREATE INDEX "Job_currency_salaryMin_idx" ON "Job"("currency", "salaryMin");

-- CreateIndex
CREATE INDEX "Job_technologies_idx" ON "Job" USING GIN ("technologies");

-- CreateIndex
CREATE UNIQUE INDEX "Job_sourceId_externalId_key" ON "Job"("sourceId", "externalId");

-- AddForeignKey
ALTER TABLE "Source" ADD CONSTRAINT "Source_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Job" ADD CONSTRAINT "Job_salary_valid" CHECK (
  ("salaryMin" IS NULL OR "salaryMin" >= 0) AND
  ("salaryMax" IS NULL OR "salaryMax" >= 0) AND
  ("salaryMin" IS NULL OR "salaryMax" IS NULL OR "salaryMin" <= "salaryMax")
);
