import { setTimeout as delay } from "node:timers/promises";
import type { PrismaClient } from "../generated/prisma/client.js";
import { classifyEmploymentType, classifyExperienceLevel, classifyJob } from "./classification.js";

// Runs in the worker, never in a public request. Versioned rows make retries
// idempotent and keep subsequent deployments from rescanning the whole table.
export async function reclassifyJobs(db: PrismaClient) {
  let processed = 0;
  let changed = 0;
  for (;;) {
    const rows = await db.job.findMany({
      where: { categoryVersion: { lt: 1 } },
      orderBy: { id: "asc" },
      take: 250,
      select: { id: true, title: true, sourceCategories: true, employmentType: true,
        category: true, employmentKind: true, experienceLevel: true, manualOverride: true },
    });
    if (!rows.length) return { processed, changed };
    const groups = new Map<string, { ids: string[]; changedIds: string[]; category: string; employmentKind: string | null;
      experienceLevel: string | null }>();
    for (const row of rows) {
      const category = row.manualOverride ? row.category : classifyJob(row.title, row.sourceCategories);
      const employmentKind = classifyEmploymentType(row.employmentType);
      const experienceLevel = row.manualOverride ? row.experienceLevel : classifyExperienceLevel(row.title);
      const contentChanged = category !== row.category || employmentKind !== row.employmentKind || experienceLevel !== row.experienceLevel;
      if (contentChanged) changed++;
      const key = JSON.stringify([category, employmentKind, experienceLevel]);
      const group = groups.get(key) ?? { ids: [], changedIds: [], category, employmentKind, experienceLevel };
      group.ids.push(row.id);
      if (contentChanged) group.changedIds.push(row.id);
      groups.set(key, group);
    }
    for (const group of groups.values()) {
      await db.job.updateMany({
        where: { id: { in: group.ids }, categoryVersion: { lt: 1 } },
        data: { category: group.category, categoryVersion: 1,
          employmentKind: group.employmentKind, experienceLevel: group.experienceLevel },
      });
      if (group.changedIds.length) await db.job.updateMany({
        where: { id: { in: group.changedIds } },
        data: { contentUpdatedAt: new Date() },
      });
    }
    processed += rows.length;
    await delay(150);
  }
}
