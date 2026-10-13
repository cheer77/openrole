import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCompanies, companyPresentation } from "@/lib/api";
import { CompanyLogo } from "@/components/company-logo";
import { Icon } from "@/components/icon";
import { pageNumbers } from "@/lib/api-query";
import { robots } from "@/lib/seo-site";

export const dynamic = "force-dynamic";
type Params = { page?: string | string[]; search?: string | string[]; sort?: string | string[] };
type Sort = "featured" | "activeJobs" | "name" | "nameDesc";
const sortValues = new Set<Sort>(["featured", "activeJobs", "name", "nameDesc"]);
const PAGE_SIZE = 30;

function catalogState(params: Params) {
  const single = (value?: string | string[]) => typeof value === "string" ? value : undefined;
  const parsedPage = Number.parseInt(single(params.page) || "1", 10);
  const requestedSort = single(params.sort);
  return {
    page: Math.max(1, Math.min(10000, parsedPage || 1)),
    search: (single(params.search) || "").trim().slice(0, 150),
    sort: sortValues.has(requestedSort as Sort) ? requestedSort as Sort : "featured" as Sort,
  };
}

function catalogHref({ search, sort, page }: ReturnType<typeof catalogState>) {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (sort !== "featured") params.set("sort", sort);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return `/companies${query ? `?${query}` : ""}`;
}

export async function generateMetadata({ searchParams }: { searchParams: Promise<Params> }): Promise<Metadata> {
  const state = catalogState(await searchParams);
  const indexable = !state.search && state.sort === "featured";
  return {
    title: "Explore companies",
    description: "Explore employers with active opportunities across industries.",
    alternates: { canonical: indexable ? catalogHref(state) : "/companies" },
    robots: robots(indexable && state.page === 1),
  };
}

export default async function CompaniesPage({ searchParams }: { searchParams: Promise<Params> }) {
  const state = catalogState(await searchParams);
  const query = new URLSearchParams({ page: String(state.page), limit: String(PAGE_SIZE), sort: state.sort });
  if (state.search) query.set("search", state.search);
  const result = await getCompanies(query);
  if (result.pages > 0 && state.page > result.pages) {
    redirect(catalogHref({ ...state, page: result.pages }));
  }
  const first = (state.page - 1) * PAGE_SIZE + 1;
  return (
    <main id="main-content" className="container companies-page">
      <header className="page-heading companies-heading">
        <h1>Find your next team.</h1>
        <p>{result.total} {result.total === 1 ? "company" : "companies"} with open jobs{state.search ? " match your search" : ""}.</p>
      </header>
      <form className="company-controls" action="/companies" method="get" role="search" aria-label="Search companies">
        <label className="company-search">
          <Icon name="search" size={19} />
          <span className="sr-only">Company name</span>
          <input type="search" name="search" defaultValue={state.search} placeholder="Search companies by name..." maxLength={150} />
        </label>
        <label className="company-sort">
          <span>Sort by</span>
          <select name="sort" defaultValue={state.sort} aria-label="Sort companies">
            <option value="featured">Featured</option>
            <option value="activeJobs">Most open jobs</option>
            <option value="name">Name A–Z</option>
            <option value="nameDesc">Name Z–A</option>
          </select>
        </label>
        <button className="primary-button company-search-button" type="submit">Search <Icon name="arrow" size={17} /></button>
      </form>
      {result.items.length === 0 ? (
        <div className="empty-state company-empty">
          <span aria-hidden="true"><Icon name="search" size={26} /></span>
          <h2>{state.search ? "No companies match your search." : "No companies here yet."}</h2>
          <p>{state.search ? "Try a shorter name or browse all employers with open jobs." : "Companies with active jobs will appear here."}</p>
          {state.search && <Link className="primary-button" href="/companies">View all companies</Link>}
        </div>
      ) : (
        <ul className="companies-grid" aria-label="Companies with open jobs">
          {result.items.map((company, index) => {
            const tone = [...company.id].reduce((value, character) => value + character.charCodeAt(0), 0) % 2;
            return (
              <li key={company.id}>
                <Link className="company-card" href={`/companies/${company.slug}`} data-company-tone={tone} aria-label={`View ${company._count?.jobs ?? 0} open jobs at ${company.name}`}>
                  <span className="company-card-top">
                    <CompanyLogo company={companyPresentation(company)} eager={index < 6} />
                    <Icon name="arrowUpRight" size={17} strokeWidth={1.8} />
                  </span>
                  <h2>{company.name}</h2>
                  <span className="company-card-count">{company._count?.jobs ?? 0} open jobs</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {result.total > 0 && (
        <div className="pagination company-pagination">
          <p>Showing {first}–{Math.min(state.page * PAGE_SIZE, result.total)} of {result.total} companies</p>
          {result.pages > 1 && <nav aria-label="Company pages">
            {state.page === 1 ? <button type="button" aria-label="Previous page" disabled><Icon name="chevron" style={{ transform: "rotate(180deg)" }} size={15} /></button> : <Link className="pagination-link" href={catalogHref({ ...state, page: state.page - 1 })} aria-label="Previous page"><Icon name="chevron" style={{ transform: "rotate(180deg)" }} size={15} /></Link>}
            {pageNumbers(state.page, result.pages).map((number) => <Link key={number} className={`pagination-link ${number === state.page ? "current" : ""}`} href={catalogHref({ ...state, page: number })} aria-label={`Page ${number}`} aria-current={number === state.page ? "page" : undefined}>{number}</Link>)}
            {state.page >= result.pages ? <button type="button" aria-label="Next page" disabled><Icon name="chevron" size={15} /></button> : <Link className="pagination-link" href={catalogHref({ ...state, page: state.page + 1 })} aria-label="Next page"><Icon name="chevron" size={15} /></Link>}
          </nav>}
        </div>
      )}
    </main>
  );
}
