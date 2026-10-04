export function JobSkeleton() {
  return (
    <div className="job-list" role="status" aria-label="Loading jobs">
      <span className="sr-only">Loading opportunities…</span>
      {Array.from({ length: 4 }, (_, index) => (
        <div className="job-card skeleton-card" aria-hidden="true" key={index}>
          <span className="skeleton-line skeleton-title" />
          <span className="skeleton-line" />
          <span className="skeleton-line skeleton-short" />
        </div>
      ))}
    </div>
  );
}
