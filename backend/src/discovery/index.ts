import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";
import type { PrismaClient, SourceType } from "../generated/prisma/client.js";
import { getProvider } from "../providers/providers.js";
import { importSourceTypes, validSourceIdentifier } from "../providers/source-config.js";
import { syncSource } from "../sync.js";
import { atsFromUrl, boardUrl, careerCandidate, detectAts, detectAtsFromJobs, normalizedCompanyName, websiteDomain, type SupportedAts } from "./detect.js";
import { safeGetHtml, validatePublicUrl } from "./safe-http.js";

const catalogSchema = z.array(z.object({
  name: z.string(), type: z.enum(importSourceTypes),
  sourceIdentifier: z.string(), enabled: z.boolean(),
  company: z.object({
    name: z.string(), slug: z.string(), website: z.string().optional(),
    careerUrl: z.string().optional(), country: z.string().optional(),
    logoUrl: z.string().optional(),
  }),
}).refine(validSourceIdentifier)).max(500);
const retryMs = [0, 86400000, 2 * 86400000, 4 * 86400000];

export async function bootstrapDiscovery(db: PrismaClient, now = new Date()) {
  await db.company.updateMany({ where: { discoveredAt: null, sources: { some: {} } }, data: {
    discoveredAt: now, discoveredFrom: "existing-source", discoveryStatus: "KNOWN", lastDiscoveryAt: now,
  } });
  await db.company.updateMany({ where: { discoveredAt: null, sources: { none: {} }, jobs: { some: {} } }, data: {
    discoveredAt: now, discoveredFrom: "imported-job", discoveryStatus: "PENDING",
  } });
  await db.company.updateMany({ where: { discoveredAt: null, sources: { none: {} }, website: { not: null } }, data: {
    discoveredAt: now, discoveredFrom: "existing-company", discoveryStatus: "PENDING",
  } });
  const missingDomains = await db.company.findMany({ where: { website: { not: null }, websiteDomain: null }, select: { id: true, website: true }, take: 1000 });
  for (const company of missingDomains) {
    const domain = websiteDomain(company.website!);
    if (domain) await db.company.update({ where: { id: company.id }, data: { websiteDomain: domain } });
  }
  const missingNames = await db.company.findMany({ where: { normalizedName: null }, select: { id: true, name: true }, take: 1000 });
  for (const company of missingNames)
    await db.company.update({ where: { id: company.id }, data: { normalizedName: normalizedCompanyName(company.name) } });
  const catalog = catalogSchema.parse(JSON.parse(await readFile(resolve(process.cwd(), "sources.europe.json"), "utf8")));
  let added = 0;
  const createdSourceIds: string[] = [];
  for (const entry of catalog) {
    const candidate = entry.company;
    const domain = candidate.website ? websiteDomain(candidate.website) : null;
    const existing = await db.company.findFirst({ where: {
      OR: [
        { slug: candidate.slug },
        ...(domain ? [{ websiteDomain: domain }] : []),
        { normalizedName: normalizedCompanyName(candidate.name) },
        { name: { equals: candidate.name, mode: "insensitive" } },
      ],
    } });
    let companyId: string;
    if (existing) {
      if (existing.website && candidate.website && websiteDomain(existing.website) !== domain) continue;
      const newlyResolvable = !existing.discoverySourceId && !existing.website && !existing.careerUrl &&
        Boolean(candidate.website || candidate.careerUrl);
      await db.company.update({ where: { id: existing.id }, data: {
        website: existing.website ?? candidate.website,
        careerUrl: existing.careerUrl ?? candidate.careerUrl,
        logoUrl: existing.logoUrl ?? candidate.logoUrl,
        country: existing.country ?? candidate.country,
        websiteDomain: existing.websiteDomain ?? domain,
        normalizedName: existing.normalizedName ?? normalizedCompanyName(existing.name),
        ...(newlyResolvable && !["REJECTED", "IGNORED", "ENABLED", "KNOWN"].includes(existing.discoveryStatus)
          ? { discoveryStatus: "PENDING", discoveryAttempts: 0, nextRetryAt: null } : {}),
      } });
      companyId = existing.id;
    } else {
      const company = await db.company.create({ data: {
        name: candidate.name, slug: candidate.slug, website: candidate.website,
        careerUrl: candidate.careerUrl, logoUrl: candidate.logoUrl,
        country: candidate.country, websiteDomain: domain,
        normalizedName: normalizedCompanyName(candidate.name),
        discoveredFrom: "catalog:sources.europe.json", discoveredAt: now,
        discoveryStatus: "PENDING",
      } });
      companyId = company.id;
      added++;
    }
    if (!entry.enabled) continue;
    const type = entry.type as SourceType;
    const prior = await db.source.findUnique({ where: { type_sourceIdentifier: {
      type, sourceIdentifier: entry.sourceIdentifier,
    } } });
    if (prior) continue; // Respect existing disabled sources and owner edits.
    const source = await db.source.create({ data: {
      companyId, name: entry.name, type,
      sourceIdentifier: entry.sourceIdentifier, enabled: true,
    } });
    createdSourceIds.push(source.id);
    await db.company.update({ where: { id: companyId }, data: {
      discoveryStatus: "KNOWN", discoverySourceId: source.id,
      validationStatus: "CATALOG", discoveryError: null,
    } });
  }
  return { added, createdSourceIds };
}

export async function dueDiscoveryCompanies(db: PrismaClient, sourceId?: string, now = new Date()) {
  return db.company.findMany({ where: {
    discoveryStatus: { in: ["PENDING", "FAILED"] },
    discoveryAttempts: { lt: 4 },
    OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }],
    ...(sourceId ? { jobs: { some: { sourceId } } } : {}),
  }, select: { id: true }, orderBy: [{ discoveredAt: "asc" }, { id: "asc" }], take: sourceId ? 500 : 1000 });
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message.slice(0, 1000) : "Discovery failed";
}

async function markReview(db: PrismaClient, companyId: string, data: {
  ats?: string; identifier?: string | null; confidence?: string | null;
  careerUrl?: string | null; reason: string; validationStatus?: string;
  sourceId?: string | null;
}) {
  await db.company.update({ where: { id: companyId }, data: {
    discoveryStatus: "REVIEW", nextRetryAt: null, detectedAts: data.ats ?? "UNKNOWN",
    detectedIdentifier: data.identifier ?? null, discoveryConfidence: data.confidence ?? null,
    careerUrl: data.careerUrl ?? undefined, discoveryError: data.reason,
    validationStatus: data.validationStatus ?? "NOT_TESTED",
    discoverySourceId: data.sourceId ?? undefined,
  } });
}

async function createAndSyncSource(db: PrismaClient, companyId: string, ats: SupportedAts, identifier: string) {
  if (!validSourceIdentifier({ type: ats, sourceIdentifier: identifier })) throw new Error("Invalid detected ATS identifier");
  const company = await db.company.findUniqueOrThrow({ where: { id: companyId } });
  if (!company.enabled) throw new Error("Company is disabled");
  const duplicate = await db.source.findUnique({ where: { type_sourceIdentifier: {
    type: ats as SourceType, sourceIdentifier: identifier,
  } } });
  if (duplicate && !(duplicate.id === company.discoverySourceId && !duplicate.enabled)) {
    if (duplicate.companyId !== companyId) throw new Error("ATS board already belongs to another company");
    if (!duplicate.enabled) throw new Error("Existing source is disabled; enable it in Sources if intended");
    await db.company.update({ where: { id: companyId }, data: {
      discoveryStatus: "KNOWN", discoverySourceId: duplicate.id,
      validationStatus: "EXISTING", discoveryError: null, nextRetryAt: null,
    } });
    return { sourceId: duplicate.id, existing: true };
  }
  const source = duplicate ?? await db.source.create({ data: {
    companyId, type: ats as SourceType, sourceIdentifier: identifier,
    name: `${company.name} discovered ${ats.toLowerCase()} board`, enabled: false,
  } });
  await db.company.update({ where: { id: companyId }, data: {
    discoverySourceId: source.id, validationStatus: "TESTING",
  } });
  try {
    const jobs = await getProvider(ats).fetch(identifier);
    await db.source.update({ where: { id: source.id }, data: { enabled: true } });
    const result = await syncSource(db, source.id, { fetch: async () => jobs });
    if ("skipped" in result) throw new Error("Initial import was skipped");
    await db.company.update({ where: { id: companyId }, data: {
      discoveryStatus: "ENABLED", validationStatus: "VALID", discoveryError: null,
      nextRetryAt: null,
    } });
    return { sourceId: source.id, existing: false, imported: result.found };
  } catch (error) {
    const reason = errorMessage(error);
    await db.source.update({ where: { id: source.id }, data: { enabled: false, lastError: reason } });
    await markReview(db, companyId, { ats, identifier, confidence: "HIGH", reason,
      validationStatus: "FAILED", sourceId: source.id });
    return { sourceId: source.id, existing: false, error: reason };
  }
}

export async function discoverCompany(db: PrismaClient, companyId: string, force = false, now = new Date()) {
  const claimed = await db.company.updateMany({ where: {
    id: companyId,
    discoveryStatus: { in: force ? ["PENDING", "FAILED", "REVIEW"] : ["PENDING", "FAILED"] },
    ...(!force ? { OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }] } : {}),
  }, data: { discoveryStatus: "SCANNING", lastDiscoveryAt: now, discoveryAttempts: { increment: 1 }, nextRetryAt: null } });
  if (!claimed.count) return { skipped: true };
  const company = await db.company.findUniqueOrThrow({ where: { id: companyId }, include: { sources: true } });
  try {
    if (company.sources.length) {
      const enabled = company.sources.find((source) => source.enabled);
      if (enabled) {
        await db.company.update({ where: { id: companyId }, data: {
          discoveryStatus: "KNOWN", discoverySourceId: enabled.id, validationStatus: "EXISTING", discoveryError: null,
        } });
        return { existing: true };
      }
      const retryable = company.sources.find((source) => source.id === company.discoverySourceId && !source.enabled);
      if (retryable && company.detectedAts === retryable.type && company.detectedIdentifier === retryable.sourceIdentifier)
        return createAndSyncSource(db, companyId, retryable.type as SupportedAts, retryable.sourceIdentifier);
      // A deliberately disabled source must never be enabled by discovery.
      await markReview(db, companyId, { reason: "Existing source is disabled; owner review required", sourceId: company.sources[0]!.id });
      return { review: true };
    }
    // Aggregate feeds often provide an official ATS apply URL even when they
    // do not provide a company website. Reuse that stronger signal first.
    const jobLinks = await db.job.findMany({ where: { companyId },
      select: { applyUrl: true, sourceUrl: true }, orderBy: { firstSeenAt: "desc" }, take: 50,
    });
    const fromJobs = detectAtsFromJobs(jobLinks.flatMap((job) => [job.applyUrl, job.sourceUrl]));
    if (fromJobs) {
      const candidateUrl = boardUrl(fromJobs);
      if (candidateUrl) validatePublicUrl(candidateUrl);
      await db.company.update({ where: { id: companyId }, data: {
        careerUrl: company.careerUrl ?? candidateUrl,
        detectedAts: fromJobs.ats, detectedIdentifier: fromJobs.identifier,
        discoveryConfidence: fromJobs.confidence, validationStatus: "NOT_TESTED",
        discoveryError: null,
      } });
      if (fromJobs.identifier && fromJobs.ats !== "UNKNOWN" && (fromJobs.confidence === "HIGH" || force))
        return createAndSyncSource(db, companyId, fromJobs.ats, fromJobs.identifier);
      await markReview(db, companyId, { ats: fromJobs.ats, identifier: fromJobs.identifier,
        confidence: fromJobs.confidence, careerUrl: candidateUrl,
        reason: "Multiple ATS boards in imported job links; owner review required" });
      return { review: true };
    }
    if (!company.website && !company.careerUrl) {
      await markReview(db, companyId, { reason: "No verified company website or careers URL in known datasets" });
      return { review: true };
    }
    let careerUrl = company.careerUrl;
    let html = "";
    let base = company.website ?? careerUrl!;
    if (careerUrl && atsFromUrl(careerUrl)) {
      validatePublicUrl(careerUrl);
    } else {
      const home = await safeGetHtml(careerUrl ?? company.website!);
      html = home.html;
      base = home.url;
      if (!careerUrl) careerUrl = careerCandidate(html, base);
      if (careerUrl && !atsFromUrl(careerUrl) && careerUrl !== base) {
        const career = await safeGetHtml(careerUrl);
        html = career.html;
        base = career.url;
        careerUrl = career.url;
      }
    }
    const detection = detectAts(careerUrl, html, base);
    await db.company.update({ where: { id: companyId }, data: {
      websiteDomain: company.website ? websiteDomain(company.website) : null,
      careerUrl: careerUrl ?? company.careerUrl,
      detectedAts: detection.ats, detectedIdentifier: detection.identifier,
      discoveryConfidence: detection.confidence, validationStatus: "NOT_TESTED",
      discoveryError: null,
    } });
    if (detection.identifier && detection.ats !== "UNKNOWN" && (detection.confidence === "HIGH" || force))
      return createAndSyncSource(db, companyId, detection.ats, detection.identifier);
    await markReview(db, companyId, { ats: detection.ats, identifier: detection.identifier,
      confidence: detection.confidence, careerUrl,
      reason: detection.ats === "UNKNOWN" ? "No supported ATS detected" : "ATS needs owner review" });
    return { review: true };
  } catch (error) {
    const reason = errorMessage(error);
    const attempts = company.discoveryAttempts;
    await db.company.update({ where: { id: companyId }, data: {
      discoveryStatus: attempts >= 4 ? "REVIEW" : "FAILED",
      validationStatus: "FAILED", discoveryError: reason,
      nextRetryAt: attempts >= 4 ? null : new Date(now.getTime() + retryMs[attempts]!),
    } });
    return { failed: reason };
  }
}

export async function createSourceForReview(db: PrismaClient, companyId: string) {
  const company = await db.company.findUniqueOrThrow({ where: { id: companyId } });
  const ats = company.detectedAts;
  const identifier = company.detectedIdentifier;
  if (!ats || !["GREENHOUSE", "LEVER", "ASHBY", "PERSONIO", "RECRUITEE"].includes(ats) ||
      !identifier || !validSourceIdentifier({ type: ats, sourceIdentifier: identifier }))
    throw new Error("Review item has no valid supported ATS identifier");
  const existing = await db.source.findUnique({ where: { type_sourceIdentifier: {
    type: ats as SourceType, sourceIdentifier: identifier,
  } } });
  if (existing) throw new Error("Source already exists");
  const source = await db.source.create({ data: {
    companyId, type: ats as SourceType, sourceIdentifier: identifier,
    name: `${company.name} reviewed ${ats.toLowerCase()} board`, enabled: false,
  } });
  await db.company.update({ where: { id: companyId }, data: {
    discoverySourceId: source.id, validationStatus: "NOT_TESTED",
    discoveryStatus: "REVIEW", discoveryError: "Source created disabled; validate and enable it in Sources",
  } });
  return source;
}

export async function discoveryMetrics(db: PrismaClient) {
  const [companiesDiscovered, atsDetected, sourcesCreated, sourcesValidated, failedDetections, unknownAts, linked] = await Promise.all([
    db.company.count({ where: { discoveredAt: { not: null } } }),
    db.company.count({ where: { detectedAts: { not: null, notIn: ["UNKNOWN"] } } }),
    db.company.count({ where: { discoverySourceId: { not: null }, OR: [
      { discoveryStatus: { in: ["ENABLED", "REVIEW"] } }, { validationStatus: "CATALOG" },
    ] } }),
    db.company.count({ where: { validationStatus: "VALID" } }),
    db.company.count({ where: { OR: [{ validationStatus: "FAILED" }, { discoveryStatus: "FAILED" }] } }),
    db.company.count({ where: { detectedAts: "UNKNOWN" } }),
    db.company.findMany({ where: { validationStatus: "VALID", discoverySourceId: { not: null } }, select: { discoverySourceId: true } }),
  ]);
  const jobsImported = await db.job.count({ where: { sourceId: { in: linked.map((item) => item.discoverySourceId!) } } });
  return { companiesDiscovered, atsDetected, sourcesCreated, sourcesValidated, jobsImported, failedDetections, unknownAts };
}
