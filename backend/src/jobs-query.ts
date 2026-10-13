import { locationWhere } from "./location-query.js";
import { z } from "zod";
import type { Prisma } from "./generated/prisma/client.js";
import { employmentKinds } from "./jobs/classification.js";

export const countryNames: Record<string, string> = {
  germany: "DE", spain: "ES", france: "FR", italy: "IT", poland: "PL",
  austria: "AT", switzerland: "CH", netherlands: "NL", belgium: "BE",
  portugal: "PT", ireland: "IE", sweden: "SE", norway: "NO",
  denmark: "DK", finland: "FI", "united kingdom": "GB", uk: "GB",
  "united states": "US", usa: "US", canada: "CA", australia: "AU",
  brazil: "BR", india: "IN", singapore: "SG", japan: "JP",
};

export const jobsQuerySchema = z
  .object({
    search: z.string().trim().max(150).optional(),
    category: z.string().trim().max(80).optional(),
    company: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(160).optional(),
    companyName: z.string().trim().max(100).optional(),
    place: z.string().trim().max(100).optional(),
    employmentKind: z.enum(employmentKinds).optional(),
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
    sort: z.enum(["relevance", "newest", "oldest", "salary-high", "salary-low"]).optional(),
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
  const parsed = jobsQuerySchema.parse(input);
  const query = { ...parsed, sort: parsed.sort ?? (parsed.search?.trim() ? "relevance" : "newest") };
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
  if (query.place) {
    const countryCode = countryNames[query.place.toLowerCase()];
    AND.push({ OR: [
      { location: { contains: query.place, mode: "insensitive" } },
      { city: { contains: query.place, mode: "insensitive" } },
      { region: { contains: query.place, mode: "insensitive" } },
      { country: { contains: query.place, mode: "insensitive" } },
      ...(countryCode ? [{ country: { equals: countryCode, mode: "insensitive" as const } }] : []),
    ] });
  }
  if (query.companyName) AND.push({ company: { name: { contains: query.companyName, mode: "insensitive" } } });
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
    company: { enabled: true },
    source: { enabled: true },
    AND,
    ...(query.category
      ? { category: { equals: query.category, mode: "insensitive" } }
      : {}),
    ...(query.company ? { company: { slug: query.company, enabled: true } } : {}),
    ...(query.country
      ? { country: { equals: query.country, mode: "insensitive" } }
      : {}),
    ...(query.region
      ? { region: { equals: query.region, mode: "insensitive" } }
      : {}),
    ...(query.remoteType ? { remoteType: query.remoteType } : {}),
    ...(query.employmentKind ? { employmentKind: query.employmentKind } : {}),
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
