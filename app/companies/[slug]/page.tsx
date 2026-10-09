import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CompanyLogo } from "@/components/company-logo";
import { JobCard } from "@/features/jobs/job-card";
import { companyPresentation, getCompany, getJobs, requestTime } from "@/lib/api";
import { categoryPath, MIN_JOBS_FOR_INDEXATION } from "@/lib/seo-config";
import { robots } from "@/lib/seo-site";
import { landingPageNumber } from "@/lib/seo-landing";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ page?: string }> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = landingPageNumber((await searchParams).page);
  const company = await getCompany(slug);
  if (!company) return { title: "Company not found", robots: robots(false) };
  const path = `/companies/${slug}`;
  const canonical = page > 1 ? `${path}?page=${page}` : path;
  const description = `${company.activeJobs} active jobs at ${company.name}${company.country ? ` in ${company.country}` : ""}. View openings and company information.`;
  return {
    title: `${company.name} jobs`, description,
    alternates: { canonical },
    openGraph: { title: `${company.name} jobs`, description, url: canonical, type: "website" },
    robots: robots(page === 1 && company.activeJobs >= MIN_JOBS_FOR_INDEXATION),
  };
}

export default async function CompanyPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const page = landingPageNumber((await searchParams).page);
  const company = await getCompany(slug);
  if (!company) notFound();
  const jobs = await getJobs(new URLSearchParams({ company: slug, limit: "20", page: String(page) }));
  const website = company.website || company.careerUrl;
  return (
    <main id="main-content" className="container seo-landing company-profile">
      <Link href="/companies" className="back-link">All companies</Link>
      <header className="company-profile-heading">
        <CompanyLogo company={companyPresentation(company)} large />
        <div>
          <h1>{company.name}</h1>
          <p>{company.activeJobs} active {company.activeJobs === 1 ? "job" : "jobs"}{company.country ? ` · ${company.country}` : ""}</p>
          {website && <a href={website} target="_blank" rel="noopener noreferrer" className="inline-link">Company website</a>}
        </div>
      </header>
      {company.categories.length > 0 && <nav className="seo-related-links" aria-label="Job categories">
        {company.categories.map((item) => {
          const path = categoryPath(item.name);
          return path ? <Link href={path} key={item.name}>{item.name} ({item.count})</Link> : null;
        })}
      </nav>}
      <h2>More jobs at {company.name}</h2>
      {jobs.items.length ? <>
        <div className="seo-job-list">{jobs.items.map((job) => <JobCard key={job.id} job={job} now={requestTime()} />)}</div>
        {jobs.pages > 1 && <nav className="seo-page-nav" aria-label="Company job pages">
          {page > 1 && <Link href={page === 2 ? `/companies/${slug}` : `/companies/${slug}?page=${page - 1}`}>Previous page</Link>}
          <span>Page {page} of {jobs.pages}</span>
          {page < jobs.pages && <Link href={`/companies/${slug}?page=${page + 1}`}>Next page</Link>}
        </nav>}
      </> : <p>No active jobs at this company right now.</p>}
    </main>
  );
}
