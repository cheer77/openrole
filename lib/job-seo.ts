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
  const publishedAt = job.publishedAt && new Date(job.publishedAt);
  const description = job.description.join("\n\n").trim();
  const organization = job.company.name.trim();
  const locations = job.structuredLocations.filter((location) => /^[A-Z]{2}$/.test(location.country));
  if (!publishedAt || Number.isNaN(publishedAt.getTime()) || !job.title.trim() || !description || !organization)
    return null;
  if (!locations.length) return null;
  const salary = job.salary;
  const employment = job.employmentType?.toLowerCase();
  const employmentType = employment?.includes("full") ? "FULL_TIME"
    : employment?.includes("part") ? "PART_TIME"
    : employment?.includes("contract") ? "CONTRACTOR"
    : employment?.includes("intern") ? "INTERN" : undefined;
  const place = (location: (typeof locations)[number]) => ({
    "@type": "Place",
    address: {
      "@type": "PostalAddress",
      addressCountry: location.country,
      ...(location.city ? { addressLocality: location.city } : {}),
      ...(location.region ? { addressRegion: location.region } : {}),
    },
  });
  const uniqueCountries = [...new Set(locations.map((location) => location.country))];
  return {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.title,
    description,
    url,
    directApply: false,
    hiringOrganization: {
      "@type": "Organization",
      name: organization,
      ...(safeWebUrl(job.company.website) ? { sameAs: safeWebUrl(job.company.website) } : {}),
    },
    datePosted: job.publishedAt,
    ...(employmentType ? { employmentType } : {}),
    ...(job.remoteType !== "REMOTE" ? {
      jobLocation: locations.map(place),
    } : {}),
    ...(job.remoteType === "REMOTE" ? {
      jobLocationType: "TELECOMMUTE",
      applicantLocationRequirements: uniqueCountries.map((country) => ({
        "@type": "Country", name: country,
      })),
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
