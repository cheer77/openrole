import Link from "next/link";
import type { Job } from "./types";
import { CompanyLogo } from "@/components/company-logo";
import { Icon } from "@/components/icon";
import { formatSalary, locationLabel, timeAgo } from "@/lib/format";

export function JobCard({
  job,
  now,
  returnQuery = "",
}: {
  job: Job;
  now: number;
  returnQuery?: string;
}) {
  const fresh = now - new Date(job.publishedAt).getTime() < 86400000;
  const href = `/jobs/${job.slug}${returnQuery ? `?from=${encodeURIComponent(returnQuery)}` : ""}`;
  return (
    <article className="job-card">
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
          <span
            className={`work-badge ${job.workType === "Remote" ? "work-remote" : ""}`}
          >
            {job.workType === "Remote" && <Icon name="globe" size={14} />}
            {job.workType}
          </span>
          <span>
            <Icon name="pin" size={15} />
            {locationLabel(job)}
          </span>
          <span>
            <Icon name="briefcase" size={15} />
            {job.experience}
          </span>
        </div>
        <p className="job-preview">{job.shortDescription}</p>
      </div>
      <div className="job-card-bottom">
        <div className="tech-tags">
          {job.technologies.map((tech) => (
            <span key={tech}>{tech}</span>
          ))}
        </div>
        <div className="posted-info">
          {fresh && <span className="new-badge">New today</span>}
          <time dateTime={job.publishedAt}>
            <Icon name="clock" size={13} />
            {timeAgo(job.publishedAt, now)}
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
