import { z } from "zod";
import { fetchJson, type FetchJson } from "./http.js";
import { normalize } from "./normalize.js";
import { parseIdentifier } from "./source-config.js";
import type { JobProvider } from "./providers.js";

const datasetId = "ea639e28-c0fc-48bf-b5dd-b8899bd43072";
const catalogue = z.object({ success: z.literal(true), result: z.object({
  resources: z.array(z.object({ name: z.string(), url: z.string().url(), format: z.string(), created: z.string().optional() })),
}) });

export async function* csvRows(chunks: AsyncIterable<Uint8Array>): AsyncGenerator<string[]> {
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let afterQuote = false;
  let count = 0;
  const process = function* (value: string): Generator<string[]> {
    for (const c of value) {
      if (afterQuote) {
        if (c === '"') { field += '"'; afterQuote = false; continue; }
        quoted = false;
        afterQuote = false;
        if (c !== "," && c !== "\r" && c !== "\n") throw new Error("Malformed Canada CSV quote");
      }
      if (quoted) {
        if (c === '"') afterQuote = true;
        else field += c;
      } else if (c === '"') {
        if (field) throw new Error("Malformed Canada CSV field");
        quoted = true;
      } else if (c === ",") {
        row.push(field); field = "";
      } else if (c === "\n") {
        row.push(field); field = "";
        if (row.some(Boolean)) yield row;
        row = [];
      } else if (c !== "\r") field += c;
      if (field.length > 200000) throw new Error("Canada CSV field too large");
    }
  };
  for await (const chunk of chunks) {
    count += chunk.byteLength;
    if (count > 150 * 1024 * 1024) throw new Error("Canada CSV exceeds 150 MB");
    yield* process(decoder.decode(chunk, { stream: true }));
  }
  yield* process(decoder.decode());
  if (quoted && !afterQuote) throw new Error("Truncated Canada CSV");
  if (field || row.length) { row.push(field); yield row; }
}

const required = ["Job ID", "Job Title", "Employer", "Description", "Source URL", "Apply URL", "Status"];

export class CanadaJobBankProvider implements JobProvider {
  constructor(
    private readonly get: FetchJson = fetchJson,
    private readonly download: (url: string) => Promise<Response> = (url) => fetch(url, {
      signal: AbortSignal.timeout(180000), redirect: "error",
      headers: { Accept: "text/csv", "User-Agent": "vmiyou/0.3 (job-board-sync)" },
    }),
  ) {}
  async fetch(identifier: string) {
    parseIdentifier("CANADA_JOB_BANK", identifier);
    const body = catalogue.parse(await this.get(`https://open.canada.ca/data/api/3/action/package_show?id=${datasetId}`));
    const resources = body.result.resources.filter((r) =>
      r.format.toUpperCase() === "CSV" && /english|\ben\b|all-job-postings-en-/i.test(r.name + " " + r.url),
    );
    const resource = resources.sort((a, b) => (Date.parse(b.created ?? "") || 0) - (Date.parse(a.created ?? "") || 0))[0];
    if (!resource) throw new Error("Canada Job Bank English CSV resource not found");
    const url = new URL(resource.url);
    if (url.protocol !== "https:" || url.hostname !== "open.canada.ca" || !url.pathname.includes(datasetId) || !url.pathname.endsWith(".csv"))
      throw new Error("Unexpected Canada Job Bank resource URL");
    const response = await this.download(url.href);
    if (!response.ok || !response.body) throw new Error(`Canada Job Bank HTTP ${response.status}`);
    const rows = csvRows(response.body);
    try {
      const first = await rows.next();
      if (first.done) throw new Error("Canada Job Bank CSV is empty");
      const headers = first.value.map((h) => h.replace(/^\uFEFF/, "").trim());
      const missing = required.filter((key) => !headers.includes(key));
      if (missing.length) throw new Error(`Canada Job Bank open data cannot be published as active jobs: missing ${missing.join(", ")}. Monthly historical CSV has no verified application links.`);
      const jobs = [];
      for await (const cells of rows) {
        if (cells.length !== headers.length) throw new Error("Canada Job Bank CSV column mismatch");
        const record = Object.fromEntries(headers.map((key, index) => [key, cells[index] ?? ""]));
        if (record.Status !== "ACTIVE") continue;
        jobs.push(normalize({
          externalId: record["Job ID"]!, title: record["Job Title"]!,
          companyName: record.Employer, description: record.Description!,
          location: [record.City, record["Province/Territory"]].filter(Boolean).join(", "),
          city: record.City, region: record["Province/Territory"], country: "CA",
          employmentType: record["Employment Type"], publishedAt: record["First Posting Date"],
          sourceUrl: record["Source URL"]!, applyUrl: record["Apply URL"]!,
        }));
        if (jobs.length > 100000) throw new Error("Canada Job Bank job limit reached");
      }
      return jobs;
    } finally {
      await rows.return([]).catch(() => undefined);
      await response.body.cancel().catch(() => undefined);
    }
  }
}
