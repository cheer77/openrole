export default function CompaniesLoading() {
  return (
    <main id="main-content" className="container companies-page" aria-busy="true">
      <header className="companies-heading">
        <h1>Find your next team.</h1>
        <p>Loading companies with open jobs…</p>
      </header>
      <div className="companies-grid" aria-hidden="true">
        {Array.from({ length: 12 }, (_, index) => (
          <div className="company-card company-skeleton" key={index}>
            <span className="skeleton-line company-skeleton-logo" />
            <span className="skeleton-line" />
            <span className="skeleton-line skeleton-short" />
          </div>
        ))}
      </div>
    </main>
  );
}
