import type { Metadata } from "next";
import Link from "next/link";
import { getCompanies, companyPresentation } from "@/lib/api";
import { CompanyLogo } from "@/components/company-logo";
import { Icon } from "@/components/icon";
export const metadata: Metadata = { title: "Explore companies" };
export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: input } = await searchParams;
  const page = Math.max(
    1,
    Math.min(10000, Number.parseInt(input || "1", 10) || 1),
  );
  const result = await getCompanies(
    new URLSearchParams({ page: String(page), limit: "24" }),
  );
  return (
    <main id="main-content" className="container companies-page">
      <div className="page-heading">
        <div>
          <h1>Find your next team.</h1>
          <p>Explore {result.total} companies and their open roles.</p>
        </div>
      </div>
      {result.items.length === 0 && (
        <div className="empty-state">
          <h2>No companies here yet.</h2>
          <p>Try the first page or check back for more teams.</p>
          <Link className="primary-button" href="/companies">
            Explore companies
          </Link>
        </div>
      )}
      <div className="companies-grid">
        {result.items.map((company) => (
          <article className="company-card" key={company.id}>
            <CompanyLogo company={companyPresentation(company)} large />
            <h2>{company.name}</h2>
            <p>Explore opportunities at {company.name}.</p>
            <div className="company-card-footer">
              <span>{company._count?.jobs ?? 0} open jobs</span>
              <Link
                href={`/jobs?q=${encodeURIComponent(company.name)}`}
                aria-label={`View jobs at ${company.name}`}
              >
                View jobs <Icon name="arrow" size={17} />
              </Link>
            </div>
          </article>
        ))}
      </div>
      {result.pages > 1 && (
        <nav className="pagination" aria-label="Company pages">
          {page > 1 && (
            <Link className="inline-link" href={`/companies?page=${page - 1}`}>
              Previous page
            </Link>
          )}
          <p>
            Page {page} of {result.pages}
          </p>
          {page < result.pages && (
            <Link className="inline-link" href={`/companies?page=${page + 1}`}>
              Next page
            </Link>
          )}
        </nav>
      )}
    </main>
  );
}
