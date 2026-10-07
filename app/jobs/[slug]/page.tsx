import { JobView } from "@/components/analytics";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getJob } from "@/lib/api";
import { ApplyLink } from "@/components/apply-link";
import { CompanyLogo } from "@/components/company-logo";
import { Icon } from "@/components/icon";
import { formatSalary, locationLabel } from "@/lib/format";
import { parseFilters, serializeFilters } from "@/features/jobs/filter-jobs";
export const dynamic = "force-dynamic";
type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ from?: string }>;
};
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const job = await getJob(slug);
  return job
    ? {
        title: `${job.title} at ${job.company.name}`,
        description: job.shortDescription,
      }
    : { title: "Job not found" };
}
export default async function JobDetails({ params, searchParams }: Props) {
  const { slug } = await params;
  const { from } = await searchParams;
  const job = await getJob(slug);
  if (!job) notFound();
  const query =
    typeof from === "string"
      ? serializeFilters(parseFilters(new URLSearchParams(from))).toString()
      : "";
  const backHref = `/jobs${query ? `?${query}` : ""}`;
  const apply = <ApplyLink jobId={job.id} href={job.applyUrl} />;
  return (
    <main
      id="main-content"
      className="container detail-page"
      data-job-id={job.id}
    >
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
            <div className="eligibility-callout">
              <Icon name="globe" size={22} />
              <div>
                <h2>Is this role open to you?</h2>
                <p>{job.eligibility}</p>
                <small>
                  Confirm work authorization, visa sponsorship and location
                  requirements with the employer.
                </small>
              </div>
            </div>
            <section>
              <h2>About the role</h2>
              {job.description.length === 0 && (
                <p>Read the full description on the company website.</p>
              )}
              {job.description.map((paragraph) => (
                <p className="source-paragraph" key={paragraph}>
                  {paragraph}
                </p>
              ))}
            </section>
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
            {apply}
            <span className="apply-caption">
              Opens {job.company.name}’s careers page in a new tab
            </span>
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
      <div className="mobile-apply">{apply}</div>
    </main>
  );
}
