import { BadRequestException, Body, ConflictException, Controller, Get, Inject, NotFoundException, Param, Patch, Post, Query, ServiceUnavailableException, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { readFileSync } from "node:fs";
import { Database } from "./db.js";
import { OwnerGuard } from "./admin-auth.js";
import { createQueue } from "./queue.js";
import {
  reconcileVacancySyncScheduler,
  StaleVacancySyncRevisionError,
  updateVacancySyncConfig,
  vacancySyncState,
  vacancySyncUpdateSchema,
} from "./worker-schedule.js";
import {
  createManualSyncRun,
  syncRunDetails,
  syncRunHistory,
  SyncRunAlreadyActiveError,
} from "./sync-runs.js";

export const integrations = {
  ga4: { label: "Google Analytics 4", pattern: /^G-[A-Z0-9]{4,20}$/ },
  gtm: { label: "Google Tag Manager", pattern: /^GTM-[A-Z0-9]{4,20}$/ },
  meta: { label: "Meta Pixel", pattern: /^\d{8,20}$/ },
  clarity: { label: "Microsoft Clarity", pattern: /^[a-z0-9]{5,32}$/i },
} as const;
type Provider = keyof typeof integrations;
const apiVersion = (JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as { version: string }).version;
export function integrationStatus(provider: Provider, identifier: string, enabled: boolean) {
  if (identifier && !integrations[provider].pattern.test(identifier)) return "Invalid";
  return enabled ? "Active" : "Disabled";
}

@Controller("integrations")
export class PublicIntegrationsController {
  constructor(@Inject(Database) private readonly db: Database) {}
  @Get()
  async list() {
    const rows = await this.db.client.integrationSetting.findMany({ where: { enabled: true } });
    return rows.filter((row) => row.provider in integrations && integrationStatus(row.provider as Provider, row.identifier, row.enabled) === "Active")
      .map((row) => ({ provider: row.provider, identifier: row.identifier }));
  }
}

@Controller("admin")
@UseGuards(OwnerGuard)
export class ControlCenterController {
  constructor(@Inject(Database) private readonly db: Database) {}

  @Get("search")
  async search(@Query("q") input: string) {
    const q = z.string().trim().min(2).max(100).safeParse(input);
    if (!q.success) return { jobs: [], companies: [], sources: [] };
    const term = q.data;
    const [jobs, companies, sources] = await Promise.all([
      this.db.client.job.findMany({ where: { OR: [{ title: { contains: term, mode: "insensitive" } }, { company: { name: { contains: term, mode: "insensitive" } } }] }, select: { id: true, title: true, status: true, company: { select: { name: true } } }, take: 6, orderBy: { firstSeenAt: "desc" } }),
      this.db.client.company.findMany({ where: { name: { contains: term, mode: "insensitive" } }, select: { id: true, name: true, enabled: true }, take: 6, orderBy: { name: "asc" } }),
      this.db.client.source.findMany({ where: { OR: [{ name: { contains: term, mode: "insensitive" } }, { company: { name: { contains: term, mode: "insensitive" } } }] }, select: { id: true, name: true, enabled: true, company: { select: { name: true } } }, take: 6, orderBy: { name: "asc" } }),
    ]);
    return { jobs, companies, sources };
  }

  @Get("alerts")
  async alerts() {
    const stale = new Date(Date.now() - 26 * 3600000);
    const old = new Date(Date.now() - 60 * 86400000);
    const [failedImports, failedSources, staleSources, oldJobs] = await Promise.all([
      this.db.client.importLog.count({ where: { status: { in: ["FAILED", "INTERRUPTED"] }, startedAt: { gte: new Date(Date.now() - 86400000) } } }),
      this.db.client.source.count({ where: { enabled: true, lastError: { not: null } } }),
      this.db.client.source.count({ where: { enabled: true, company: { enabled: true }, type: { not: "MANUAL" }, createdAt: { lt: stale }, OR: [{ lastSuccessfulSync: null }, { lastSuccessfulSync: { lt: stale } }] } }),
      this.db.client.job.count({ where: { status: "ACTIVE", lastCheckedAt: { lt: old }, source: { enabled: true } } }),
    ]);
    return [
      failedImports && { id: "imports", label: `${failedImports} failed or interrupted imports in the last 24 hours`, href: "/admin/logs" },
      failedSources && { id: "sources", label: `${failedSources} enabled sources report an error`, href: "/admin/sources" },
      staleSources && { id: "stale", label: `${staleSources} sources have not synced successfully in 26 hours`, href: "/admin/sources" },
      oldJobs && { id: "jobs", label: `${oldJobs} active jobs have not been checked for 60 days`, href: "/admin/jobs?status=ACTIVE" },
    ].filter(Boolean);
  }

  @Get("system")
  async system() {
    const [database, lastImport, sources] = await Promise.all([
      this.db.client.$queryRaw`SELECT 1`.then(() => "Online").catch(() => "Unavailable"),
      this.db.client.importLog.findFirst({ where: { status: "SUCCESS" }, orderBy: { finishedAt: "desc" }, select: { finishedAt: true, source: { select: { name: true } } } }),
      this.db.client.source.groupBy({ by: ["enabled"], _count: { _all: true } }),
    ]);
    let redis = "Unavailable";
    let queueCounts = { waiting: 0, active: 0, failed: 0, delayed: 0 };
    const queue = createQueue();
    try {
      const counts = await Promise.race([
        queue.getJobCounts("waiting", "active", "failed", "delayed"),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Queue timeout")), 3000)),
      ]);
      queueCounts = { waiting: counts.waiting || 0, active: counts.active || 0, failed: counts.failed || 0, delayed: counts.delayed || 0 };
      redis = "Online";
    } catch { /* Display unavailable without breaking the owner page. */ }
    finally { void queue.close().catch(() => {}); }
    return {
      api: "Online", database, redis, queue: queueCounts,
      lastImport,
      sources: { total: sources.reduce((sum, row) => sum + row._count._all, 0), enabled: sources.find((row) => row.enabled)?._count._all || 0 },
      version: apiVersion,
    };
  }

  @Get("sync")
  async syncSettings() {
    const queue = createQueue({ failFast: true });
    try {
      const [state, currentRun, lastRun] = await Promise.all([
        vacancySyncState(this.db.client, queue),
        this.db.client.syncRun.findFirst({ where: { status: { in: ["QUEUED", "RUNNING"] } }, orderBy: { createdAt: "desc" } }),
        this.db.client.syncRun.findFirst({ where: { status: { notIn: ["QUEUED", "RUNNING"] } }, orderBy: { createdAt: "desc" } }),
      ]);
      return { ...state, currentRun, lastRun };
    } finally {
      await queue.close().catch(() => {});
    }
  }

  @Post("sync/run")
  async runSyncNow() {
    const queue = createQueue({ failFast: true });
    try {
      return await createManualSyncRun(this.db.client, queue);
    } catch (error) {
      if (error instanceof SyncRunAlreadyActiveError)
        throw new ConflictException({ message: error.message, runId: error.runId });
      throw new ServiceUnavailableException(
        error instanceof Error ? error.message : "Could not queue synchronization",
      );
    } finally {
      await queue.close().catch(() => {});
    }
  }

  @Get("sync/runs")
  syncRuns(@Query("page") input: string) {
    const page = z.coerce.number().int().min(1).max(10000).catch(1).parse(input);
    return syncRunHistory(this.db.client, page);
  }

  @Get("sync/runs/:id")
  async syncRun(@Param("id") input: string) {
    const id = z.string().cuid().safeParse(input);
    if (!id.success) throw new BadRequestException("Invalid synchronization run ID");
    const run = await syncRunDetails(this.db.client, id.data);
    if (!run) throw new NotFoundException("Synchronization run not found");
    return run;
  }

  @Patch("sync")
  async saveSyncSettings(@Body() input: unknown) {
    const parsed = vacancySyncUpdateSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException("Invalid synchronization settings");
    try {
      await updateVacancySyncConfig(this.db.client, parsed.data);
    } catch (error) {
      if (error instanceof StaleVacancySyncRevisionError)
        throw new ConflictException({
          message: error.message,
          currentRevision: error.currentRevision,
        });
      throw error;
    }

    const queue = createQueue({ failFast: true });
    try {
      await reconcileVacancySyncScheduler(this.db.client, queue);
      return await vacancySyncState(this.db.client, queue);
    } finally {
      await queue.close().catch(() => {});
    }
  }

  @Get("integrations")
  async getIntegrations() {
    const rows = await this.db.client.integrationSetting.findMany();
    return Object.entries(integrations).map(([provider, config]) => {
      const row = rows.find((item) => item.provider === provider);
      const identifier = row?.identifier || "";
      const enabled = row?.enabled || false;
      return { provider, label: config.label, identifier, enabled, status: integrationStatus(provider as Provider, identifier, enabled) };
    });
  }

  @Patch("integrations/:provider")
  async saveIntegration(@Param("provider") input: string, @Body() body: unknown) {
    if (!(input in integrations)) throw new BadRequestException("Unknown integration");
    const provider = input as Provider;
    const parsed = z.object({ identifier: z.string().trim().max(50), enabled: z.boolean() }).strict().safeParse(body);
    if (!parsed.success) throw new BadRequestException("Invalid settings");
    const { identifier, enabled } = parsed.data;
    if (enabled && !integrations[provider].pattern.test(identifier))
      throw new BadRequestException("Enter a valid ID before enabling this integration");
    return this.db.client.$transaction(async (tx) => {
      const row = await tx.integrationSetting.upsert({ where: { provider }, create: { provider, identifier, enabled }, update: { identifier, enabled } });
      await tx.adminAuditLog.create({ data: { action: "INTEGRATION_CHANGED", entityType: "integration", entityId: provider, details: { enabled, hasIdentifier: Boolean(identifier) } } });
      return { provider, identifier: row.identifier, enabled: row.enabled, status: integrationStatus(provider, row.identifier, row.enabled) };
    });
  }

  @Get("audit-logs")
  async auditLogs(@Query("page") input: string, @Query("entityType") entityType?: string, @Query("entityId") entityId?: string) {
    const page = z.coerce.number().int().min(1).max(10000).catch(1).parse(input);
    const where = entityType && entityId && entityType.length <= 30 && entityId.length <= 100 ? { entityType, entityId } : {};
    const [total, items] = await Promise.all([
      this.db.client.adminAuditLog.count({ where }),
      this.db.client.adminAuditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * 20, take: 20 }),
    ]);
    return { total, items, page, pages: Math.ceil(total / 20) };
  }
}
