"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
export default function ErrorPage({ reset }: { reset: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <main id="main-content" className="container empty-state not-found">
      <h1>Something interrupted your search.</h1>
      <p>Please try again to get back to exploring roles.</p>
      <button
        type="button"
        className="primary-button"
        disabled={pending}
        onClick={() =>
          startTransition(() => {
            router.refresh();
            reset();
          })
        }
      >
        {pending ? "Retrying…" : "Try again"}
      </button>
      <Link href="/jobs" className="inline-link">
        Back to all jobs
      </Link>
    </main>
  );
}
