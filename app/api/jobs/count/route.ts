import { getJobs } from "@/lib/api";
import { apiJobsQuery } from "@/lib/api-query";
import { parseFilters } from "@/features/jobs/filter-jobs";
export async function GET(request: Request) {
  const filters = parseFilters(new URL(request.url).searchParams);
  if (
    filters.salaryMin &&
    filters.salaryMax &&
    Number(filters.salaryMin) > Number(filters.salaryMax)
  ) {
    return Response.json({ total: 0 });
  }
  const query = apiJobsQuery(filters);
  query.set("limit", "1");
  query.set("page", "1");
  try {
    const result = await getJobs(query);
    return Response.json({ total: result.total });
  } catch {
    return Response.json({ message: "Jobs unavailable" }, { status: 503 });
  }
}
