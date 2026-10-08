import { XMLParser, XMLValidator } from "fast-xml-parser";
import { decodeXML } from "entities";
import { z } from "zod";
import { fetchText, type FetchText } from "./http.js";
import { normalize, httpUrl } from "./normalize.js";
import { parseIdentifier } from "./source-config.js";
import type { JobProvider } from "./providers.js";

function parseXml(xml: string): unknown {
  if (
    Buffer.byteLength(xml) > 20 * 1024 * 1024 ||
    /<!\s*(?:DOCTYPE|ENTITY)/i.test(xml)
  )
    throw new Error("Unsafe or oversized XML feed");
  if (XMLValidator.validate(xml) !== true) throw new Error("Invalid XML feed");
  return new XMLParser({
    parseTagValue: false,
    processEntities: false,
    tagValueProcessor: (_name, value) => decodeXML(value),
    jPath: true,
    isArray: (_name, path) =>
      typeof path === "string" &&
      [
        "workzag-jobs.position",
        "workzag-jobs.position.jobDescriptions.jobDescription",
        "workzag-jobs.position.additionalOffices.office",
        "offers.offer",
      ].includes(path),
  }).parse(xml) as unknown;
}

const personioSchema = z.object({
  "workzag-jobs": z.union([
    z.literal(""),
    z
      .object({
        position: z
          .array(
            z.object({
              id: z.string().regex(/^\d+$/),
              name: z.string(),
              office: z.string().optional(),
              additionalOffices: z
                .union([
                  z.literal(""),
                  z.object({ office: z.array(z.string()).optional() }),
                ])
                .optional(),
              jobDescriptions: z.object({
                jobDescription: z
                  .array(z.object({ name: z.string(), value: z.string() }))
                  .min(1),
              }),
              employmentType: z.string().optional(),
              schedule: z.string().optional(),
            }),
          )
          .max(20000)
          .optional(),
      })
      .strict(),
  ]),
});

export class PersonioProvider implements JobProvider {
  constructor(private readonly get: FetchText = fetchText) {}
  async fetch(identifier: string) {
    parseIdentifier("PERSONIO", identifier);
    const de = identifier.startsWith("de:");
    const board = de ? identifier.slice(3) : identifier;
    const base = `https://${board}.jobs.personio.${de ? "de" : "com"}`;
    const root = personioSchema.parse(
      parseXml(await this.get(`${base}/xml?language=en`)),
    )["workzag-jobs"];
    return (root === "" ? [] : (root.position ?? [])).map((job) =>
      normalize({
        externalId: job.id,
        title: job.name,
        description: job.jobDescriptions.jobDescription
          .map((s) => `${s.name}\n${s.value}`)
          .join("\n\n"),
        location: [
          job.office,
          ...(typeof job.additionalOffices === "object"
            ? (job.additionalOffices.office ?? [])
            : []),
        ]
          .filter(Boolean)
          .join("; "),
        employmentType: [job.schedule, job.employmentType]
          .filter(Boolean)
          .join(" / "),
        sourceUrl: `${base}/job/${job.id}?language=en`,
        applyUrl: `${base}/job/${job.id}?language=en#apply`,
        // Personio createdAt is record creation, not a documented publication timestamp.
      }),
    );
  }
}

const xmlBoolean = z.enum(["true", "false", ""]).optional();
const amount = z
  .string()
  .regex(/^(?:\d+(?:\.\d+)?)?$/)
  .transform((value) => (value === "" ? null : Number(value)))
  .optional();
const recruiteeSchema = z.object({
  offers: z.union([
    z.literal(""),
    z
      .object({
        offer: z
          .array(
            z.object({
              id: z.string().regex(/^\d+$/),
              title: z.string(),
              description: z.string(),
              requirements: z.string().optional(),
              location: z.string().optional(),
              city: z.string().optional(),
              country_code: z.string().optional(),
              remote: xmlBoolean,
              hybrid: xmlBoolean,
              on_site: xmlBoolean,
              employment_type_code: z.string().optional(),
              careers_url: httpUrl,
              apply_url: httpUrl,
              published_at: z.string().optional(),
              salary: z
                .union([
                  z.literal(""),
                  z.object({
                    min: amount,
                    max: amount,
                    currency: z.string().optional(),
                    period: z.string().optional(),
                  }),
                ])
                .optional(),
            }),
          )
          .max(20000)
          .optional(),
      })
      .strict(),
  ]),
});

export class RecruiteeProvider implements JobProvider {
  constructor(private readonly get: FetchText = fetchText) {}
  async fetch(identifier: string) {
    const board = parseIdentifier("RECRUITEE", identifier);
    const root = recruiteeSchema.parse(
      parseXml(
        await this.get(`https://${board}.recruitee.com/api/feeds/offers.xml`),
      ),
    ).offers;
    return (root === "" ? [] : (root.offer ?? [])).map((job) =>
      normalize({
        externalId: job.id,
        title: job.title,
        description: [job.description, job.requirements]
          .filter(Boolean)
          .join("\n\n"),
        location: job.location,
        city: job.city,
        country: job.country_code?.toUpperCase(),
        workplace:
          job.hybrid === "true"
            ? "hybrid"
            : job.remote === "true"
              ? "remote"
              : job.on_site === "true"
                ? "onsite"
                : undefined,
        employmentType: job.employment_type_code,
        sourceUrl: job.careers_url,
        applyUrl: job.apply_url,
        publishedAt: job.published_at || undefined,
        salary:
          typeof job.salary === "object"
            ? { ...job.salary, interval: job.salary.period }
            : undefined,
      }),
    );
  }
}
