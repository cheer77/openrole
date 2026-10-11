import { categories } from "@/features/jobs/types";

export const MIN_JOBS_FOR_INDEXATION = 5;
export const SITEMAP_PAGE_SIZE = 5000;

export const seoCategories = categories
  .filter((name) => name !== "Other")
  .map((name) => ({
    name,
    slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
  }));

export const seoTechnologies = [
  { slug: "react", name: "React" },
  { slug: "typescript", name: "TypeScript" },
  { slug: "python", name: "Python" },
  { slug: "nodejs", name: "Node.js" },
  { slug: "javascript", name: "JavaScript" },
  { slug: "java", name: "Java" },
  { slug: "go", name: "Go" },
  { slug: "aws", name: "AWS" },
] as const;

export const seoLocations = [
  { slug: "spain", name: "Spain", country: "ES" },
  { slug: "germany", name: "Germany", country: "DE" },
  { slug: "uk", name: "UK", country: "GB" },
  { slug: "usa", name: "USA", country: "US" },
  { slug: "france", name: "France", country: "FR" },
] as const;

export function categoryPath(name: string) {
  const item = seoCategories.find((entry) => entry.name === name);
  return item ? `/categories/${item.slug}` : null;
}
export function technologyPath(name: string) {
  const item = seoTechnologies.find((entry) => entry.name === name);
  return item ? `/technologies/${item.slug}` : null;
}
export function locationPath(country?: string | null) {
  const item = seoLocations.find((entry) => entry.country === country);
  return item ? `/locations/${item.slug}` : null;
}
