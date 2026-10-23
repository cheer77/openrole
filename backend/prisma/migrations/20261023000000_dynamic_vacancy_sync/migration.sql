CREATE TABLE "VacancySyncConfig" (
    "id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "intervalHours" INTEGER NOT NULL DEFAULT 12,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "appliedRevision" INTEGER NOT NULL DEFAULT 0,
    "nextRunAt" TIMESTAMP(3),
    "lastApplyError" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VacancySyncConfig_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "VacancySyncConfig_intervalHours_check" CHECK ("intervalHours" IN (1, 3, 6, 12, 24))
);

INSERT INTO "VacancySyncConfig" (
    "id", "enabled", "intervalHours", "revision", "appliedRevision", "updatedAt"
) VALUES (
    'vacancy-sync', true, 12, 1, 0, CURRENT_TIMESTAMP
);
