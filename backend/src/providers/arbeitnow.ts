import { z } from "zod";
import { fetchJson, type FetchJson } from "./http.js";
import { httpUrl, normalize } from "./normalize.js";
import { parseIdentifier } from "./source-config.js";
import type { JobProvider } from "./providers.js";

// Arbeitnow currently returns more than 300 jobs on a page. Keep a generous
// safety bound, while the shared HTTP client caps each response at 20 MB.
const maxPageItems = 5000;
const maxSnapshotItems = 50000;
const schema = z.object({
  data: z.array(z.object({
    slug: z.string().min(1), company_name: z.string().min(1),
    title: z.string(), description: z.string(), remote: z.boolean(),
    url: httpUrl, tags: z.array(z.string()).optional(),
    job_types: z.array(z.string()).optional(), location: z.string().optional(),
    created_at: z.number().optional(),
  })).max(maxPageItems),
  links: z.object({ next: httpUrl.nullable() }),
});

export class ArbeitnowProvider implements JobProvider {
  constructor(private readonly get: FetchJson = fetchJson) {}
  async fetch(identifier: string) {
    parseIdentifier("ARBEITNOW", identifier);
    const jobs = [];
    const ids = new Set<string>();
    for (let page = 1; page <= 200; page++) {
      const body = schema.parse(await this.get(`https://www.arbeitnow.com/api/job-board-api?page=${page}`));
      let newItems = 0;
      for (const item of body.data) {
        // Offset pagination can overlap when jobs are added or removed while
        // the snapshot is being fetched. Keep one record per stable slug.
        if (ids.has(item.slug)) continue;
        ids.add(item.slug);
        newItems++;
        if (ids.size > maxSnapshotItems) throw new Error("Arbeitnow snapshot safety limit reached");
        jobs.push(normalize({
          externalId: item.slug, title: item.title,
          companyName: item.company_name,
          description: item.description,
          location: item.location,
          workplace: item.remote ? "Remote" : undefined,
          employmentType: item.job_types?.join(", "),
          sourceCategories: item.tags,
          technologies: item.tags,
          publishedAt: item.created_at == null ? null : item.created_at * 1000,
          sourceUrl: item.url, applyUrl: item.url,
        }));
      }
      if (page > 1 && body.data.length && newItems === 0)
        throw new Error("Arbeitnow pagination repeated a page without new jobs");
      if (!body.links.next) return jobs;
      const next = new URL(body.links.next);
      if (next.origin !== "https://www.arbeitnow.com" || next.pathname !== "/api/job-board-api" || next.searchParams.get("page") !== String(page + 1))
        throw new Error("Unexpected Arbeitnow pagination link");
      if (!body.data.length) throw new Error("Incomplete Arbeitnow pagination");
    }
    throw new Error("Arbeitnow pagination safety limit reached");
  }
}
