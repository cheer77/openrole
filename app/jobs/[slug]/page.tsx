import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getMockJobs } from "@/data/jobs";
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
  const job = getMockJobs().find((item) => item.slug === slug);
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
  const job = getMockJobs().find((item) => item.slug === slug);
  if (!job) notFound();
  const query =
    typeof from === "string"
      ? serializeFilters(parseFilters(new URLSearchParams(from))).toString()
      : "";
  const backHref = `/jobs${query ? `?${query}` : ""}`;
  const apply = (
    <a
      className="primary-button apply-button"
      href={job.applyUrl}
      target="_blank"
      rel="noopener noreferrer"
    >
      Apply on company website <Icon name="external" size={17} />
    </a>
  );
  return (
    <main id="main-content" className="container detail-page">
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
              <span className="demo-label">Demo role</span>
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
                  Work authorization and visa sponsorship are not specified in
                  this demo. Confirm with the employer.
                </small>
              </div>
            </div>
            <section>
              <h2>About the role</h2>
              {job.description.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </section>
            <section>
              <h2>What you’ll do</h2>
              <ul>
                {job.responsibilities.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
            <section>
              <h2>What you’ll bring</h2>
              <ul>
                {job.requirements.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
            <section>
              <h2>Nice to have</h2>
              <ul>
                {job.niceToHave.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
            <section>
              <h2>What’s in it for you</h2>
              <ul>
                {job.benefits.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
            <section className="about-company">
              <h2>About {job.company.name}</h2>
              <p>{job.company.description}</p>
              <a
                className="inline-link"
                href={job.company.website}
                target="_blank"
                rel="noopener noreferrer"
              >
                Explore company careers <Icon name="external" size={15} />
              </a>
            </section>
            <div className="detail-published">
              <Icon name="clock" size={15} />
              Published{" "}
              <time dateTime={job.publishedAt}>
                {new Date(job.publishedAt).toLocaleDateString("en-GB", {
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
              This is a demonstration listing, not a verified open position.
              Role details, salaries, and benefits are illustrative.
            </p>
          </div>
        </aside>
      </div>
      <div className="mobile-apply">{apply}</div>
    </main>
  );
}
