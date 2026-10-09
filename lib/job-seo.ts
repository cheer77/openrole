import type { Job } from "@/features/jobs/types";

export function jobSeoTitle(job: Job) {
  const place = job.location === "Not specified" ? "" : job.location;
  const work = job.remoteType === "REMOTE" ? "Remote" : job.remoteType === "HYBRID" ? "Hybrid" : "";
  return `${job.title} at ${job.company.name}${work || place ? ` | ${[work, place].filter(Boolean).join(" · ")}` : ""}`;
}

export function jobSeoDescription(job: Job) {
  const parts = [`${job.title} at ${job.company.name}.`];
  if (job.location !== "Not specified") parts.push(`${job.remoteType === "REMOTE" ? "Remote in" : "Location:"} ${job.location}.`);
  else if (job.remoteType === "REMOTE") parts.push("Remote role.");
  if (job.technologies.length) parts.push(`${job.technologies.slice(0, 4).join(", ")}.`);
  parts.push("View requirements and apply on the company website.");
  return parts.join(" ");
}

function safeWebUrl(value: string | null | undefined) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password ? url.href : undefined;
  } catch { return undefined; }
}

export function jobPosting(job: Job, url: string) {
  if (job.status !== "ACTIVE") return null;
  const country = job.country && /^[A-Z]{2}$/.test(job.country) ? job.country : null;
  const salary = job.salary;
  const employment = job.employmentType?.toLowerCase();
  const employmentType = employment?.includes("full") ? "FULL_TIME"
    : employment?.includes("part") ? "PART_TIME"
    : employment?.includes("contract") ? "CONTRACTOR"
    : employment?.includes("intern") ? "INTERN" : undefined;
  return {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.title,
    description: job.description.join("\n\n"),
    url,
    directApply: false,
    hiringOrganization: {
      "@type": "Organization",
      name: job.company.name,
      ...(safeWebUrl(job.company.website) ? { sameAs: safeWebUrl(job.company.website) } : {}),
    },
    ...(job.publishedAt ? { datePosted: job.publishedAt } : {}),
    ...(employmentType ? { employmentType } : {}),
    ...(country && job.remoteType !== "REMOTE" ? {
      jobLocation: { "@type": "Place", address: {
        "@type": "PostalAddress", addressCountry: country,
        ...(job.city ? { addressLocality: job.city } : {}),
        ...(job.region ? { addressRegion: job.region } : {}),
      } },
    } : {}),
    ...(country && job.remoteType === "REMOTE" ? {
      jobLocationType: "TELECOMMUTE",
      applicantLocationRequirements: { "@type": "Country", name: country },
    } : {}),
    ...(salary?.currency && (salary.min !== null || salary.max !== null) ? {
      baseSalary: { "@type": "MonetaryAmount", currency: salary.currency,
        value: { "@type": "QuantitativeValue", unitText: "YEAR",
          ...(salary.min !== null ? { minValue: salary.min } : {}),
          ...(salary.max !== null ? { maxValue: salary.max } : {}),
        },
      },
    } : {}),
  };
}

export function safeJsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
