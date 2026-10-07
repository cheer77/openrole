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
  Inject,
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
          omit: { description: true, missingSince: true },
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

  @Get("jobs/:slug")
  async job(@Param("slug") slug: string) {
    if (slug.length > 220) throw new BadRequestException("Invalid slug");
    const job = await this.database.client.job.findFirst({
      where: {
        slug,
        status: "ACTIVE",
        company: { enabled: true },
        source: { enabled: true },
      },
      omit: { missingSince: true },
      include: { company: true },
    });
    if (!job) throw new NotFoundException("Job not found");
    return job;
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
}

@Module({
  controllers: [
    ApiController,
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
