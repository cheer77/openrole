export const categories = [
  "Frontend",
  "Backend",
  "Full Stack",
  "Mobile",
  "DevOps",
  "QA",
  "Design",
  "Product",
  "Project Management",
  "Data",
  "AI / ML",
  "Marketing",
  "Sales",
  "Other",
] as const;
export const locations = [
  "Worldwide",
  "Europe",
  "EU",
  "Spain",
  "Germany",
  "UK",
  "USA",
  "Other",
] as const;
export const workTypes = ["Remote", "Hybrid", "On-site"] as const;
export const experiences = ["Junior", "Middle", "Senior", "Lead"] as const;
export const technologies = [
  "React",
  "Next.js",
  "TypeScript",
  "JavaScript",
  "Node.js",
  "NestJS",
  "Vue",
  "Angular",
  "Python",
  "Java",
  "C#",
  "Go",
  "AWS",
  "Docker",
  "Kubernetes",
] as const;
export const currencies = ["USD", "EUR", "GBP"] as const;
export type Category = (typeof categories)[number];
export type Location = (typeof locations)[number];
export type WorkType = (typeof workTypes)[number];
export type Experience = (typeof experiences)[number];
export type Currency = (typeof currencies)[number];
export interface Job {
  id: string;
  slug: string;
  status: "ACTIVE" | "CLOSED";
  title: string;
  company: {
    slug: string;
    name: string;
    logoUrl: string | null;
    initials: string;
    color: string;
    background: string;
    description: string;
    website: string;
  };
  category: string;
  location: string;
  city?: string;
  country?: string | null;
  region?: string | null;
  remoteType: "REMOTE" | "HYBRID" | "ON_SITE" | "UNKNOWN";
  employmentType?: string | null;
  workType: WorkType | "Not specified";
  experience: string;
  salary?: { min: number | null; max: number | null; currency: string };
  technologies: string[];
  publishedAt: string | null;
  firstSeenAt: string;
  closedAt?: string | null;
  sourceUrl: string;
  shortDescription: string;
  description: string[];
  descriptionHtml?: string | null;
  eligibility: string;
  applyUrl: string;
}
export interface Filters {
  q: string;
  category: string;
  location: string;
  workType: string;
  experience: string;
  posted: string;
  salaryMin: string;
  salaryMax: string;
  currency: string;
  tech: string[];
  sort: string;
  page: number;
}
