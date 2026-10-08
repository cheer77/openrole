import { setTimeout as delay } from "node:timers/promises";
import { z } from "zod";
import { fetchJson, type FetchJson } from "./http.js";
import { normalize, httpUrl, type NormalizedJob } from "./normalize.js";
import { parseIdentifier } from "./source-config.js";
import type { JobProvider } from "./providers.js";

const pageSchema = z.object({
  offset: z.number().int().nonnegative(),
  totalFound: z.number().int().nonnegative().max(20000),
  content: z.array(z.object({ id: z.string().min(1) })).max(100),
});
const section = z.object({ title: z.string().optional(), text: z.string() });
const detailSchema = z.object({
  id: z.string(),
  name: z.string(),
  active: z.boolean(),
  visibility: z.enum(["PUBLIC", "INTERNAL"]).optional(),
  postingUrl: httpUrl,
  applyUrl: httpUrl,
  releasedDate: z.string().datetime({ offset: true }).optional(),
  company: z.object({ identifier: z.string() }),
  location: z.object({
    city: z.string().optional(),
    country: z.string().optional(),
    region: z.string().optional(),
    fullLocation: z.string().optional(),
    remote: z.boolean().optional(),
    hybrid: z.boolean().optional(),
  }),
  typeOfEmployment: z.object({ label: z.string() }).optional(),
  jobAd: z.object({
    sections: z.object({
      companyDescription: section.optional(),
      jobDescription: section,
      qualifications: section.optional(),
      additionalInformation: section.optional(),
    }),
  }),
});

export class SmartRecruitersProvider implements JobProvider {
  constructor(
    private readonly get: FetchJson = fetchJson,
    private readonly pause: () => Promise<unknown> = () => delay(250),
  ) {}

  async fetch(identifier: string) {
    const board = parseIdentifier("SMARTRECRUITERS", identifier);
    const base = `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(board)}/postings`;
    const deadline = Date.now() + 25 * 60 * 1000;
    const request = async (url: string) => {
      if (Date.now() >= deadline)
        throw new Error(
          "SmartRecruiters snapshot exceeded 25 minute fetch budget",
        );
      await this.pause();
      return this.get(url);
    };
    const ids: string[] = [];
    let total: number | undefined;
    do {
      const page = pageSchema.parse(
        await request(`${base}?limit=100&offset=${ids.length}`),
      );
      total ??= page.totalFound;
      if (
        page.offset !== ids.length ||
        total !== page.totalFound ||
        (!page.content.length && ids.length !== total)
      )
        throw new Error("Incomplete or changing SmartRecruiters snapshot");
      ids.push(...page.content.map((item) => item.id));
      if (ids.length > total || new Set(ids).size !== ids.length)
        throw new Error("Duplicate or unexpected SmartRecruiters postings");
    } while (ids.length < total);

    // Sequential requests keep two workers below the provider's 10 requests/s limit.
    // Never follow response `ref` URLs: all requests stay on the fixed API origin.
    const jobs: NormalizedJob[] = [];
    for (const id of ids) {
      const job = detailSchema.parse(
        await request(`${base}/${encodeURIComponent(id)}`),
      );
      if (
        job.id !== id ||
        job.company.identifier.toLowerCase() !== board.toLowerCase()
      )
        throw new Error("SmartRecruiters posting identity mismatch");
      if (!job.active || job.visibility === "INTERNAL")
        throw new Error(
          "SmartRecruiters posting changed during import; retry snapshot",
        );
      const location = job.location;
      jobs.push(
        normalize({
          externalId: id,
          title: job.name,
          description: Object.values(job.jobAd.sections)
            .filter(Boolean)
            .map((s) => `${s!.title ?? ""}\n${s!.text}`)
            .join("\n\n"),
          location:
            location.fullLocation ||
            [location.city, location.region, location.country]
              .filter(Boolean)
              .join(", "),
          city: location.city,
          country: location.country?.toUpperCase(),
          region: location.region,
          workplace: location.hybrid
            ? "hybrid"
            : location.remote
              ? "remote"
              : undefined,
          employmentType: job.typeOfEmployment?.label,
          sourceUrl: job.postingUrl,
          applyUrl: job.applyUrl,
          publishedAt: job.releasedDate,
        }),
      );
    }
    return jobs;
  }
}
