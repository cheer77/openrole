import Link from "next/link";
import type { Job } from "./types";
import { CompanyLogo } from "@/components/company-logo";
import { Icon } from "@/components/icon";
import { formatSalary, locationLabel, timeAgo } from "@/lib/format";
import { ResultJobTitle } from "./result-job-title";

export function JobCard({
  job,
  now,
  returnQuery = "",
  variant = "legacy",
  showDescription = true,
}: {
  job: Job;
  now: number;
  returnQuery?: string;
  variant?: "legacy" | "list" | "grid";
  showDescription?: boolean;
}) {
  const fresh = now - new Date(job.publishedAt || job.firstSeenAt).getTime() < 86400000;
  const href = `/jobs/${job.slug}${returnQuery ? `?from=${encodeURIComponent(returnQuery)}` : ""}`;
  const showWorkType = job.workType !== "Not specified";
  if (variant !== "legacy") {
    let tone = 0;
    for (const character of job.id) tone = (tone * 31 + character.charCodeAt(0)) >>> 0;
    return (
      <article
        className={`job-card result-job-card job-title-hover-surface ${variant === "grid" ? "job-card-grid" : "job-card-list"}`}
        data-job-id={job.id}
        data-job-tone={tone % 2}
      >
        <div className="job-card-top result-card-top">
          <div className="result-card-company">
            <CompanyLogo company={job.company} />
            <div className="company-line">
              <span className="company-name">{job.company.name}</span>
              <span className="result-card-category">{job.category}</span>
            </div>
          </div>
          {fresh && <span className="new-badge">New today</span>}
        </div>
        <ResultJobTitle href={href} title={job.title} />
        <div className="job-meta result-card-meta">
          <span>
            <Icon name="pin" size={16} strokeWidth={1.8} />
            {locationLabel(job)}
          </span>
          {showWorkType && (
            <span className="work-badge">
              {job.workType === "Remote" && <Icon name="globe" size={16} strokeWidth={1.8} />}
              {job.workType}
            </span>
          )}
          {job.employmentKind && <span><Icon name="briefcase" size={16} strokeWidth={1.8} />{job.employmentKind}</span>}
          {variant === "grid" && (
            <time className="result-card-date" dateTime={job.publishedAt || job.firstSeenAt}>
              <Icon name="clock" size={16} strokeWidth={1.8} />
              {!job.publishedAt && "Added "}{timeAgo(job.publishedAt || job.firstSeenAt, now)}
            </time>
          )}
        </div>
        {showDescription && job.shortDescription && <p className="job-preview result-card-preview">{job.shortDescription}</p>}
        <div className="job-card-bottom result-card-bottom">
          <div className={`card-salary ${!job.salary ? "salary-unlisted" : ""}`}>
            <Icon name="wallet" size={17} strokeWidth={1.8} />
            <strong>{formatSalary(job.salary)}</strong>
          </div>
          {variant === "list" && (
            <time className="result-card-date" dateTime={job.publishedAt || job.firstSeenAt}>
              <Icon name="clock" size={16} strokeWidth={1.8} />
              {!job.publishedAt && "Added "}{timeAgo(job.publishedAt || job.firstSeenAt, now)}
            </time>
          )}
          <Link
            href={href}
            className="view-job"
            aria-label={`View ${job.title} at ${job.company.name}`}
          >
            View job <Icon name="arrowUpRight" size={17} strokeWidth={1.8} />
          </Link>
        </div>
      </article>
    );
  }
  return (
    <article className="job-card" data-job-id={job.id}>
      <div className="job-card-top">
        <CompanyLogo company={job.company} />
        <div className="job-card-heading">
          <h3>
            <Link href={href} className="card-title-link">
              {job.title}
            </Link>
          </h3>
          <div className="company-line">
            <span className="company-name">{job.company.name}</span>
            <span className="company-separator">·</span>
            <span>{job.category}</span>
          </div>
        </div>
        <div className={`card-salary ${!job.salary ? "salary-unlisted" : ""}`}>
          <strong>{formatSalary(job.salary)}</strong>
          {job.salary && <span>{job.salary.currency} / year</span>}
        </div>
      </div>
      <div className="card-content">
        <div className="job-meta">
          {showWorkType && (
            <span className="work-badge">
              {job.workType === "Remote" && <Icon name="globe" size={14} />}
              {job.workType}
            </span>
          )}
          <span>
            <Icon name="pin" size={15} />
            {locationLabel(job)}
          </span>
          {job.employmentKind && <span><Icon name="briefcase" size={15} />{job.employmentKind}</span>}
          {job.experience !== "Not specified" && <span>{job.experience}</span>}
        </div>
        <p className="job-preview">{job.shortDescription}</p>
      </div>
      <div className="job-card-bottom">
        {job.technologies.length > 0 && <div className="tech-tags">
          {job.technologies.map((tech) => <span key={tech}>{tech}</span>)}
        </div>}
        <div className="posted-info">
          {fresh && <span className="new-badge">New today</span>}
          <time dateTime={job.publishedAt || job.firstSeenAt}>
            <Icon name="clock" size={13} />
            {!job.publishedAt && "Added "}{timeAgo(job.publishedAt || job.firstSeenAt, now)}
          </time>
        </div>
        <Link
          href={href}
          className="view-job"
          aria-label={`View ${job.title} at ${job.company.name}`}
        >
          View job <Icon name="arrow" size={16} />
        </Link>
      </div>
    </article>
  );
}
