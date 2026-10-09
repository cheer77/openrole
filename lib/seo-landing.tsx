import "server-only";
import { cache } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getJobs, requestTime } from "@/lib/api";
import { JobCard } from "@/features/jobs/job-card";
import { MIN_JOBS_FOR_INDEXATION, seoCategories, seoLocations, seoTechnologies } from "@/lib/seo-config";
import { robots } from "@/lib/seo-site";

export type LandingKind = "category" | "technology" | "location" | "remote";
export const landingData = cache(async (kind: LandingKind, slug: string, page: number) => {
  const category = kind === "category" ? seoCategories.find((item) => item.slug === slug) : null;
  const technology = kind === "technology" ? seoTechnologies.find((item) => item.slug === slug) : null;
  const location = kind === "location" ? seoLocations.find((item) => item.slug === slug) : null;
  if (kind !== "remote" && !category && !technology && !location) return null;
  const path = kind === "remote" ? "/remote-jobs" : `/${kind === "category" ? "categories" : kind === "technology" ? "technologies" : "locations"}/${slug}`;
  const title = kind === "remote" ? "Remote jobs" : category ? `${category.name} jobs` : technology ? `${technology.name} jobs` : `Jobs in ${location!.name}`;
  const query = new URLSearchParams({ page: String(page), limit: "20" });
  if (kind === "remote") query.set("remoteType", "REMOTE");
  if (category) query.set("category", category.name);
  if (technology) query.set("technologies", technology.name);
  if (location) query.set("country", location.country);
  const result = await getJobs(query);
  return { path, title, result };
});

export async function landingMetadata(kind: LandingKind, slug: string, page: number): Promise<Metadata> {
  const data = await landingData(kind, slug, page);
  if (!data) return { title: "Page not found", robots: robots(false) };
  const canonical = page > 1 ? `${data.path}?page=${page}` : data.path;
  return {
    title: data.title,
    description: `${data.result.total} current ${data.title.toLowerCase()} from company career pages. Browse requirements and apply on the employer website.`,
    alternates: { canonical },
    openGraph: { title: data.title, description: `${data.result.total} current roles.`, url: canonical, type: "website" },
    robots: robots(page === 1 && data.result.total >= MIN_JOBS_FOR_INDEXATION),
  };
}

export async function SeoLanding({ kind, slug, page }: { kind: LandingKind; slug: string; page: number }) {
  const data = await landingData(kind, slug, page);
  if (!data) notFound();
  const { result, title, path } = data;
  const now = requestTime();
  return (
    <main id="main-content" className="container seo-landing">
      <Link href="/jobs" className="back-link">All jobs</Link>
      <header className="seo-landing-heading">
        <h1>{title}</h1>
        <p>{result.total} active {result.total === 1 ? "job" : "jobs"} from company career pages.</p>
      </header>
      {result.items.length ? (
        <>
          <h2>Open roles</h2>
          <div className="seo-job-list">{result.items.map((job) => <JobCard key={job.id} job={job} now={now} />)}</div>
          {result.pages > 1 && <nav className="seo-page-nav" aria-label="Job pages">
            {page > 1 && <Link href={page === 2 ? path : `${path}?page=${page - 1}`}>Previous page</Link>}
            <span>Page {page} of {result.pages}</span>
            {page < result.pages && <Link href={`${path}?page=${page + 1}`}>Next page</Link>}
          </nav>}
        </>
      ) : <div className="empty-state"><h2>No active jobs here right now.</h2><Link href="/jobs" className="primary-button">Browse all jobs</Link></div>}
    </main>
  );
}

export function landingPageNumber(value?: string) {
  return Math.max(1, Math.min(10000, Number.parseInt(value || "1", 10) || 1));
}
