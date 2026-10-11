import { convert } from "html-to-text";
import { decodeHTML } from "entities";
import { z } from "zod";
import { classifyEmploymentType, classifyExperienceLevel, classifyJob } from "../jobs/classification.js";

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
    descriptionHtml: z.string().max(200000).nullable().default(null),
    shortDescription: z.string().max(300),
    category: z.string(),
    location: z.string().max(5000),
    city: z.string().nullable(),
    country: z.string().nullable(),
    region: z.string().nullable(),
    remoteType: z.enum(["REMOTE", "HYBRID", "ON_SITE", "UNKNOWN"]),
    employmentType: z.string().nullable(),
    employmentKind: z.string().nullable(),
    experienceLevel: z.string().nullable(),
    salaryMin: z.number().finite().nonnegative().nullable(),
    salaryMax: z.number().finite().nonnegative().nullable(),
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .nullable(),
    technologies: z.array(z.string()),
    sourceCategories: z.array(z.string()),
    sourceUrl: httpUrl,
    applyUrl: httpUrl,
    publishedAt: z.date().nullable(),
    sourceUpdatedAt: z.date().nullable(),
    companyName: z.string().min(1).max(120).nullable(),
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
  descriptionHtml?: string;
  location?: string;
  sourceUrl: string;
  applyUrl: string;
  publishedAt?: string | number | Date | null;
  sourceUpdatedAt?: string | number | Date | null;
  companyName?: string | null;
  sourceCategories?: string[];
  technologies?: string[];
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
  return convert(decodeMarkup(value), {
    wordwrap: false,
    selectors: [
      { selector: "a", options: { ignoreHref: true } },
      { selector: "img", format: "skip" },
    ],
  }).trim();
}

function decodeMarkup(value: string) {
  let decoded = value;
  // Greenhouse and some XML boards encode HTML entities more than once.
  // Decode only while recognizable tags are still escaped. This also handles
  // fragments that mix real and escaped markup without rewriting normal HTML.
  const escapedTag = /&(?:amp;)*lt;\s*\/?\s*(?:h[1-6]|p|div|span|ul|ol|li|strong|b|em|i|br|a|blockquote)\b/i;
  for (let pass = 0; pass < 3; pass++) {
    if (!escapedTag.test(decoded)) break;
    const next = decodeHTML(decoded);
    if (next === decoded) break;
    decoded = next;
  }
  return decoded;
}

const locationCountries: Record<string, string> = {
  germany: "DE", deutschland: "DE", spain: "ES", españa: "ES",
  france: "FR", italy: "IT", poland: "PL", netherlands: "NL",
  belgium: "BE", austria: "AT", switzerland: "CH",
  "united kingdom": "GB", uk: "GB", "united states": "US", usa: "US",
  canada: "CA", australia: "AU",
  // Distinct administrative regions provide evidence when the source omits
  // the country, as in "Magdeburg, Saxony-Anhalt".
  "saxony-anhalt": "DE", bavaria: "DE", "baden-württemberg": "DE",
  "north rhine-westphalia": "DE", "lower saxony": "DE",
  "rhineland-palatinate": "DE", "schleswig-holstein": "DE",
  "mecklenburg-western pomerania": "DE", thuringia: "DE",
};

export function countryFromLocation(location: string | undefined) {
  const finalPart = location?.split(/[,;|]/).at(-1)?.trim().toLocaleLowerCase();
  return finalPart ? locationCountries[finalPart] ?? null : null;
}

export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!,
  );
}

export function sourceBodyHtml(value: string) {
  if (/<\/?(?:p|div|ul|ol|li|h[1-6]|br|blockquote|strong|em|a)\b/i.test(value)) return value;
  return `<p>${escapeHtml(value).replace(/\n\s*\n/g, "</p><p>").replace(/\n/g, "<br>")}</p>`;
}

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
  const markup = decodeMarkup(raw.descriptionHtml ?? raw.description)
    .replace(/<h([1-6])\b[^>]*>\s*<\/h\1>/gi, "");
  const descriptionHtml = /<\/?(?:h[1-6]|p|div|span|ul|ol|li|strong|b|em|i|br|a|blockquote)\b/i.test(markup) && markup.length <= 200000
    ? markup
    : null;
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
  const sourceUpdatedAt =
    raw.sourceUpdatedAt === undefined || raw.sourceUpdatedAt === null
      ? null
      : new Date(raw.sourceUpdatedAt);
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
    descriptionHtml,
    shortDescription: description.replace(/\s+/g, " ").slice(0, 300),
    category: classifyJob(title, raw.sourceCategories),
    location: raw.location?.trim() || "Not specified",
    city: raw.city || null,
    country: raw.country ? (countryMap[raw.country] ?? raw.country) : countryFromLocation(raw.location),
    region: raw.region || null,
    remoteType,
    employmentType: raw.employmentType || null,
    employmentKind: classifyEmploymentType(raw.employmentType),
    experienceLevel: classifyExperienceLevel(title),
    salaryMin: currency ? (raw.salary?.min ?? null) : null,
    salaryMax: currency ? (raw.salary?.max ?? null) : null,
    currency,
    technologies: technologies.filter((technology) =>
      new RegExp(
        `(?<![a-z0-9])${technology.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![a-z0-9])`,
        "i",
      ).test(text) || (raw.technologies ?? []).some((tag) => tag.toLowerCase() === technology.toLowerCase()),
    ),
    sourceCategories: (raw.sourceCategories ?? []).filter(Boolean).slice(0, 30),
    sourceUrl: raw.sourceUrl,
    applyUrl: raw.applyUrl,
    publishedAt,
    sourceUpdatedAt,
    companyName: raw.companyName?.trim() || null,
  });
}
