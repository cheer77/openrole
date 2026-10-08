import { convert } from "html-to-text";
import { decodeHTML } from "entities";
import { z } from "zod";

export const httpUrl = z
  .string()
  .url()
  .refine((value) => {
    const url = new URL(value);
    return (
      ["https:", "http:"].includes(url.protocol) &&
      !url.username &&
      !url.password
    );
  }, "Expected an HTTP(S) URL without credentials");

export const normalizedJobSchema = z
  .object({
    externalId: z.string().min(1).max(500),
    title: z.string().min(1).max(500),
    description: z.string().min(1).max(200000),
    shortDescription: z.string().max(300),
    category: z.string(),
    location: z.string().max(5000),
    city: z.string().nullable(),
    country: z.string().nullable(),
    region: z.string().nullable(),
    remoteType: z.enum(["REMOTE", "HYBRID", "ON_SITE", "UNKNOWN"]),
    employmentType: z.string().nullable(),
    experienceLevel: z.string().nullable(),
    salaryMin: z.number().finite().nonnegative().nullable(),
    salaryMax: z.number().finite().nonnegative().nullable(),
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .nullable(),
    technologies: z.array(z.string()),
    sourceUrl: httpUrl,
    applyUrl: httpUrl,
    publishedAt: z.date().nullable(),
  })
  .refine(
    (job) =>
      job.salaryMin === null ||
      job.salaryMax === null ||
      job.salaryMin <= job.salaryMax,
    "Invalid salary range",
  );
export type NormalizedJob = z.infer<typeof normalizedJobSchema>;
export type RawJob = {
  externalId: string;
  title: string;
  description: string;
  location?: string;
  sourceUrl: string;
  applyUrl: string;
  publishedAt?: string | number | null;
  workplace?: string;
  employmentType?: string | null;
  city?: string | null;
  country?: string | null;
  region?: string | null;
  salary?: {
    min?: number | null;
    max?: number | null;
    currency?: string | null;
    interval?: string | null;
  };
};

export function plainText(value: string) {
  return convert(decodeHTML(value), {
    wordwrap: false,
    selectors: [
      { selector: "a", options: { ignoreHref: true } },
      { selector: "img", format: "skip" },
    ],
  }).trim();
}

const categoryRules: [RegExp, string][] = [
  [/full.?stack/i, "Full Stack"],
  [/front.?end/i, "Frontend"],
  [/back.?end/i, "Backend"],
  [/android|ios\b|mobile/i, "Mobile"],
  [/devops|site reliability|platform engineer/i, "DevOps"],
  [/\bqa\b|quality assurance|test engineer/i, "QA"],
  [/design/i, "Design"],
  [/product manager/i, "Product"],
  [/project manager/i, "Project Management"],
  [/machine learning|\bai\b/i, "AI / ML"],
  [/\bdata\b/i, "Data"],
  [/marketing/i, "Marketing"],
  [/sales/i, "Sales"],
];
const technologies = [
  "React",
  "Next.js",
  "TypeScript",
  "JavaScript",
  "Node.js",
  "NestJS",
  "Vue",
  "Angular",
  "Python",
  "Java",
  "C#",
  "Go",
  "AWS",
  "Docker",
  "Kubernetes",
];

export function normalize(raw: RawJob): NormalizedJob {
  const title = plainText(raw.title).replace(/\s+/g, " ");
  const description = plainText(raw.description);
  const text = `${title} ${description}`;
  const explicitLocationWorkplace = /\bhybrid\b/i.test(raw.location ?? "")
    ? "hybrid"
    : /\bremote\b/i.test(raw.location ?? "")
      ? "remote"
      : undefined;
  const workplace = (raw.workplace ?? explicitLocationWorkplace)
    ?.toLowerCase()
    .replace(/[^a-z]/g, "");
  const remoteType =
    workplace === "remote"
      ? "REMOTE"
      : workplace === "hybrid"
        ? "HYBRID"
        : ["onsite", "office"].includes(workplace ?? "")
          ? "ON_SITE"
          : "UNKNOWN";
  const annual = /^(year|yearly|annual|per-year|1 YEAR)$/i.test(
    raw.salary?.interval ?? "",
  );
  const currency =
    annual && raw.salary?.currency ? raw.salary.currency.toUpperCase() : null;
  const publishedAt =
    raw.publishedAt === undefined || raw.publishedAt === null
      ? null
      : new Date(raw.publishedAt);
  const countryMap: Record<string, string> = {
    USA: "US",
    "United States": "US",
    "United Kingdom": "GB",
    UK: "GB",
    Spain: "ES",
    Germany: "DE",
    France: "FR",
  };
  return normalizedJobSchema.parse({
    externalId: raw.externalId,
    title,
    description,
    shortDescription: description.replace(/\s+/g, " ").slice(0, 300),
    category: categoryRules.find(([rule]) => rule.test(title))?.[1] ?? "Other",
    location: raw.location?.trim() || "Not specified",
    city: raw.city || null,
    country: raw.country ? (countryMap[raw.country] ?? raw.country) : null,
    region: raw.region || null,
    remoteType,
    employmentType: raw.employmentType || null,
    experienceLevel: /\b(lead|principal|staff)\b/i.test(title)
      ? "Lead"
      : /\bsenior\b/i.test(title)
        ? "Senior"
        : /\b(junior|intern|entry.level)\b/i.test(title)
          ? "Junior"
          : null,
    salaryMin: currency ? (raw.salary?.min ?? null) : null,
    salaryMax: currency ? (raw.salary?.max ?? null) : null,
    currency,
    technologies: technologies.filter((technology) =>
      new RegExp(
        `(?<![a-z0-9])${technology.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![a-z0-9])`,
        "i",
      ).test(text),
    ),
    sourceUrl: raw.sourceUrl,
    applyUrl: raw.applyUrl,
    publishedAt,
  });
}
