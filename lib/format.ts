import type { Job } from "@/features/jobs/types";
const knownRegions: Record<string, string> = {
  "saxony-anhalt": "DE",
  bavaria: "DE",
  "baden-württemberg": "DE",
  "north rhine-westphalia": "DE",
  "lower saxony": "DE",
  "rhineland-palatinate": "DE",
  "schleswig-holstein": "DE",
  "mecklenburg-western pomerania": "DE",
  thuringia: "DE",
};

export function countryFromLocation(location: string | null | undefined): string | null {
  const region = location?.split(/[,;|]/).at(-1)?.trim().toLocaleLowerCase();
  return region ? knownRegions[region] ?? null : null;
}

export function formatSalary(salary: Job["salary"]): string {
  if (!salary) return "Salary not listed";
  const format = (amount: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: salary.currency,
      maximumFractionDigits: 0,
    }).format(amount);
  if (salary.min === null)
    return salary.max === null
      ? "Salary not listed"
      : `Up to ${format(salary.max)}`;
  if (salary.max === null) return `From ${format(salary.min)}`;
  return salary.min === salary.max
    ? format(salary.min)
    : `${format(salary.min)}–${format(salary.max)}`;
}
export function timeAgo(date: string, now: number): string {
  const minutes = Math.max(
    1,
    Math.floor((now - new Date(date).getTime()) / 60000),
  );
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours}h ago` : `${Math.floor(hours / 24)}d ago`;
}
export function locationLabel(job: Pick<Job, "location" | "country">): string {
  const location = job.location.trim();
  if (!job.country) return location;
  const country = /^[A-Z]{2}$/.test(job.country)
    ? new Intl.DisplayNames(["en"], { type: "region" }).of(job.country) ?? job.country
    : job.country;
  const parts = location.split(/[,;|]/).map((part) => part.trim().toLowerCase());
  if (parts.includes(country.toLowerCase()) || parts.includes(job.country.toLowerCase())) return location;
  if (!location || location === "Not specified" || location === "Location not specified") return country;
  return `${location}, ${country}`;
}
