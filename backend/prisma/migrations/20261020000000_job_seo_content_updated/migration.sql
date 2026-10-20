ALTER TABLE "Job"
  ADD COLUMN "contentUpdatedAt" TIMESTAMP(3),
  ADD COLUMN "structuredLocations" JSONB NOT NULL DEFAULT '[]';

ALTER TABLE "Company" ADD COLUMN "contentUpdatedAt" TIMESTAMP(3);

-- Preserve reliable structured geography already stored on legacy rows. Do
-- not backfill contentUpdatedAt from updatedAt: sync bookkeeping also changes
-- updatedAt, so it is not evidence of a public content modification.
UPDATE "Job"
SET "structuredLocations" = jsonb_build_array(jsonb_build_object(
  'city', "city",
  'region', "region",
  'country', "country"
))
WHERE "country" ~ '^[A-Z]{2}$';
