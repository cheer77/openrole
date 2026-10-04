import type { Filters } from "../features/jobs/types.ts";
import { PAGE_SIZE } from "../features/jobs/filter-jobs.ts";

export function apiJobsQuery(filters: Filters): URLSearchParams {
  const params = new URLSearchParams({
    page: String(filters.page),
    limit: String(PAGE_SIZE),
    sort: filters.sort,
  });
  const fields = {
    search: filters.q,
    category: filters.category,
    location: filters.location,
    remoteType: (
      { Remote: "REMOTE", Hybrid: "HYBRID", "On-site": "ON_SITE" } as Record<
        string,
        string
      >
    )[filters.workType],
    experience: filters.experience,
    posted: filters.posted,
    salaryMin: filters.salaryMin,
    salaryMax: filters.salaryMax,
    currency: filters.currency,
    technologies: filters.tech.join(","),
  };
  for (const [key, value] of Object.entries(fields))
    if (value) params.set(key, value);
  return params;
}

export function pageNumbers(page: number, pages: number): number[] {
  const start = Math.max(1, Math.min(page - 2, pages - 4));
  return Array.from(
    { length: Math.min(5, pages) },
    (_, index) => start + index,
  );
}
