"use client";
import { track } from "@/lib/analytics-client";
import { Icon } from "@/components/icon";

// Best-effort analytics never prevents or delays native navigation.
export function ApplyLink({ jobId, href }: { jobId: string; href: string }) {
  return (
    <a
      className="primary-button apply-button"
      href={href}
      onClick={() => track("APPLY_CLICK", window.location.pathname, jobId)}
      target="_blank"
      rel="noopener noreferrer"
      data-job-id={jobId}
      data-event="apply-click"
    >
      Apply on company website <Icon name="external" size={17} />
    </a>
  );
}
