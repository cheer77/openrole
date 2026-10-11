CREATE TABLE "AnalyticsSession" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "visitorId" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "activeSeconds" INTEGER NOT NULL DEFAULT 0,
  "pageSeconds" INTEGER NOT NULL DEFAULT 0,
  "pages" INTEGER NOT NULL DEFAULT 0,
  "jobViews" INTEGER NOT NULL DEFAULT 0,
  "searches" INTEGER NOT NULL DEFAULT 0,
  "filters" INTEGER NOT NULL DEFAULT 0,
  "applyClicks" INTEGER NOT NULL DEFAULT 0,
  "heartbeatCount" INTEGER NOT NULL DEFAULT 0,
  "distinctPaths" INTEGER NOT NULL DEFAULT 0,
  "botScore" INTEGER NOT NULL DEFAULT 50,
  "visitorType" TEXT NOT NULL DEFAULT 'UNCERTAIN',
  "knownBot" BOOLEAN NOT NULL DEFAULT false,
  "country" TEXT,
  "city" TEXT,
  "referrer" TEXT,
  "device" TEXT
);
CREATE INDEX "AnalyticsSession_lastActivityAt_visitorType_idx" ON "AnalyticsSession"("lastActivityAt", "visitorType");
CREATE INDEX "AnalyticsSession_startedAt_visitorType_idx" ON "AnalyticsSession"("startedAt", "visitorType");
CREATE TABLE "IntegrationSetting" (
  "provider" TEXT NOT NULL PRIMARY KEY,
  "identifier" TEXT NOT NULL DEFAULT '',
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "AdminAuditLog" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "actor" TEXT NOT NULL DEFAULT 'owner',
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "details" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "AdminAuditLog_createdAt_idx" ON "AdminAuditLog"("createdAt");
CREATE INDEX "AdminAuditLog_entityType_entityId_createdAt_idx" ON "AdminAuditLog"("entityType", "entityId", "createdAt");
INSERT INTO "AnalyticsSession" (
  "id", "visitorId", "startedAt", "lastActivityAt", "pages", "jobViews", "applyClicks", "distinctPaths",
  "botScore", "visitorType", "country", "city", "referrer", "device"
)
SELECT "sessionId", MIN("visitorId"), MIN("occurredAt"), MAX("occurredAt"),
  COUNT(*) FILTER (WHERE "type" = 'PAGE_VIEW')::int,
  COUNT(*) FILTER (WHERE "type" = 'JOB_VIEW')::int,
  COUNT(*) FILTER (WHERE "type" = 'APPLY_CLICK')::int,
  COUNT(DISTINCT "path")::int,
  CASE WHEN COUNT(*) FILTER (WHERE "type" = 'APPLY_CLICK') > 0 THEN 15
       WHEN COUNT(*) FILTER (WHERE "type" = 'JOB_VIEW') > 0 THEN 25
       ELSE 50 END,
  CASE WHEN COUNT(*) FILTER (WHERE "type" IN ('JOB_VIEW', 'APPLY_CLICK')) > 0 THEN 'HUMAN'
       ELSE 'UNCERTAIN' END,
  (ARRAY_AGG("country" ORDER BY "occurredAt" DESC))[1],
  (ARRAY_AGG("city" ORDER BY "occurredAt" DESC))[1],
  (ARRAY_AGG("referrer" ORDER BY "occurredAt" DESC))[1],
  (ARRAY_AGG("device" ORDER BY "occurredAt" DESC))[1]
FROM "AnalyticsEvent" GROUP BY "sessionId"
ON CONFLICT ("id") DO NOTHING;
