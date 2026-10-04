import "server-only";
import { cache } from "react";
import type { Job } from "@/features/jobs/types";

export interface ApiCompany {
  id: string;
  name: string;
  slug: string;
  website: string | null;
  careerUrl: string | null;
  country: string | null;
  _count?: { jobs: number };
}
interface ApiJob {
  id: string;
  slug: string;
  title: string;
  company: ApiCompany;
  category: string;
  location: string;
  remoteType: "REMOTE" | "HYBRID" | "ON_SITE" | "UNKNOWN";
  experienceLevel: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  currency: string | null;
  technologies: string[];
  publishedAt: string | null;
  firstSeenAt: string;
  description?: string;
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
  return {
    name: company.name,
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
    title: job.title,
    company: companyPresentation(job.company),
    category: job.category,
    location: job.location || "Location not specified",
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
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
});
export function getCompanies(
  query = new URLSearchParams(),
): Promise<PageResult<ApiCompany>> {
  return request(`/companies?${query}`);
}

export function requestTime(): number {
  return Date.now();
}
