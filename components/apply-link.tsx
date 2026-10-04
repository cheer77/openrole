import { Icon } from "@/components/icon";

// Stable identifiers for future view/click analytics. Native navigation never waits for tracking.
export function ApplyLink({ jobId, href }: { jobId: string; href: string }) {
  return (
    <a
      className="primary-button apply-button"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      data-job-id={jobId}
      data-event="apply-click"
    >
      Apply on company website <Icon name="external" size={17} />
    </a>
  );
}
