import { z } from "zod";
import { normalize, httpUrl, type NormalizedJob } from "./normalize.js";
import { fetchJson, type FetchJson } from "./http.js";
import { parseIdentifier } from "./source-config.js";
import { SmartRecruitersProvider } from "./smartrecruiters.js";
import { PersonioProvider, RecruiteeProvider } from "./xml-providers.js";
export { fetchJson, type FetchJson } from "./http.js";
export { sourceIdentifierSchema } from "./source-config.js";

export interface JobProvider {
  fetch(identifier: string): Promise<NormalizedJob[]>;
}

const greenhouseSchema = z.object({
  jobs: z
    .array(
      z.object({
        id: z.union([z.string(), z.number()]),
        internal_job_id: z.number().nullable().optional(),
        title: z.string(),
        content: z.string(),
        absolute_url: httpUrl,
        location: z.object({ name: z.string() }),
      }),
    )
    .max(20000),
  meta: z.object({ total: z.number().int() }),
});

export class GreenhouseProvider implements JobProvider {
  constructor(private readonly get: FetchJson = fetchJson) {}
  async fetch(identifier: string) {
    const board = parseIdentifier("GREENHOUSE", identifier);
    const body = greenhouseSchema.parse(
      await this.get(
        `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(board)}/jobs?content=true`,
      ),
    );
    if (body.meta.total !== body.jobs.length)
      throw new Error("Incomplete Greenhouse snapshot");
    return body.jobs
      .filter((job) => job.internal_job_id !== null)
      .map((job) =>
        normalize({
          externalId: String(job.id),
          title: job.title,
          description: job.content,
          location: job.location.name,
          sourceUrl: job.absolute_url,
          applyUrl: job.absolute_url,
          // updated_at is not a publication date. Do not use it for freshness.
        }),
      );
  }
}

const leverSchema = z
  .array(
    z.object({
      id: z.string(),
      text: z.string(),
      hostedUrl: httpUrl,
      applyUrl: httpUrl,
      descriptionPlain: z.string().optional(),
      description: z.string().optional(),
      additionalPlain: z.string().optional(),
      lists: z
        .array(z.object({ text: z.string(), content: z.string() }))
        .optional(),
      categories: z.object({
        location: z.string().optional(),
        commitment: z.string().optional(),
      }),
      workplaceType: z.string().optional(),
      createdAt: z.number().optional(),
      salaryRange: z
        .object({
          min: z.number().nullish(),
          max: z.number().nullish(),
          currency: z.string().nullish(),
          interval: z.string().nullish(),
        })
        .optional(),
    }),
  )
  .max(100);

export class LeverProvider implements JobProvider {
  constructor(private readonly get: FetchJson = fetchJson) {}
  async fetch(identifier: string) {
    parseIdentifier("LEVER", identifier);
    const eu = identifier.startsWith("eu:");
    const board = encodeURIComponent(eu ? identifier.slice(3) : identifier);
    const jobs: NormalizedJob[] = [];
    for (let skip = 0; skip < 20000; skip += 100) {
      const page = leverSchema.parse(
        await this.get(
          `https://api.lever.${eu ? "eu" : "co"}/v0/postings/${board}?mode=json&skip=${skip}&limit=100`,
        ),
      );
      jobs.push(
        ...page.map((job) =>
          normalize({
            externalId: job.id,
            title: job.text,
            description: [
              job.descriptionPlain ?? job.description,
              ...(job.lists ?? []).map(
                (list) => `${list.text}\n${list.content}`,
              ),
              job.additionalPlain,
            ]
              .filter(Boolean)
              .join("\n\n"),
            location: job.categories.location,
            workplace: job.workplaceType,
            employmentType: job.categories.commitment,
            publishedAt: job.createdAt,
            sourceUrl: job.hostedUrl,
            applyUrl: job.applyUrl,
            salary: job.salaryRange,
          }),
        ),
      );
      if (page.length < 100) return jobs;
    }
    throw new Error("Lever pagination safety limit reached");
  }
}

const ashbySchema = z.object({
  jobs: z
    .array(
      z.object({
        id: z.string().optional(),
        title: z.string(),
        location: z.string().optional(),
        isListed: z.boolean(),
        isRemote: z.boolean().nullish(),
        workplaceType: z.string().nullish(),
        descriptionPlain: z.string().optional(),
        descriptionHtml: z.string().optional(),
        publishedAt: z.string().datetime({ offset: true }).optional(),
        employmentType: z.string().optional(),
        jobUrl: httpUrl,
        applyUrl: httpUrl,
        address: z
          .object({
            postalAddress: z
              .object({
                addressLocality: z.string().nullish(),
                addressRegion: z.string().nullish(),
                addressCountry: z.string().nullish(),
              })
              .nullish(),
          })
          .nullish(),
        compensation: z
          .object({
            summaryComponents: z
              .array(
                z.object({
                  compensationType: z.string(),
                  interval: z.string(),
                  currencyCode: z.string().nullish(),
                  minValue: z.number().nullish(),
                  maxValue: z.number().nullish(),
                }),
              )
              .optional(),
          })
          .optional(),
      }),
    )
    .max(20000),
});

export class AshbyProvider implements JobProvider {
  constructor(private readonly get: FetchJson = fetchJson) {}
  async fetch(identifier: string) {
    const board = parseIdentifier("ASHBY", identifier);
    const body = ashbySchema.parse(
      await this.get(
        `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(board)}?includeCompensation=true`,
      ),
    );
    return body.jobs
      .filter((job) => job.isListed)
      .map((job) => {
        const salary = job.compensation?.summaryComponents?.find(
          (item) =>
            item.compensationType === "Salary" && item.interval === "1 YEAR",
        );
        const address = job.address?.postalAddress;
        return normalize({
          externalId:
            job.id ??
            new URL(job.jobUrl).pathname.replace(/\/$/, "").split("/").pop()!,
          title: job.title,
          description: job.descriptionPlain ?? job.descriptionHtml ?? "",
          location: job.location,
          workplace: job.workplaceType ?? (job.isRemote ? "Remote" : undefined),
          city: address?.addressLocality,
          country: address?.addressCountry,
          region: address?.addressRegion,
          sourceUrl: job.jobUrl,
          applyUrl: job.applyUrl,
          publishedAt: job.publishedAt,
          employmentType: job.employmentType,
          salary: salary
            ? {
                min: salary.minValue,
                max: salary.maxValue,
                currency: salary.currencyCode,
                interval: salary.interval,
              }
            : undefined,
        });
      });
  }
}

export function getProvider(type: string): JobProvider {
  if (type === "GREENHOUSE") return new GreenhouseProvider();
  if (type === "LEVER") return new LeverProvider();
  if (type === "ASHBY") return new AshbyProvider();
  if (type === "SMARTRECRUITERS") return new SmartRecruitersProvider();
  if (type === "PERSONIO") return new PersonioProvider();
  if (type === "RECRUITEE") return new RecruiteeProvider();
  throw new Error(`Source type ${type} cannot be synchronized`);
}
