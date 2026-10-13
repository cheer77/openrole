"use client";

export default function CompaniesError({ reset }: { reset: () => void }) {
  return (
    <main id="main-content" className="container companies-page">
      <div className="empty-state company-error">
        <h1>We couldn’t load companies.</h1>
        <p>Your search is still in the address bar. Please try again.</p>
        <button className="primary-button" type="button" onClick={reset}>Try again</button>
      </div>
    </main>
  );
}
