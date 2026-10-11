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
  "Cybersecurity",
  "IT & Infrastructure",
  "Software Engineering",
  "Engineering",
  "Construction & Trades",
  "Manufacturing & Production",
  "Logistics & Supply Chain",
  "Retail & Hospitality",
  "Healthcare",
  "Education",
  "Finance & Accounting",
  "Legal & Compliance",
  "HR & Recruiting",
  "Customer Service",
  "Marketing",
  "Sales",
  "Operations & Administration",
  "Consulting",
  "Science & Research",
  "Other",
] as const;
export const employmentKinds = [
  "Full-time", "Part-time", "Contract", "Temporary", "Freelance",
  "Internship", "Apprenticeship", "Working student",
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
const technicalCategories = new Set<string>([
  "Frontend", "Backend", "Full Stack", "Mobile", "DevOps", "QA",
  "Data", "AI / ML", "Cybersecurity", "IT & Infrastructure",
  "Software Engineering",
]);
export function supportsTechnologyFilter(category: string): boolean {
  return !category || technicalCategories.has(category);
}
export const currencies = ["USD", "EUR", "GBP", "CAD", "AUD", "CHF", "PLN", "SEK", "NOK", "DKK", "INR", "BRL"] as const;
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
  employmentKind?: string | null;
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
  companyName: string;
  place: string;
  employmentKind: string;
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
