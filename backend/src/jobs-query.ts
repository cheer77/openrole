import { locationWhere } from "./location-query.js";
import { z } from "zod";
import type { Prisma } from "./generated/prisma/client.js";

export const jobsQuerySchema = z
  .object({
    search: z.string().trim().max(150).optional(),
    category: z.string().trim().max(80).optional(),
    location: z
      .enum([
        "Worldwide",
        "Europe",
        "EU",
        "Spain",
        "Germany",
        "UK",
        "USA",
        "Other",
      ])
      .optional(),
    country: z.string().trim().min(2).max(80).optional(),
    region: z.string().trim().min(1).max(80).optional(),
    remoteType: z.enum(["REMOTE", "HYBRID", "ON_SITE", "UNKNOWN"]).optional(),
    experience: z.enum(["Junior", "Middle", "Senior", "Lead"]).optional(),
    technologies: z
      .string()
      .max(500)
      .transform((value) => [
        ...new Set(
          value
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
        ),
      ])
      .optional(),
    salaryMin: z.coerce.number().finite().min(0).max(100000000).optional(),
    salaryMax: z.coerce.number().finite().min(0).max(100000000).optional(),
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .optional(),
    posted: z.enum(["1", "3", "7", "30"]).optional(),
    page: z.coerce.number().int().min(1).max(10000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    sort: z
      .enum(["newest", "oldest", "salary-high", "salary-low"])
      .default("newest"),
  })
  .strict()
  .refine(
    (query) =>
      query.salaryMin === undefined ||
      query.salaryMax === undefined ||
      query.salaryMin <= query.salaryMax,
    "salaryMin must not exceed salaryMax",
  );

export function jobsQuery(input: unknown, now = new Date()) {
  const query = jobsQuerySchema.parse(input);
  const salary =
    query.sort.startsWith("salary") ||
    query.salaryMin !== undefined ||
    query.salaryMax !== undefined;
  const currency = query.currency ?? (salary ? "USD" : undefined);
  const AND: Prisma.JobWhereInput[] = [];
  for (const word of query.search?.split(/\s+/).filter(Boolean) ?? []) {
    AND.push({
      OR: [
        { title: { contains: word, mode: "insensitive" } },
        { company: { name: { contains: word, mode: "insensitive" } } },
        { description: { contains: word, mode: "insensitive" } },
      ],
    });
  }
  if (query.location) AND.push(locationWhere(query.location));
  if (query.salaryMin !== undefined)
    AND.push({
      OR: [
        { salaryMax: { gte: query.salaryMin } },
        { salaryMax: null, salaryMin: { gte: query.salaryMin } },
      ],
    });
  if (query.salaryMax !== undefined)
    AND.push({
      OR: [
        { salaryMin: { lte: query.salaryMax } },
        { salaryMin: null, salaryMax: { lte: query.salaryMax } },
      ],
    });
  if (currency)
    AND.push({
      OR: [{ salaryMin: { not: null } }, { salaryMax: { not: null } }],
    });
  const where: Prisma.JobWhereInput = {
    status: "ACTIVE",
    source: { enabled: true },
    AND,
    ...(query.category
      ? { category: { equals: query.category, mode: "insensitive" } }
      : {}),
    ...(query.country
      ? { country: { equals: query.country, mode: "insensitive" } }
      : {}),
    ...(query.region
      ? { region: { equals: query.region, mode: "insensitive" } }
      : {}),
    ...(query.remoteType ? { remoteType: query.remoteType } : {}),
    ...(query.experience ? { experienceLevel: query.experience } : {}),
    ...(query.technologies?.length
      ? { technologies: { hasEvery: query.technologies } }
      : {}),
    ...(currency ? { currency } : {}),
    ...(query.posted
      ? {
          sortDate: {
            gte: new Date(now.getTime() - Number(query.posted) * 86400000),
          },
        }
      : {}),
  };
  const orderBy: Prisma.JobOrderByWithRelationInput[] =
    query.sort === "salary-high"
      ? [
          { salaryMax: { sort: "desc", nulls: "last" } },
          { salaryMin: { sort: "desc", nulls: "last" } },
          { id: "asc" },
        ]
      : query.sort === "salary-low"
        ? [
            { salaryMin: { sort: "asc", nulls: "last" } },
            { salaryMax: { sort: "asc", nulls: "last" } },
            { id: "asc" },
          ]
        : [
            { sortDate: query.sort === "oldest" ? "asc" : "desc" },
            { id: "asc" },
          ];
  return { query, where, orderBy, currency: currency ?? null };
}
