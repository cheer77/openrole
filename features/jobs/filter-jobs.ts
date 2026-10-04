import {
  categories,
  currencies,
  experiences,
  locations,
  technologies,
  workTypes,
  type Filters,
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
  value && /^\d{1,9}$/.test(value) && Number(value) <= 100000000 ? String(Number(value)) : "";
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
      Math.min(10000, Number.parseInt(params.get("page") || "1", 10) || 1),
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
