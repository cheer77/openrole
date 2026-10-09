import { BadRequestException, Controller, Get, Inject, Query } from "@nestjs/common";
import { z } from "zod";
import { Database } from "./db.js";

const pageQuery = z.object({
  offset: z.coerce.number().int().min(0).max(10_000_000),
  limit: z.coerce.number().int().min(1).max(5000),
}).strict();

@Controller("seo")
export class SeoController {
  constructor(@Inject(Database) private readonly database: Database) {}

  @Get("summary")
  async summary() {
    const db = this.database.client;
    const where = {
      status: "ACTIVE" as const,
      company: { enabled: true },
      source: { enabled: true },
    };
    const [jobs, companies, categories, countries, technologies, remote] = await Promise.all([
      db.job.count({ where }),
      db.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*)::bigint AS count FROM (
          SELECT j."companyId" FROM "Job" j
          JOIN "Company" c ON c.id = j."companyId"
          JOIN "Source" s ON s.id = j."sourceId"
          WHERE j.status = 'ACTIVE' AND c.enabled AND s.enabled
          GROUP BY j."companyId" HAVING COUNT(*) >= 5
        ) eligible`,
      db.job.groupBy({ by: ["category"], where, _count: { _all: true } }),
      db.job.groupBy({ by: ["country"], where, _count: { _all: true } }),
      db.$queryRaw<{ name: string; count: bigint }[]>`
        SELECT technology AS name, COUNT(*)::bigint AS count
        FROM "Job" j JOIN "Company" c ON c.id = j."companyId"
        JOIN "Source" s ON s.id = j."sourceId"
        CROSS JOIN LATERAL unnest(j.technologies) technology
        WHERE j.status = 'ACTIVE' AND c.enabled AND s.enabled
        GROUP BY technology`,
      db.job.count({ where: { ...where, remoteType: "REMOTE" } }),
    ]);
    return {
      jobs,
      companies: Number(companies[0]?.count ?? 0),
      remote,
      categories: categories.map((item) => ({ name: item.category, count: item._count._all })),
      countries: countries.filter((item) => item.country).map((item) => ({ name: item.country!, count: item._count._all })),
      technologies: technologies.map((item) => ({ name: item.name, count: Number(item.count) })),
    };
  }

  @Get("jobs")
  async jobs(@Query() input: unknown) {
    const parsed = pageQuery.safeParse(input);
    if (!parsed.success) throw new BadRequestException("Invalid sitemap page");
    return this.database.client.job.findMany({
      where: { status: "ACTIVE", company: { enabled: true }, source: { enabled: true } },
      select: { slug: true, updatedAt: true },
      orderBy: { id: "asc" },
      skip: parsed.data.offset,
      take: parsed.data.limit,
    });
  }

  @Get("companies")
  async companies(@Query() input: unknown) {
    const parsed = pageQuery.safeParse(input);
    if (!parsed.success) throw new BadRequestException("Invalid sitemap page");
    const { offset, limit } = parsed.data;
    return this.database.client.$queryRaw<{ slug: string; updatedAt: Date }[]>`
      SELECT c.slug, MAX(j."updatedAt") AS "updatedAt"
      FROM "Company" c JOIN "Job" j ON j."companyId" = c.id
      JOIN "Source" s ON s.id = j."sourceId"
      WHERE c.enabled AND s.enabled AND j.status = 'ACTIVE'
      GROUP BY c.id HAVING COUNT(*) >= 5
      ORDER BY c.slug LIMIT ${limit} OFFSET ${offset}`;
  }
}
