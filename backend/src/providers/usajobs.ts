import { z } from "zod";
import { fetchTextWithHeaders } from "./http.js";
import { httpUrl, normalize } from "./normalize.js";
import { parseIdentifier } from "./source-config.js";
import type { JobProvider } from "./providers.js";

const text = z.string();
const descriptor = z.object({
  PositionTitle: text,
  PositionURI: httpUrl,
  ApplyURI: z.array(httpUrl).min(1),
  PositionLocationDisplay: text.optional(),
  PositionLocation: z.array(z.object({
    CountryCode: text.optional(),
    CountrySubDivisionCode: text.optional(),
    CityName: text.optional(),
  })).optional(),
  OrganizationName: text,
  QualificationSummary: text.optional(),
  PublicationStartDate: text.optional(),
  PositionSchedule: z.array(z.object({ Name: text })).optional(),
  JobCategory: z.array(z.object({ Name: text })).optional(),
  PositionRemuneration: z.array(z.object({
    MinimumRange: z.union([text, z.number()]).optional(),
    MaximumRange: z.union([text, z.number()]).optional(),
    RateIntervalCode: text.optional(),
  })).optional(),
  UserArea: z.object({ Details: z.object({
    JobSummary: text.optional(),
    MajorDuties: text.optional(),
    Requirements: text.optional(),
    Education: text.optional(),
    HowToApply: text.optional(),
  }).optional() }).optional(),
});
const pageSchema = z.object({ SearchResult: z.object({
  SearchResultCountAll: z.number().int().nonnegative(),
  SearchResultItems: z.array(z.object({
    MatchedObjectId: z.union([text, z.number()]),
    MatchedObjectDescriptor: descriptor,
  })).max(500),
}) });

export class USAJobsProvider implements JobProvider {
  constructor(private readonly get: (url: string, headers: Record<string, string>) => Promise<unknown> = async (url, headers) => JSON.parse(await fetchTextWithHeaders(url, headers)) as unknown) {}
  private headers(identifier: string) {
    parseIdentifier("USAJOBS", identifier);
    const key = process.env.USAJOBS_API_KEY;
    const email = process.env.USAJOBS_USER_AGENT;
    if (!key || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      throw new Error("USAJOBS_API_KEY and USAJOBS_USER_AGENT (email) are required");
    return { "User-Agent": email, "Authorization-Key": key };
  }
  async testConnection(identifier: string) {
    pageSchema.parse(await this.get("https://data.usajobs.gov/api/search?WhoMayApply=Public&ResultsPerPage=1&Page=1", this.headers(identifier)));
  }
  async fetch(identifier: string) {
    const headers = this.headers(identifier);
    const jobs = [];
    let total: number | undefined;
    for (let page = 1; page <= 200; page++) {
      const url = `https://data.usajobs.gov/api/search?WhoMayApply=Public&Fields=Full&ResultsPerPage=500&Page=${page}`;
      const body = pageSchema.parse(await this.get(url, headers));
      const result = body.SearchResult;
      if (total === undefined) total = result.SearchResultCountAll;
      if (total !== result.SearchResultCountAll || (!result.SearchResultItems.length && jobs.length < total))
        throw new Error("Incomplete USAJOBS snapshot");
      for (const item of result.SearchResultItems) {
        const d = item.MatchedObjectDescriptor;
        const loc = d.PositionLocation?.[0];
        const details = d.UserArea?.Details;
        const remuneration = d.PositionRemuneration?.find((entry) => entry.RateIntervalCode === "PA");
        const description = [details?.JobSummary, details?.MajorDuties, details?.Requirements, details?.Education, details?.HowToApply, d.QualificationSummary].filter(Boolean).join("\n\n");
        if (!description) throw new Error(`USAJOBS job ${item.MatchedObjectId} has no description`);
        jobs.push(normalize({
          externalId: String(item.MatchedObjectId),
          title: d.PositionTitle,
          description,
          companyName: d.OrganizationName,
          sourceCategories: d.JobCategory?.map((category) => category.Name),
          location: d.PositionLocationDisplay,
          city: loc?.CityName,
          region: loc?.CountrySubDivisionCode,
          country: loc?.CountryCode,
          employmentType: d.PositionSchedule?.map((v) => v.Name).join(", "),
          publishedAt: d.PublicationStartDate,
          salary: remuneration ? {
            min: remuneration.MinimumRange ? Number(remuneration.MinimumRange) : null,
            max: remuneration.MaximumRange ? Number(remuneration.MaximumRange) : null,
            currency: "USD", interval: "year",
          } : undefined,
          sourceUrl: d.PositionURI,
          applyUrl: d.ApplyURI[0]!,
        }));
      }
      if (jobs.length === total) return jobs;
      if (jobs.length > total) throw new Error("USAJOBS returned more jobs than reported");
    }
    throw new Error("USAJOBS pagination safety limit reached");
  }
}
