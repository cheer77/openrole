import { JobView } from "@/components/analytics";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getJob, getSimilarJobs, requestTime } from "@/lib/api";
import { ApplyLink } from "@/components/apply-link";
import { CompanyLogo } from "@/components/company-logo";
import { Icon } from "@/components/icon";
import { formatSalary, locationLabel } from "@/lib/format";
import { JobDescription } from "@/components/job-description";
import { parseFilters, serializeFilters } from "@/features/jobs/filter-jobs";
import { JobCard } from "@/features/jobs/job-card";
import { categoryPath, locationPath, technologyPath } from "@/lib/seo-config";
import { canonical, robots } from "@/lib/seo-site";
import { jobPosting, jobSeoDescription, jobSeoTitle, safeJsonLd } from "@/lib/job-seo";
export const dynamic = "force-dynamic";
type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ from?: string }>;
};
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const job = await getJob(slug);
  if (!job) notFound();
  return {
        title: job.status === "CLOSED" ? `${job.title} at ${job.company.name} — no longer available` : jobSeoTitle(job),
        description: job.status === "CLOSED" ? `This job at ${job.company.name} is no longer available. Explore similar active jobs.` : jobSeoDescription(job),
        alternates: { canonical: `/jobs/${job.slug}` },
        openGraph: { title: jobSeoTitle(job), description: jobSeoDescription(job), url: `/jobs/${job.slug}`, type: "article" },
        robots: robots(job.status === "ACTIVE"),
      };
}
export default async function JobDetails({ params, searchParams }: Props) {
  const { slug } = await params;
  const { from } = await searchParams;
  const job = await getJob(slug);
  if (!job) notFound();
  const similar = await getSimilarJobs(slug);
  const active = job.status === "ACTIVE";
  const posting = active ? jobPosting(job, canonical(`/jobs/${job.slug}`)) : null;
  const categoryHref = categoryPath(job.category);
  const locationHref = locationPath(job.country);
  const technologyHrefs = job.technologies.map((tech) => ({ tech, href: technologyPath(tech) })).filter((item) => item.href);
  const query =
    typeof from === "string"
      ? serializeFilters(parseFilters(new URLSearchParams(from))).toString()
      : "";
  const backHref = `/jobs${query ? `?${query}` : ""}`;
  const apply = active ? <ApplyLink jobId={job.id} href={job.applyUrl} /> : null;
  return (
    <main
      id="main-content"
      className="container detail-page"
      data-job-id={job.id}
    >
      {posting && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(posting) }} />}
      <JobView jobId={job.id} />
      <Link href={backHref} className="back-link">
        <Icon name="back" size={17} />
        Back to all jobs
      </Link>
      <div className="detail-layout">
        <article className="job-detail">
          <header className="detail-header">
            <div className="detail-company">
              <CompanyLogo company={job.company} large />
              <div>
                <span className="detail-category">{job.category}</span>
                <p>{job.company.name}</p>
              </div>
              <span className="demo-label">Company listing</span>
            </div>
            <h1>{job.title}</h1>
            <div className="detail-meta">
              <span>
                <Icon name="pin" size={16} />
                {locationLabel(job)}
              </span>
              <span className="remote-pill">{job.workType}</span>
              <span>{job.experience}</span>
            </div>
            <div className="detail-salary">
              {formatSalary(job.salary)}
              {job.salary && <span> {job.salary.currency} / year</span>}
            </div>
            <div className="tech-tags">
              {job.technologies.map((tech) => (
                <span key={tech}>{tech}</span>
              ))}
            </div>
          </header>
          <div className="detail-copy">
            {!active && <div className="closed-job-notice" role="status">
              <strong>This job is no longer available.</strong>
              <p>Explore current opportunities below or browse more jobs at {job.company.name}.</p>
            </div>}
            {active && <div className="eligibility-callout">
              <Icon name="globe" size={22} />
              <div>
                <h2>Is this role open to you?</h2>
                <p>{job.eligibility}</p>
                <small>
                  Confirm work authorization, visa sponsorship and location
                  requirements with the employer.
                </small>
              </div>
            </div>}
            <JobDescription
              description={job.description.join("\n\n")}
              descriptionHtml={job.descriptionHtml}
            />
            <section className="about-company">
              <h2>About {job.company.name}</h2>
              <a
                className="inline-link"
                href={job.company.website || job.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Explore company careers <Icon name="external" size={15} />
              </a>
            </section>
            <div className="detail-published">
              <Icon name="clock" size={15} />
              {job.publishedAt ? "Published" : "First seen"}{" "}
              <time dateTime={job.publishedAt || job.firstSeenAt}>
                {new Date(
                  job.publishedAt || job.firstSeenAt,
                ).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                  timeZone: "UTC",
                })}
              </time>
            </div>
          </div>
        </article>
        <aside className="detail-sidebar">
          <div className="apply-panel">
            <div className="summary-company">
              <CompanyLogo company={job.company} />
              <span>{job.company.name}</span>
            </div>
            <h2>{job.title}</h2>
            <div className="summary-salary">
              {formatSalary(job.salary)}
              {job.salary && <span>{job.salary.currency} / year</span>}
            </div>
            {active ? <>{apply}<span className="apply-caption">Opens {job.company.name}’s careers page in a new tab</span></> : <p className="closed-sidebar-message">This job is no longer available.</p>}
            <div className="role-summary">
              <h3>At a glance</h3>
              <dl>
                <div>
                  <dt>Location</dt>
                  <dd>{locationLabel(job)}</dd>
                </div>
                <div>
                  <dt>Work arrangement</dt>
                  <dd>{job.workType}</dd>
                </div>
                <div>
                  <dt>Experience</dt>
                  <dd>{job.experience}</dd>
                </div>
                <div>
                  <dt>Category</dt>
                  <dd>{job.category}</dd>
                </div>
              </dl>
            </div>
          </div>
          <div className="detail-demo">
            <Icon name="sparkle" size={18} />
            <p>
              Details are supplied by the employer. Check the original listing
              before applying.
            </p>
          </div>
        </aside>
      </div>
      <section className="job-related" aria-labelledby="similar-jobs-title">
        <div className="job-related-heading"><h2 id="similar-jobs-title">Similar jobs</h2><Link href="/jobs" className="inline-link">Browse all jobs</Link></div>
        {similar.length > 0 ? <div className="job-related-grid">{similar.map((item) => <JobCard key={item.id} job={item} now={requestTime()} />)}</div> : <p>No similar active jobs right now.</p>}
        <nav className="seo-related-links" aria-label="Explore related jobs">
          <Link href={`/companies/${job.company.slug}`}>More jobs at {job.company.name}</Link>
          {categoryHref && <Link href={categoryHref}>More {job.category} jobs</Link>}
          {locationHref && <Link href={locationHref}>More jobs in {job.country}</Link>}
          {job.remoteType === "REMOTE" && <Link href="/remote-jobs">Remote jobs</Link>}
          {technologyHrefs.slice(0, 3).map(({ tech, href }) => <Link key={tech} href={href!}>More {tech} jobs</Link>)}
        </nav>
      </section>
      {active && <div className="mobile-apply">{apply}</div>}
    </main>
  );
}
