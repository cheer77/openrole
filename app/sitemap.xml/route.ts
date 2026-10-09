import { getSeoSummary } from "@/lib/api";
import { MIN_JOBS_FOR_INDEXATION, SITEMAP_PAGE_SIZE, seoCategories, seoLocations, seoTechnologies } from "@/lib/seo-config";
import { seoEnabled, siteOrigin } from "@/lib/seo-site";
import { sitemapIndex } from "@/lib/sitemap-xml";

export const dynamic = "force-dynamic";
export async function GET() {
  if (!seoEnabled()) return new Response("Sitemap unavailable", { status: 404 });
  const summary = await getSeoSummary();
  const files = ["static.xml"];
  for (let page = 1; page <= Math.ceil(summary.jobs / SITEMAP_PAGE_SIZE); page++) files.push(`jobs-${page}.xml`);
  for (let page = 1; page <= Math.ceil(summary.companies / SITEMAP_PAGE_SIZE); page++) files.push(`companies-${page}.xml`);
  if (seoCategories.some((item) => (summary.categories.find((count) => count.name === item.name)?.count ?? 0) >= MIN_JOBS_FOR_INDEXATION)) files.push("categories.xml");
  if (seoTechnologies.some((item) => (summary.technologies.find((count) => count.name === item.name)?.count ?? 0) >= MIN_JOBS_FOR_INDEXATION)) files.push("technologies.xml");
  if (seoLocations.some((item) => (summary.countries.find((count) => count.name === item.country)?.count ?? 0) >= MIN_JOBS_FOR_INDEXATION)) files.push("locations.xml");
  return new Response(sitemapIndex(files.map((file) => `${siteOrigin()}/sitemaps/${file}`)), {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
  });
}
