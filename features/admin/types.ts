export interface Metrics {
  visitors: number;
  sessions: number;
  pageViews: number;
  jobViews: number;
  applyClicks: number;
  ctr: number;
}
export interface TopJob {
  id: string;
  title: string;
  company: string;
  jobViews: number;
  applyClicks: number;
  ctr: number;
}
export interface Report {
  range: string;
  start: string;
  end: string;
  summary: Metrics;
  series: (Metrics & { date: string })[];
  countries: (Metrics & { country: string | null })[];
  cities: (Metrics & {
    city: string;
    country: string | null;
    region: string | null;
  })[];
  traffic: (Metrics & { source: string })[];
  devices: { name: string; visitors: number }[];
  browsers: { name: string; visitors: number }[];
  operatingSystems: { name: string; visitors: number }[];
  campaigns: {
    source: string | null;
    medium: string | null;
    campaign: string | null;
    visitors: number;
  }[];
  referrers: { name: string; visitors: number }[];
  topViewed: TopJob[];
  topApplied: TopJob[];
  topCtr: TopJob[];
  inventory: Record<string, number>;
  visitorsToday: number;
  visitorsWeek: number;
  visitorsMonth: number;
}
export interface AdminItem {
  id: string;
  name?: string;
  title?: string;
  slug?: string;
  description?: string;
  shortDescription?: string;
  category?: string;
  location?: string;
  remoteType?: string;
  experienceLevel?: string | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  currency?: string | null;
  technologies?: string[];
  applyUrl?: string;
  enabled?: boolean;
  website?: string | null;
  careerUrl?: string | null;
  country?: string | null;
  type?: string;
  sourceIdentifier?: string;
  companyId?: string;
  company?: { name: string; enabled: boolean };
  source?: { name: string };
  status?: string;
  manualOverride?: boolean;
  statusOverride?: boolean;
  lastSyncAt?: string | null;
  lastSuccessfulSync?: string | null;
  lastError?: string | null;
  startedAt?: string;
  finishedAt?: string | null;
  jobsFound?: number;
  jobsCreated?: number;
  jobsUpdated?: number;
  jobsClosed?: number;
  error?: string | null;
  _count?: { jobs: number; sources?: number };
}
export type Resource = "jobs" | "companies" | "sources" | "logs";
export interface Collection {
  items: AdminItem[];
  total: number;
  page: number;
  pages: number;
}
