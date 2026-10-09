export const MIN_JOBS_FOR_INDEXATION = 5;
export const SITEMAP_PAGE_SIZE = 5000;

export const seoCategories = [
  { slug: "frontend", name: "Frontend" },
  { slug: "backend", name: "Backend" },
  { slug: "full-stack", name: "Full Stack" },
  { slug: "devops", name: "DevOps" },
  { slug: "qa", name: "QA" },
  { slug: "design", name: "Design" },
  { slug: "data", name: "Data" },
  { slug: "ai-ml", name: "AI / ML" },
] as const;

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
