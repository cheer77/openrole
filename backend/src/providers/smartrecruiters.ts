import { setTimeout as delay } from "node:timers/promises";
import { z } from "zod";
import {
  fetchJson,
  ProviderSnapshotChangedError,
  type FetchJson,
} from "./http.js";
import { normalize, escapeHtml, sourceBodyHtml, httpUrl, type NormalizedJob } from "./normalize.js";
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
const listSnapshotAttempts = 3;

function postingDisappeared(error: unknown) {
  return error instanceof Error && /^Provider HTTP (?:404|410)$/.test(error.message);
}

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
    const fetchIds = async () => {
      for (let attempt = 1; ; attempt++) {
        const ids: string[] = [];
        let total: number | undefined;
        try {
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
              throw new ProviderSnapshotChangedError(
                "Incomplete or changing SmartRecruiters snapshot",
              );
            ids.push(...page.content.map((item) => item.id));
            if (ids.length > total || new Set(ids).size !== ids.length)
              throw new ProviderSnapshotChangedError(
                "Duplicate or unexpected SmartRecruiters postings",
              );
          } while (ids.length < total);
          return ids;
        } catch (error) {
          if (
            !(error instanceof ProviderSnapshotChangedError) ||
            attempt >= listSnapshotAttempts
          ) throw error;
        }
      }
    };
    const ids = await fetchIds();

    // Sequential requests keep two workers below the provider's 10 requests/s limit.
    // Never follow response `ref` URLs: all requests stay on the fixed API origin.
    const jobs: NormalizedJob[] = [];
    for (const id of ids) {
      let raw: unknown;
      try {
        raw = await request(`${base}/${encodeURIComponent(id)}`);
      } catch (error) {
        // A posting may be removed after the list page was read. This is a
        // terminal state for that posting, not a failure of the whole board.
        if (postingDisappeared(error)) continue;
        throw error;
      }
      const job = detailSchema.parse(raw);
      if (
        job.id !== id ||
        job.company.identifier.toLowerCase() !== board.toLowerCase()
      )
        throw new Error("SmartRecruiters posting identity mismatch");
      // The public list can retain a posting after its detail has become
      // inactive or internal. Detail visibility is authoritative here.
      if (!job.active || job.visibility === "INTERNAL") continue;
      const location = job.location;
      jobs.push(
        normalize({
          externalId: id,
          title: job.name,
          description: Object.values(job.jobAd.sections)
            .filter(Boolean)
            .map((s) => `${s!.title ?? ""}\n${s!.text}`)
            .join("\n\n"),
          descriptionHtml: Object.values(job.jobAd.sections)
            .filter(Boolean)
            .map((s) => `${s!.title ? `<h2>${escapeHtml(s!.title)}</h2>` : ""}${sourceBodyHtml(s!.text)}`)
            .join("\n"),
          location:
            location.fullLocation ||
            [location.city, location.region, location.country]
              .filter(Boolean)
              .join(", "),
          city: location.city,
          country: location.country?.toUpperCase(),
          region: location.region,
          locations: location.country ? [{
            city: location.city,
            region: location.region,
            country: location.country,
          }] : undefined,
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
