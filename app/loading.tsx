import { JobSkeleton } from "@/components/job-skeleton";
export default function Loading() {
  return (
    <main id="main-content" className="container loading-state">
      <JobSkeleton />
    </main>
  );
}
