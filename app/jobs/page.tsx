import { requestTime } from "@/lib/api";
import type { Metadata } from "next";
import { JobsExplorer } from "@/features/jobs/jobs-explorer";
import { parseFilters, serializeFilters } from "@/features/jobs/filter-jobs";
import { apiJobsQuery } from "@/lib/api-query";
import { getJobs } from "@/lib/api";
import { robots } from "@/lib/seo-site";
export async function generateMetadata({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }): Promise<Metadata> {
  const params = await searchParams;
  const keys = Object.keys(params).filter((key) => params[key] !== undefined);
  const page = keys.length === 1 && keys[0] === "page" ? Math.max(1, Number.parseInt(String(params.page), 10) || 1) : 1;
  return {
    title: "Find your next role",
    description: "Explore current tech and digital jobs from company career pages.",
    alternates: { canonical: page > 1 ? `/jobs?page=${page}` : "/jobs" },
    robots: robots(keys.length === 0),
  };
}
export const dynamic = "force-dynamic";
export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    for (const item of Array.isArray(value)
      ? value
      : value === undefined
        ? []
        : [value])
      params.append(key, item);
  }
  const filters = parseFilters(params);
  let result = null;
  let error = "";
  if (
    filters.salaryMin &&
    filters.salaryMax &&
    Number(filters.salaryMin) > Number(filters.salaryMax)
  ) {
    error = "Minimum salary must not exceed maximum salary.";
  } else {
    try {
      result = await getJobs(apiJobsQuery(filters));
      if (result.pages > 0 && filters.page > result.pages) {
        filters.page = result.pages;
        result = await getJobs(apiJobsQuery(filters));
      }
    } catch {
      error =
        "We couldn’t load jobs. Your filters are saved. Please try again.";
    }
  }
  return (
    <JobsExplorer
      result={result}
      error={error}
      appliedQuery={serializeFilters(filters).toString()}
      now={requestTime()}
    />
  );
}
