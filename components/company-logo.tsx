import type { Job } from "@/features/jobs/types";
export function CompanyLogo({
  company,
  large = false,
}: {
  company: Job["company"];
  large?: boolean;
}) {
  return (
    <span
      className={`company-logo ${large ? "company-logo-large" : ""}`}
      style={{ color: company.color, background: company.background }}
      aria-hidden="true"
    >
      {company.initials}
    </span>
  );
}
