import {
  categories,
  currencies,
  experiences,
  locations,
  technologies,
  workTypes,
  type Filters,
  type Job,
} from "./types.ts";
export const PAGE_SIZE = 8;
export const sortOptions = [
  ["newest", "Newest first"],
  ["oldest", "Oldest first"],
  ["salary-high", "Salary: high to low"],
  ["salary-low", "Salary: low to high"],
] as const;
export const postedOptions = [
  ["1", "Last 24 hours"],
  ["3", "Last 3 days"],
  ["7", "Last 7 days"],
  ["30", "Last 30 days"],
] as const;
const valid = (value: string | null, options: readonly string[]) =>
  value && options.includes(value) ? value : "";
const amount = (value: string | null) =>
  value && /^\d{1,9}$/.test(value) ? String(Number(value)) : "";
export function parseFilters(params: URLSearchParams): Filters {
  const sort =
    valid(
      params.get("sort"),
      sortOptions.map(([value]) => value),
    ) || "newest";
  const salaryMin = amount(params.get("salaryMin"));
  const salaryMax = amount(params.get("salaryMax"));
  return {
    q: (params.get("q") || "").trim().slice(0, 150),
    category: valid(params.get("category"), categories),
    location: valid(params.get("location"), locations),
    workType: valid(params.get("workType"), workTypes),
    experience: valid(params.get("experience"), experiences),
    posted: valid(params.get("posted"), ["1", "3", "7", "30"]),
    salaryMin,
    salaryMax,
    currency:
      valid(params.get("currency"), currencies) ||
      (salaryMin || salaryMax || sort.startsWith("salary") ? "USD" : ""),
    tech: [
      ...new Set(
        params
          .getAll("tech")
          .filter((value) =>
            technologies.includes(value as (typeof technologies)[number]),
          ),
      ),
    ],
    sort,
    page: Math.max(
      1,
      Math.min(100000, Number.parseInt(params.get("page") || "1", 10) || 1),
    ),
  };
}
export function serializeFilters(filters: Filters): URLSearchParams {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (key === "tech")
      (value as string[]).forEach((tech) => params.append("tech", tech));
    else if (
      value &&
      !(key === "sort" && value === "newest") &&
      !(key === "page" && value === 1)
    )
      params.set(key, String(value));
  });
  return params;
}
export function matchesLocation(job: Job, location: string): boolean {
  if (!location) return true;
  if (job.location === "Worldwide" || job.location === location) return true;
  const withinEurope = ["Spain", "Germany", "UK", "EU"];
  if (location === "Europe") return withinEurope.includes(job.location);
  if (location === "EU")
    return ["Europe", "Spain", "Germany"].includes(job.location);
  if (["Spain", "Germany"].includes(location))
    return ["Europe", "EU"].includes(job.location);
  if (location === "UK") return job.location === "Europe";
  return false;
}
export function filterJobs(jobs: Job[], filters: Filters, now: number): Job[] {
  if (
    filters.salaryMin &&
    filters.salaryMax &&
    Number(filters.salaryMin) > Number(filters.salaryMax)
  )
    return [];
  const words = filters.q.toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return jobs
    .filter((job) => {
      const searchable = [
        job.title,
        job.company.name,
        job.category,
        job.shortDescription,
        ...job.technologies,
        ...job.description,
      ]
        .join(" ")
        .toLocaleLowerCase();
      if (!words.every((word) => searchable.includes(word))) return false;
      if (filters.category && job.category !== filters.category) return false;
      if (!matchesLocation(job, filters.location)) return false;
      if (filters.workType && job.workType !== filters.workType) return false;
      if (filters.experience && job.experience !== filters.experience)
        return false;
      if (
        filters.posted &&
        now - new Date(job.publishedAt).getTime() >
          Number(filters.posted) * 86400000
      )
        return false;
      if (!filters.tech.every((tech) => job.technologies.includes(tech)))
        return false;
      if (filters.currency && job.salary?.currency !== filters.currency)
        return false;
      if (
        filters.salaryMin &&
        (!job.salary || job.salary.max < Number(filters.salaryMin))
      )
        return false;
      if (
        filters.salaryMax &&
        (!job.salary || job.salary.min > Number(filters.salaryMax))
      )
        return false;
      return true;
    })
    .sort((a, b) => {
      if (filters.sort === "salary-high")
        return (b.salary?.max ?? -Infinity) - (a.salary?.max ?? -Infinity);
      if (filters.sort === "salary-low")
        return (a.salary?.min ?? Infinity) - (b.salary?.min ?? Infinity);
      const difference =
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
      return filters.sort === "oldest" ? -difference : difference;
    });
}
export function activeFilterCount(filters: Filters): number {
  return (
    [
      "category",
      "location",
      "workType",
      "experience",
      "posted",
      "salaryMin",
      "salaryMax",
      "currency",
    ].filter((key) => Boolean(filters[key as keyof Filters])).length +
    filters.tech.length
  );
}
