"use client";
import Link from "next/link";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main id="main-content" className="container empty-state not-found">
      <h1>Something interrupted your search.</h1>
      <p>Please try again to get back to exploring roles.</p>
      <button type="button" className="primary-button" onClick={reset}>
        Try again
      </button>
      <Link href="/jobs" className="inline-link">
        Back to all jobs
      </Link>
    </main>
  );
}
