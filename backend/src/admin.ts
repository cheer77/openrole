import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Inject,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  HttpCode,
  ConflictException,
} from "@nestjs/common";
import { z } from "zod";
import { Database } from "./db.js";
import {
  sessionHash,
  internalAccess,
  loginOwner,
  OwnerGuard,
  rateLimit,
} from "./admin-auth.js";
import {
  analyticsReport,
  deviceInfo,
  eventSchema,
  trafficFilterSchema,
  trafficSource,
} from "./analytics.js";
import { recordActivity, recordSessionEvent } from "./session-analytics.js";
import { httpUrl } from "./providers/normalize.js";
import {
  sourceIdentifierSchema,
  importSourceTypes,
  validSourceIdentifier,
} from "./providers/source-config.js";
import { createQueue, enqueueSources } from "./queue.js";
import type { Prisma, Job } from "./generated/prisma/client.js";
import { createSourceForReview, discoveryMetrics } from "./discovery/index.js";
import { normalizedCompanyName, websiteDomain } from "./discovery/detect.js";
function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success)
    throw new BadRequestException(
      parsed.error.issues.map((e) => e.message).join("; "),
    );
  return parsed.data;
}
async function audit(tx: Prisma.TransactionClient, action: string, entityType: string, entityId: string, details?: Record<string, string | boolean>) {
  await tx.adminAuditLog.create({ data: { action, entityType, entityId, details } });
}
const nullableUrl = httpUrl.nullable();
const companySchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    slug: z
      .string()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .max(120),
    website: nullableUrl,
    careerUrl: nullableUrl,
    logoUrl: nullableUrl.default(null),
    country: z.string().max(80).nullable(),
    enabled: z.boolean(),
  })
  .strict();
const sourceSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    type: z.enum(importSourceTypes),
    companyId: z.string().min(1).max(100),
    sourceIdentifier: sourceIdentifierSchema,
    enabled: z.boolean(),
  })
  .strict();
const jobSchema = z
  .object({
    title: z.string().trim().min(1).max(250),
    description: z.string().min(1).max(100000),
    shortDescription: z.string().max(1000),
    category: z.string().min(1).max(80),
    location: z.string().max(5000),
    remoteType: z.enum(["REMOTE", "HYBRID", "ON_SITE", "UNKNOWN"]),
    experienceLevel: z.enum(["Junior", "Middle", "Senior", "Lead"]).nullable(),
    salaryMin: z.number().min(0).max(100000000).nullable(),
    salaryMax: z.number().min(0).max(100000000).nullable(),
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .nullable(),
    technologies: z.array(z.string().min(1).max(50)).max(40),
    applyUrl: httpUrl,
  })
  .strict()
  .refine(
    (v) =>
      v.salaryMin === null ||
      v.salaryMax === null ||
      v.salaryMin <= v.salaryMax,
    "Minimum salary exceeds maximum",
  )
  .refine(
    (v) => (v.salaryMin === null && v.salaryMax === null) || !!v.currency,
    "Salary needs a currency",
  );
@Controller("owner-auth")
export class OwnerAuthController {
  constructor(@Inject(Database) private readonly db: Database) {}
  @Post("login")
  async login(@Headers("x-internal-key") key: string, @Body() input: unknown) {
    internalAccess(key);
    const { password } = parse(
      z.object({ password: z.string().min(1).max(256) }).strict(),
      input,
    );
    return loginOwner(this.db.client, password);
  }
}
@Controller("events")
export class EventsController {
  constructor(@Inject(Database) private readonly db: Database) {}
  @Post()
  @HttpCode(204)
  async event(@Headers("x-internal-key") key: string, @Body() input: unknown) {
    internalAccess(key);
    rateLimit("events-global", 2000, 60000);
    const data = parse(eventSchema, input);
    rateLimit(`events:${data.sessionId}`, 90, 60000);
    if (data.type !== "PAGE_VIEW") {
      const job = data.jobId
        ? await this.db.client.job.findFirst({
            where: {
              id: data.jobId,
              status: "ACTIVE",
              company: { enabled: true },
              source: { enabled: true },
            },
          })
        : null;
      if (!job || data.path !== `/jobs/${job.slug}`)
        throw new BadRequestException("Invalid job");
    } else if (data.jobId) throw new BadRequestException("Unexpected job");
    const { userAgent, referrer, ...event } = data;
    const host =
      referrer && /^[a-z0-9.-]+$/i.test(referrer)
        ? referrer.toLowerCase()
        : undefined;
    const device = deviceInfo(userAgent);
    const created = await this.db.client.analyticsEvent.createMany({
      data: [
        {
          ...event,
          referrer: host,
          ...device,
          trafficSource: trafficSource(data.utmSource, host),
        },
      ],
      skipDuplicates: true,
    });
    if (created.count) await recordSessionEvent(this.db.client, { ...data, device: device.device, referrer: host });
  }
  @Post("activity")
  @HttpCode(204)
  async activity(@Headers("x-internal-key") key: string, @Body() input: unknown) {
    internalAccess(key);
    rateLimit("activity-global", 3000, 60000);
    const data = parse(z.object({ sessionId: z.string().uuid(), visitorId: z.string().uuid(), kind: z.enum(["HEARTBEAT", "SEARCH", "FILTER"]), seconds: z.number().int().min(0).max(60).optional() }).strict(), input);
    rateLimit(`activity:${data.sessionId}`, 30, 60000);
    await recordActivity(this.db.client, data);
  }
}
@Controller("admin")
@UseGuards(OwnerGuard)
export class AdminController {
  constructor(@Inject(Database) private readonly db: Database) {}
  @Get("session") session() {
    return { owner: true };
  }
  @Post("logout") async logout(@Headers("authorization") auth: string) {
    await this.db.client.adminSession.deleteMany({
      where: { tokenHash: sessionHash(auth.replace(/^Bearer /, "")) },
    });
    return { ok: true };
  }
  @Get("dashboard") dashboard(@Query("range") input: string, @Query("traffic") traffic: string) {
    const range = parse(
      z.enum(["today", "yesterday", "7", "30", "90"]).default("7"),
      input,
    );
    return analyticsReport(this.db.client, range, new Date(), parse(trafficFilterSchema, traffic));
  }
  @Get("jobs") async jobs(@Query() input: unknown) {
    const q = parse(
      z
        .object({
          search: z.string().max(150).default(""),
          entity: z.string().max(100).optional(),
          status: z.enum(["ACTIVE", "CLOSED", "HIDDEN"]).optional(),
          page: z.coerce.number().int().min(1).max(10000).default(1),
        })
        .strict(),
      input,
    );
    const where: Prisma.JobWhereInput = {
      ...(q.entity ? { id: q.entity } : {}),
      ...(q.status ? { status: q.status } : {}),
      ...(q.search
        ? {
            OR: [
              { title: { contains: q.search, mode: "insensitive" } },
              {
                company: { name: { contains: q.search, mode: "insensitive" } },
              },
            ],
          }
        : {}),
    };
    const [total, items] = await this.db.client.$transaction([
      this.db.client.job.count({ where }),
      this.db.client.job.findMany({
        where,
        include: { company: true, source: true },
        orderBy: [{ firstSeenAt: "desc" }, { id: "asc" }],
        take: 20,
        skip: (q.page - 1) * 20,
      }),
    ]);
    return { total, items, page: q.page, pages: Math.ceil(total / 20) };
  }
  @Patch("jobs/:id") async editJob(
    @Param("id") id: string,
    @Body() input: unknown,
  ) {
    const data = parse(jobSchema, input);
    return this.withJob(id, async (tx) => {
      const job = await tx.job.update({ where: { id }, data: { ...data, descriptionHtml: null, manualOverride: true } });
      await audit(tx, "JOB_EDITED", "job", id);
      return job;
    });
  }
  @Patch("jobs/:id/status") async status(
    @Param("id") id: string,
    @Body() input: unknown,
  ) {
    const data = parse(
      z.object({ status: z.enum(["ACTIVE", "CLOSED", "HIDDEN"]) }).strict(),
      input,
    );
    return this.withJob(id, async (tx) => {
      const job = await tx.job.update({
        where: { id },
        data: {
          ...data,
          statusOverride: data.status !== "ACTIVE",
          closedAt: data.status === "CLOSED" ? new Date() : null,
          ...(data.status === "ACTIVE" ? { missingCount: 0, missingSince: null } : {}),
        },
      });
      await audit(tx, "JOB_STATUS_CHANGED", "job", id, { status: data.status });
      return job;
    });
  }
  @Post("jobs/:id/reset") async reset(@Param("id") id: string) {
    return this.withJob(id, async (tx) => {
      const job = await tx.job.update({
        where: { id },
        data: { manualOverride: false, statusOverride: false },
      });
      await audit(tx, "JOB_OVERRIDES_RESET", "job", id);
      return job;
    });
  }
  @Delete("jobs/:id") async deleteJob(@Param("id") id: string) {
    return this.withJob(id, async (tx, job) => {
      await tx.deletedJob.upsert({
        where: {
          sourceId_externalId: {
            sourceId: job.sourceId,
            externalId: job.externalId,
          },
        },
        create: { sourceId: job.sourceId, externalId: job.externalId },
        update: {},
      });
      await tx.job.delete({ where: { id } });
      await audit(tx, "JOB_DELETED", "job", id);
      return { ok: true };
    });
  }
  private async withJob<T>(
    id: string,
    mutate: (tx: Prisma.TransactionClient, job: Job) => Promise<T>,
  ) {
    const initial = await this.db.client.job.findUnique({
      where: { id },
      select: { sourceId: true },
    });
    if (!initial) throw new NotFoundException();
    return this.db.client.$transaction(async (tx) => {
      const locks = await tx.$queryRaw<
        { locked: boolean }[]
      >`SELECT pg_try_advisory_xact_lock(hashtext(${initial.sourceId})) AS locked`;
      if (!locks[0]?.locked)
        throw new ConflictException(
          "This source is importing. Please retry after the import finishes.",
        );
      const job = await tx.job.findUnique({ where: { id } });
      if (!job) throw new NotFoundException();
      return mutate(tx, job);
    });
  }
  @Get("companies") async companies(@Query() input: unknown) {
    const q = parse(
      z
        .object({
          page: z.coerce.number().int().min(1).max(10000).default(1),
          search: z.string().max(150).default(""),
          entity: z.string().max(100).optional(),
        })
        .strict(),
      input,
    );
    const where = {
      ...(q.entity ? { id: q.entity } : {}),
      name: { contains: q.search, mode: "insensitive" as const },
    };
    const [total, items] = await this.db.client.$transaction([
      this.db.client.company.count({ where }),
      this.db.client.company.findMany({
        where,
        include: { _count: { select: { jobs: true, sources: true } } },
        orderBy: [{ name: "asc" }, { id: "asc" }],
        take: 20,
        skip: (q.page - 1) * 20,
      }),
    ]);
    return { total, items, page: q.page, pages: Math.ceil(total / 20) };
  }
  @Post("companies") async addCompany(@Body() input: unknown) {
    const data = parse(companySchema, input);
    if (await this.db.client.company.findUnique({ where: { slug: data.slug } }))
      throw new ConflictException("Company slug already exists");
    return this.db.client.$transaction(async (tx) => {
      const company = await tx.company.create({ data: {
        ...data, websiteDomain: data.website ? websiteDomain(data.website) : null,
        normalizedName: normalizedCompanyName(data.name),
        discoveredFrom: "admin", discoveredAt: new Date(),
        discoveryStatus: data.website || data.careerUrl ? "PENDING" : "REVIEW",
      } });
      await audit(tx, "COMPANY_CREATED", "company", company.id);
      return company;
    });
  }
  @Patch("companies/:id") async editCompany(
    @Param("id") id: string,
    @Body() input: unknown,
  ) {
    const data = parse(companySchema, input);
    if (!(await this.db.client.company.findUnique({ where: { id } })))
      throw new NotFoundException();
    if (
      await this.db.client.company.findFirst({
        where: { slug: data.slug, id: { not: id } },
      })
    )
      throw new ConflictException("Company slug already exists");
    return this.db.client.$transaction(async (tx) => {
      const prior = await tx.company.findUniqueOrThrow({ where: { id }, include: { _count: { select: { sources: true } } } });
      const changedSite = prior.website !== data.website || prior.careerUrl !== data.careerUrl;
      const company = await tx.company.update({ where: { id }, data: {
        ...data, websiteDomain: data.website ? websiteDomain(data.website) : null,
        ...(data.name ? { normalizedName: normalizedCompanyName(data.name) } : {}),
        ...(changedSite && !prior._count.sources ? {
          discoveryStatus: "PENDING", discoveryAttempts: 0, nextRetryAt: null,
          detectedAts: null, detectedIdentifier: null, discoveryConfidence: null,
          validationStatus: null, discoveryError: null,
        } : {}),
      } });
      await audit(tx, "COMPANY_EDITED", "company", id, { enabled: data.enabled });
      return company;
    });
  }
  @Get("sources") async sources(@Query() input: unknown) {
    const q = parse(
      z
        .object({
          page: z.coerce.number().int().min(1).max(10000).default(1),
          search: z.string().max(150).default(""),
          entity: z.string().max(100).optional(),
        })
        .strict(),
      input,
    );
    const where = {
      ...(q.entity ? { id: q.entity } : {}),
      name: { contains: q.search, mode: "insensitive" as const },
    };
    const [total, items] = await this.db.client.$transaction([
      this.db.client.source.count({ where }),
      this.db.client.source.findMany({
        where,
        include: { company: true, _count: { select: { jobs: true } } },
        orderBy: [{ name: "asc" }, { id: "asc" }],
        take: 20,
        skip: (q.page - 1) * 20,
      }),
    ]);
    return { total, items, page: q.page, pages: Math.ceil(total / 20) };
  }
  @Post("sources") async addSource(@Body() input: unknown) {
    const data = parse(sourceSchema, input);
    await this.validateSource(data);
    return this.db.client.$transaction(async (tx) => {
      const source = await tx.source.create({ data });
      await tx.company.update({ where: { id: data.companyId }, data: {
        discoveryStatus: "KNOWN", discoverySourceId: source.id,
        validationStatus: data.enabled ? "EXISTING" : "NOT_TESTED",
      } });
      await audit(tx, "SOURCE_CREATED", "source", source.id, { enabled: data.enabled });
      return source;
    });
  }
  @Patch("sources/:id") async editSource(
    @Param("id") id: string,
    @Body() input: unknown,
  ) {
    const data = parse(sourceSchema, input);
    const old = await this.db.client.source.findUnique({ where: { id } });
    if (!old) throw new NotFoundException();
    if (
      old.type !== data.type ||
      old.sourceIdentifier !== data.sourceIdentifier ||
      old.companyId !== data.companyId
    )
      throw new BadRequestException(
        "Create a new source to change its board or company; existing jobs keep their provenance",
      );
    await this.validateSource(data, id);
    return this.db.client.$transaction(async (tx) => {
      const source = await tx.source.update({ where: { id }, data });
      await audit(tx, old.enabled === data.enabled ? "SOURCE_EDITED" : "SOURCE_STATUS_CHANGED", "source", id, { enabled: data.enabled });
      return source;
    });
  }
  private async validateSource(
    data: z.infer<typeof sourceSchema>,
    id?: string,
  ) {
    if (
      !(await this.db.client.company.findUnique({
        where: { id: data.companyId },
      }))
    )
      throw new BadRequestException("Company not found");
    if (!validSourceIdentifier(data))
      throw new BadRequestException(
        "Invalid provider identifier (USAJOBS: public; CANADA_JOB_BANK: official-en; ARBEITNOW: all; Lever EU: eu:slug; Personio DE: de:slug)",
      );
    if (
      await this.db.client.source.findFirst({
        where: {
          type: data.type,
          sourceIdentifier: data.sourceIdentifier,
          ...(id ? { id: { not: id } } : {}),
        },
      })
    )
      throw new ConflictException("Source already exists");
  }
  @Post("sources/:id/sync") async sync(@Param("id") id: string) {
    rateLimit("manual-sync", 20, 60000);
    const source = await this.db.client.source.findFirst({
      where: {
        id,
        enabled: true,
        company: { enabled: true },
        type: { not: "MANUAL" },
      },
    });
    if (!source)
      throw new BadRequestException(
        "Enable the company and import source first",
      );
    const queue = createQueue();
    try {
      await enqueueSources(queue, this.db.client, id);
      await this.db.client.adminAuditLog.create({ data: { action: "SOURCE_SYNC_QUEUED", entityType: "source", entityId: id } });
      return { queued: true };
    } finally {
      await queue.close();
    }
  }
  @Post("sources/:id/test") async testSource(@Param("id") id: string) {
    rateLimit("source-test", 20, 60000);
    const source = await this.db.client.source.findUnique({ where: { id } });
    if (!source) throw new NotFoundException();
    if (source.type !== "USAJOBS") throw new BadRequestException("Connection test is available for USAJOBS");
    const queue = createQueue();
    try {
      await queue.add("test", { sourceId: id }, { deduplication: { id: `test:${id}` } });
      await this.db.client.adminAuditLog.create({ data: { action: "SOURCE_TEST_QUEUED", entityType: "source", entityId: id } });
      return { queued: true };
    } finally {
      await queue.close();
    }
  }
  @Get("logs") async logs(@Query() input: unknown) {
    const q = parse(
      z
        .object({
          page: z.coerce.number().int().min(1).max(10000).default(1),
          search: z.string().max(150).default(""),
        })
        .strict(),
      input,
    );
    const where = {
      source: { name: { contains: q.search, mode: "insensitive" as const } },
    };
    const [total, items] = await this.db.client.$transaction([
      this.db.client.importLog.count({ where }),
      this.db.client.importLog.findMany({
        where,
        include: { source: { select: { name: true } } },
        orderBy: { startedAt: "desc" },
        take: 20,
        skip: (q.page - 1) * 20,
      }),
    ]);
    return { total, items, page: q.page, pages: Math.ceil(total / 20) };
  }
  @Get("discovery") async discovery(@Query() input: unknown) {
    const q = parse(z.object({
      page: z.coerce.number().int().min(1).max(10000).default(1),
      status: z.enum(["PENDING", "SCANNING", "REVIEW", "ENABLED", "KNOWN", "FAILED", "REJECTED", "IGNORED"]).optional(),
      search: z.string().max(150).default(""),
    }).strict(), input);
    const where: Prisma.CompanyWhereInput = {
      discoveredAt: { not: null },
      ...(q.status ? { discoveryStatus: q.status } : {}),
      ...(q.search ? { name: { contains: q.search, mode: "insensitive" } } : {}),
    };
    const [total, companies, metrics] = await Promise.all([
      this.db.client.company.count({ where }),
      this.db.client.company.findMany({ where, orderBy: [{ discoveredAt: "desc" }, { id: "asc" }],
        take: 20, skip: (q.page - 1) * 20,
        include: { _count: { select: { jobs: true, sources: true } } },
      }),
      discoveryMetrics(this.db.client),
    ]);
    const ids = companies.map((item) => item.discoverySourceId).filter((id): id is string => !!id);
    const counts = ids.length ? await this.db.client.job.groupBy({ by: ["sourceId"],
      where: { sourceId: { in: ids } }, _count: { _all: true },
    }) : [];
    const bySource = new Map(counts.map((item) => [item.sourceId, item._count._all]));
    return { metrics, total, page: q.page, pages: Math.ceil(total / 20),
      items: companies.map((item) => ({ ...item, jobsImported: bySource.get(item.discoverySourceId ?? "") ?? 0 })),
    };
  }
  @Post("discovery/:id/:action") async discoveryAction(
    @Param("id") id: string, @Param("action") actionInput: string,
  ) {
    rateLimit("discovery-action", 30, 60000);
    const action = parse(z.enum(["approve", "reject", "retry", "create-source", "ignore"]), actionInput);
    const company = await this.db.client.company.findUnique({ where: { id } });
    if (!company) throw new NotFoundException();
    if (action === "create-source") {
      try {
        const source = await createSourceForReview(this.db.client, id);
        await this.db.client.adminAuditLog.create({ data: { action: "DISCOVERY_SOURCE_CREATED", entityType: "company", entityId: id } });
        return { sourceId: source.id };
      } catch (error) { throw new BadRequestException(error instanceof Error ? error.message : "Could not create source"); }
    }
    if (action === "reject" || action === "ignore") {
      if (["ENABLED", "KNOWN"].includes(company.discoveryStatus))
        throw new BadRequestException("Active sources must be managed in Sources");
      await this.db.client.company.update({ where: { id }, data: {
        discoveryStatus: action === "reject" ? "REJECTED" : "IGNORED", nextRetryAt: null,
      } });
    } else {
      if (action === "approve" && !["REVIEW", "FAILED", "PENDING"].includes(company.discoveryStatus))
        throw new BadRequestException("Only pending or review items can be approved");
      if (action === "retry") await this.db.client.company.update({ where: { id }, data: {
        discoveryStatus: "PENDING", discoveryAttempts: 0, nextRetryAt: null,
      } });
      const queue = createQueue();
      try { await queue.add("company-discovery", { companyId: id, force: action === "approve" },
        { deduplication: { id: `discovery:${id}` } }); }
      finally { await queue.close(); }
    }
    await this.db.client.adminAuditLog.create({ data: {
      action: `DISCOVERY_${action.toUpperCase().replaceAll("-", "_")}`,
      entityType: "company", entityId: id,
    } });
    return { ok: true };
  }
}
