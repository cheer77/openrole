"use client";

import { useState } from "react";
import type { Job } from "@/features/jobs/types";
export function CompanyLogo({
  company,
  large = false,
}: {
  company: Job["company"];
  large?: boolean;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const hasCandidate =
    Boolean(company.logoUrl) && company.logoUrl !== failedUrl;
  const showLogo = hasCandidate && company.logoUrl === loadedUrl;
  return (
    <span
      className={`company-logo ${large ? "company-logo-large" : ""} ${showLogo ? "company-logo-has-image" : "company-logo-missing"}`}
      style={{ color: company.color, background: company.background }}
      role="img"
      aria-label={
        showLogo
          ? `${company.name} logo`
          : `${company.name} logo unavailable`
      }
    >
      {hasCandidate && (
        // The URL is owner-controlled and can use any company domain, so a
        // fixed next/image remote allowlist would prevent new company logos.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className={showLogo ? "company-logo-image-loaded" : ""}
          src={company.logoUrl!}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onLoad={(event) => {
            if (event.currentTarget.naturalWidth > 0)
              setLoadedUrl(company.logoUrl);
            else setFailedUrl(company.logoUrl);
          }}
          onError={() => setFailedUrl(company.logoUrl)}
        />
      )}
      {!showLogo && (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4.75 20.25V6.75a2 2 0 0 1 2-2h6.5a2 2 0 0 1 2 2v3h2a2 2 0 0 1 2 2v8.5M8.25 8.25h3.5M8.25 11.75h3.5M8.25 15.25h3.5M8.5 20.25v-2h3v2M15.25 13.25h1.5M15.25 16.25h1.5M3 20.25h18" />
        </svg>
      )}
    </span>
  );
}
