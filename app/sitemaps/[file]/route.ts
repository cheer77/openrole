import { getSeoCompanies, getSeoJobs, getSeoSummary } from "@/lib/api";
import { MIN_JOBS_FOR_INDEXATION, SITEMAP_PAGE_SIZE, seoCategories, seoLocations, seoTechnologies } from "@/lib/seo-config";
import { canonical, seoEnabled } from "@/lib/seo-site";
import { sitemapUrls } from "@/lib/sitemap-xml";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ file: string }> };

export async function GET(_request: Request, { params }: Props) {
  if (!seoEnabled()) return new Response("Sitemap unavailable", { status: 404 });
  const { file } = await params;
  let entries: { url: string; lastModified?: string }[];
  const jobs = /^jobs-([1-9]\d*)\.xml$/.exec(file);
  const companies = /^companies-([1-9]\d*)\.xml$/.exec(file);
  if (jobs && Number(jobs[1]) <= 2000) {
    const rows = await getSeoJobs((Number(jobs[1]) - 1) * SITEMAP_PAGE_SIZE, SITEMAP_PAGE_SIZE);
    entries = rows.map((row) => ({ url: canonical(`/jobs/${row.slug}`), lastModified: row.updatedAt }));
  } else if (companies && Number(companies[1]) <= 2000) {
    const rows = await getSeoCompanies((Number(companies[1]) - 1) * SITEMAP_PAGE_SIZE, SITEMAP_PAGE_SIZE);
    entries = rows.map((row) => ({ url: canonical(`/companies/${row.slug}`), lastModified: row.updatedAt }));
  } else if (["static.xml", "categories.xml", "technologies.xml", "locations.xml"].includes(file)) {
    const summary = await getSeoSummary();
    const paths = file === "static.xml"
      ? ["/", "/jobs", "/companies", ...(summary.remote >= MIN_JOBS_FOR_INDEXATION ? ["/remote-jobs"] : [])]
      : file === "categories.xml"
        ? seoCategories.filter((item) => (summary.categories.find((count) => count.name === item.name)?.count ?? 0) >= MIN_JOBS_FOR_INDEXATION).map((item) => `/categories/${item.slug}`)
        : file === "technologies.xml"
          ? seoTechnologies.filter((item) => (summary.technologies.find((count) => count.name === item.name)?.count ?? 0) >= MIN_JOBS_FOR_INDEXATION).map((item) => `/technologies/${item.slug}`)
          : seoLocations.filter((item) => (summary.countries.find((count) => count.name === item.country)?.count ?? 0) >= MIN_JOBS_FOR_INDEXATION).map((item) => `/locations/${item.slug}`);
    entries = paths.map((path) => ({ url: canonical(path) }));
  } else return new Response("Sitemap not found", { status: 404 });
  if (!entries.length) return new Response("Sitemap not found", { status: 404 });
  return new Response(sitemapUrls(entries), {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
  });
}
