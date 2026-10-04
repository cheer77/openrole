import type { Metadata } from "next";
import Link from "next/link";
import { getMockJobs } from "@/data/jobs";
import { CompanyLogo } from "@/components/company-logo";
import { Icon } from "@/components/icon";
export const metadata: Metadata = { title: "Explore companies" };

export default function CompaniesPage() {
  const jobs = getMockJobs();
  const companies = [
    ...new Map(jobs.map((job) => [job.company.name, job.company])).values(),
  ];
  return (
    <main id="main-content" className="container companies-page">
      <div className="page-heading">
        <div>
          <h1>Find your next team.</h1>
          <p>
            Explore {companies.length} companies and their roles in our demo
            collection.
          </p>
        </div>
        <span className="demo-label">Demo companies</span>
      </div>
      <div className="companies-grid">
        {companies.map((company) => {
          const companyJobs = jobs.filter(
            (job) => job.company.name === company.name,
          );
          return (
            <article className="company-card" key={company.name}>
              <CompanyLogo company={company} large />
              <h2>{company.name}</h2>
              <p>{company.description}</p>
              <div className="company-card-footer">
                <span>{companyJobs.length} demo jobs</span>
                <Link
                  href={`/jobs?q=${encodeURIComponent(company.name)}`}
                  aria-label={`View jobs at ${company.name}`}
                >
                  View jobs <Icon name="arrow" size={17} />
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    </main>
  );
}
