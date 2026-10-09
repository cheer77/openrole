import "server-only";
import { cache } from "react";
import type { Job } from "@/features/jobs/types";

export interface ApiCompany {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  website: string | null;
  careerUrl: string | null;
  country: string | null;
  _count?: { jobs: number };
}
interface ApiJob {
  id: string;
  slug: string;
  title: string;
  status: "ACTIVE" | "CLOSED";
  company: ApiCompany;
  category: string;
  location: string;
  city?: string | null;
  country?: string | null;
  region?: string | null;
  employmentType?: string | null;
  closedAt?: string | null;
  remoteType: "REMOTE" | "HYBRID" | "ON_SITE" | "UNKNOWN";
  experienceLevel: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  currency: string | null;
  technologies: string[];
  publishedAt: string | null;
  firstSeenAt: string;
  description?: string;
  descriptionHtml?: string | null;
  shortDescription: string;
  applyUrl: string;
  sourceUrl: string;
}
export interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}
export class ApiError extends Error {
  constructor(public status: number) {
    super("The jobs service is unavailable. Please try again.");
  }
}
async function request<T>(path: string): Promise<T> {
  const base = process.env.API_URL || "http://127.0.0.1:4000";
  let response: Response;
  try {
    response = await fetch(`${base.replace(/\/$/, "")}${path}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    throw new ApiError(503);
  }
  if (!response.ok) throw new ApiError(response.status);
  return response.json() as Promise<T>;
}
export function companyPresentation(company: ApiCompany): Job["company"] {
  let logoUrl = company.logoUrl;
  if (!logoUrl && company.website) {
    try {
      logoUrl = new URL("/favicon.ico", company.website).toString();
    } catch {
      logoUrl = null;
    }
  }
  return {
    name: company.name,
    slug: company.slug,
    logoUrl,
    initials: company.name
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word[0])
      .join("")
      .toUpperCase(),
    color: "var(--text-secondary)",
    background: "var(--surface-muted, #f1f4f6)",
    description: "",
    website: company.careerUrl || company.website || "",
  };
}
function toJob(job: ApiJob): Job {
  return {
    id: job.id,
    slug: job.slug,
    status: job.status,
    title: job.title,
    company: companyPresentation(job.company),
    category: job.category,
    location: job.location || "Location not specified",
    city: job.city || undefined,
    country: job.country ?? null,
    region: job.region ?? null,
    remoteType: job.remoteType,
    employmentType: job.employmentType ?? null,
    closedAt: job.closedAt ?? null,
    workType: (
      {
        REMOTE: "Remote",
        HYBRID: "Hybrid",
        ON_SITE: "On-site",
        UNKNOWN: "Not specified",
      } as const
    )[job.remoteType],
    experience: job.experienceLevel || "Not specified",
    ...(job.currency && (job.salaryMin !== null || job.salaryMax !== null)
      ? {
          salary: {
            min: job.salaryMin,
            max: job.salaryMax,
            currency: job.currency,
          },
        }
      : {}),
    technologies: job.technologies,
    publishedAt: job.publishedAt,
    firstSeenAt: job.firstSeenAt,
    shortDescription: job.shortDescription,
    description: job.description?.split(/\n\s*\n/).filter(Boolean) || [],
    descriptionHtml: job.descriptionHtml ?? null,
    eligibility: job.location || "Location not specified",
    applyUrl: job.applyUrl,
    sourceUrl: job.sourceUrl,
  };
}
export async function getJobs(
  query = new URLSearchParams(),
): Promise<PageResult<Job>> {
  const result = await request<PageResult<ApiJob>>(`/jobs?${query}`);
  return { ...result, items: result.items.map(toJob) };
}
export const getJob = cache(async (slug: string): Promise<Job | null> => {
  try {
    return toJob(await request<ApiJob>(`/jobs/${encodeURIComponent(slug)}`));
  } catch (error) {
    if (error instanceof ApiError && [404, 410].includes(error.status)) return null;
    throw error;
  }
});
export const getSimilarJobs = cache(async (slug: string): Promise<Job[]> => {
  try {
    return (await request<ApiJob[]>(`/jobs/${encodeURIComponent(slug)}/similar`)).map(toJob);
  } catch {
    return [];
  }
});
export interface CompanyDetails extends ApiCompany {
  activeJobs: number;
  categories: { name: string; count: number }[];
}
export const getCompany = cache(async (slug: string): Promise<CompanyDetails | null> => {
  try {
    return await request<CompanyDetails>(`/companies/${encodeURIComponent(slug)}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
});
export interface SeoSummary {
  jobs: number;
  companies: number;
  remote: number;
  categories: { name: string; count: number }[];
  countries: { name: string; count: number }[];
  technologies: { name: string; count: number }[];
}
export function getSeoSummary() { return request<SeoSummary>("/seo/summary"); }
export function getSeoJobs(offset: number, limit: number) {
  return request<{ slug: string; updatedAt: string }[]>(`/seo/jobs?offset=${offset}&limit=${limit}`);
}
export function getSeoCompanies(offset: number, limit: number) {
  return request<{ slug: string; updatedAt: string }[]>(`/seo/companies?offset=${offset}&limit=${limit}`);
}
export function getCompanies(
  query = new URLSearchParams(),
): Promise<PageResult<ApiCompany>> {
  return request(`/companies?${query}`);
}

export function requestTime(): number {
  return Date.now();
}
