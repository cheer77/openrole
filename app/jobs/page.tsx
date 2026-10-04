import { Suspense } from "react";
import { connection } from "next/server";
import type { Metadata } from "next";
import { getMockSnapshot } from "@/data/jobs";
import { JobsExplorer } from "@/features/jobs/jobs-explorer";
export const metadata: Metadata = { title: "Find your next role" };
export const dynamic = "force-dynamic";
export default async function JobsPage() {
  await connection();
  const { now, jobs } = getMockSnapshot();
  return (
    <Suspense
      fallback={
        <main id="main-content" className="container loading-state">
          Finding your next opportunity…
        </main>
      }
    >
      <JobsExplorer jobs={jobs} now={now} />
    </Suspense>
  );
}
