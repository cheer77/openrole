import type { Job } from "@/features/jobs/types";
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
export function locationLabel(job: Job): string {
  return job.location;
}
