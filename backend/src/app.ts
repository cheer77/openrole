import "reflect-metadata";
import {
  AdminController,
  OwnerAuthController,
  EventsController,
} from "./admin.js";
import { OwnerGuard } from "./admin-auth.js";
import {
  BadRequestException,
  Controller,
  Get,
  Head,
  Inject,
  GoneException,
  Module,
  NotFoundException,
  Param,
  Query,
  ServiceUnavailableException,
} from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { ZodError, z } from "zod";
import { Database } from "./db.js";
import { jobsQuery } from "./jobs-query.js";
import { config } from "./config.js";
import { SeoController } from "./seo.js";

@Controller()
class ApiController {
  constructor(@Inject(Database) private readonly database: Database) {}

  @Get("health")
  async health() {
    try {
      await this.database.client.$queryRaw`SELECT 1`;
      return { status: "ok" };
    } catch {
      throw new ServiceUnavailableException("Database unavailable");
    }
  }

  @Get("jobs")
  async jobs(@Query() input: Record<string, unknown>) {
    let filters;
    try {
      filters = jobsQuery(input);
    } catch (error) {
      if (error instanceof ZodError)
        throw new BadRequestException({
          message: "Invalid query",
          errors: error.issues.map(({ path, message }) => ({
            field: path.join("."),
            message,
          })),
        });
      throw error;
    }
    const { query, where, orderBy, currency } = filters;
    const [total, items] = await this.database.client.$transaction(
      [
        this.database.client.job.count({ where }),
        this.database.client.job.findMany({
          where,
          orderBy,
          skip: (query.page - 1) * query.limit,
          take: query.limit,
          omit: { description: true, descriptionHtml: true, missingSince: true },
          include: { company: true },
        }),
      ],
      { isolationLevel: "RepeatableRead" },
    );
    return {
      items,
      total,
      page: query.page,
      limit: query.limit,
      pages: Math.ceil(total / query.limit),
      currency,
    };
  }

  @Head("jobs/:slug")
  async jobHead(@Param("slug") slug: string) {
    if (slug.length > 220) throw new BadRequestException("Invalid slug");
    const job = await this.database.client.job.findUnique({
      where: { slug },
      select: { status: true, company: { select: { enabled: true } }, source: { select: { enabled: true } } },
    });
    if (job) {
      if (job.status === "CLOSED" || (job.status === "ACTIVE" && job.company.enabled && job.source.enabled)) return;
      throw new NotFoundException("Job not found");
    }
    if (await this.database.client.expiredJob.findFirst({ where: { slug }, select: { id: true } }))
      throw new GoneException("Job no longer available");
    throw new NotFoundException("Job not found");
  }

  @Get("jobs/:slug")
  async job(@Param("slug") slug: string) {
    if (slug.length > 220) throw new BadRequestException("Invalid slug");
    const job = await this.database.client.job.findFirst({
      where: {
        slug,
        OR: [
          { status: "ACTIVE", company: { enabled: true }, source: { enabled: true } },
          { status: "CLOSED" },
        ],
      },
      omit: { missingSince: true },
      include: { company: true },
    });
    if (!job) {
      const existing = await this.database.client.job.findUnique({ where: { slug }, select: { id: true } });
      if (existing) throw new NotFoundException("Job not found");
      const expired = await this.database.client.expiredJob.findFirst({ where: { slug } });
      if (expired) throw new GoneException("Job no longer available");
      throw new NotFoundException("Job not found");
    }
    return job;
  }

  @Get("jobs/:slug/similar")
  async similarJobs(@Param("slug") slug: string) {
    if (slug.length > 220) throw new BadRequestException("Invalid slug");
    const job = await this.database.client.job.findFirst({
      where: { slug, status: { in: ["ACTIVE", "CLOSED"] } },
      select: {
        id: true, category: true, technologies: true, country: true,
        remoteType: true, experienceLevel: true, companyId: true,
      },
    });
    if (!job) throw new NotFoundException("Job not found");
    const candidates = await this.database.client.job.findMany({
      where: {
        id: { not: job.id },
        status: "ACTIVE",
        company: { enabled: true },
        source: { enabled: true },
        OR: [
          { category: job.category },
          { companyId: job.companyId },
          ...(job.technologies.length ? [{ technologies: { hasSome: job.technologies } }] : []),
        ],
      },
      orderBy: [{ sortDate: "desc" }, { id: "asc" }],
      take: 80,
      omit: { description: true, descriptionHtml: true, missingSince: true },
      include: { company: true },
    });
    const technologySet = new Set(job.technologies);
    return candidates
      .map((candidate) => ({
        candidate,
        score:
          (candidate.category === job.category ? 8 : 0) +
          (candidate.companyId === job.companyId ? 3 : 0) +
          candidate.technologies.filter((tech) => technologySet.has(tech)).length * 3 +
          (job.country && candidate.country === job.country ? 2 : 0) +
          (candidate.remoteType === job.remoteType ? 1 : 0) +
          (job.experienceLevel && candidate.experienceLevel === job.experienceLevel ? 1 : 0),
      }))
      .sort((a, b) => b.score - a.score || b.candidate.sortDate.getTime() - a.candidate.sortDate.getTime() || a.candidate.id.localeCompare(b.candidate.id))
      .slice(0, 6)
      .map(({ candidate }) => candidate);
  }

  @Get("companies")
  async companies(@Query() input: Record<string, unknown>) {
    const parsed = z
      .object({
        page: z.coerce.number().int().min(1).max(10000).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
        search: z.string().trim().max(150).optional(),
      })
      .strict()
      .safeParse(input);
    if (!parsed.success) throw new BadRequestException("Invalid company query");
    const { page, limit, search } = parsed.data;
    const where = {
      enabled: true,
      sources: { some: { enabled: true } },
      ...(search
        ? { name: { contains: search, mode: "insensitive" as const } }
        : {}),
    };
    const [total, items] = await this.database.client.$transaction(
      [
        this.database.client.company.count({ where }),
        this.database.client.company.findMany({
          where,
          orderBy: [{ name: "asc" }, { id: "asc" }],
          skip: (page - 1) * limit,
          take: limit,
          include: {
            _count: {
              select: {
                jobs: {
                  where: {
                    status: "ACTIVE",
                    company: { enabled: true },
                    source: { enabled: true },
                  },
                },
              },
            },
          },
        }),
      ],
      { isolationLevel: "RepeatableRead" },
    );
    return { items, total, page, limit, pages: Math.ceil(total / limit) };
  }

  @Get("companies/:slug")
  async company(@Param("slug") slug: string) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new BadRequestException("Invalid slug");
    const company = await this.database.client.company.findFirst({ where: { slug, enabled: true } });
    if (!company) throw new NotFoundException("Company not found");
    const where = { companyId: company.id, status: "ACTIVE" as const, source: { enabled: true } };
    const [activeJobs, categories] = await Promise.all([
      this.database.client.job.count({ where }),
      this.database.client.job.groupBy({ by: ["category"], where, _count: { _all: true }, orderBy: { category: "asc" } }),
    ]);
    return { ...company, activeJobs, categories: categories.map((item) => ({ name: item.category, count: item._count._all })) };
  }
}

@Module({
  controllers: [
    ApiController,
    SeoController,
    AdminController,
    OwnerAuthController,
    EventsController,
  ],
  providers: [Database, OwnerGuard],
})
class AppModule {}

export async function createApp() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: config.CORS_ORIGINS.split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
    methods: ["GET", "HEAD"],
  });
  app.enableShutdownHooks();
  return app;
}
