import { decodeHTML } from "entities";
import { validSourceIdentifier } from "../providers/source-config.js";

export type SupportedAts = "GREENHOUSE" | "LEVER" | "ASHBY" | "PERSONIO" | "RECRUITEE";
export type Confidence = "HIGH" | "MEDIUM" | "LOW";
export type Detection = { ats: SupportedAts | "UNKNOWN"; identifier: string | null; confidence: Confidence | null; url: string | null };
type Link = { url: string; label: string };

export function websiteDomain(value: string) {
  try { return new URL(value).hostname.toLowerCase().replace(/^www\./, ""); }
  catch { return null; }
}

export function normalizedCompanyName(value: string) {
  return value.normalize("NFKD").toLowerCase().replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

export function pageLinks(html: string, base: string): Link[] {
  const links: Link[] = [];
  const tags = [...html.matchAll(/<(?:a|iframe|script)\b[^>]*>/gi)].slice(0, 1000);
  for (const tagMatch of tags) {
    const tag = tagMatch[0];
    const match = tag.match(/\b(?:href|src)\s*=\s*(["'])(.*?)\1/i);
    if (!match) continue;
    try {
      const url = new URL(decodeHTML(match[2]!), base);
      if (!['http:', 'https:'].includes(url.protocol)) continue;
      const label = tag.startsWith("<a")
        ? html.slice((tagMatch.index ?? 0) + tag.length).split("</a>", 1)[0]?.replace(/<[^>]+>/g, " ").slice(0, 150) ?? ""
        : "";
      links.push({ url: url.href, label: decodeHTML(label) });
    } catch { /* ignore malformed links */ }
  }
  return links;
}

export function careerCandidate(html: string, base: string) {
  const links = pageLinks(html, base);
  const scored = links.map((link) => {
    const value = `${link.label} ${new URL(link.url).pathname}`.toLowerCase();
    const direct = atsFromUrl(link.url);
    const score = (direct ? 8 : 0) +
      (/\b(careers?|jobs?|vacanc(?:y|ies)|join us|work with us|positions?|karriere|stellenangebote)\b/i.test(value) ? 4 : 0) +
      (/\b(apply|opportunities|talent)\b/i.test(value) ? 1 : 0);
    return { ...link, score };
  }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score);
  return scored[0]?.url ?? null;
}

export function atsFromUrl(value: string): Detection | null {
  let url: URL;
  try { url = new URL(value); } catch { return null; }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.toLowerCase();
  const segments = url.pathname.split("/").filter(Boolean);
  let ats: SupportedAts | null = null;
  let identifier: string | null = null;
  if (["boards.greenhouse.io", "job-boards.greenhouse.io"].includes(host)) {
    ats = "GREENHOUSE";
    identifier = segments[0] ?? url.searchParams.get("for");
    if (identifier === "embed") identifier = url.searchParams.get("for");
  } else if (["jobs.lever.co", "jobs.eu.lever.co"].includes(host)) {
    ats = "LEVER"; identifier = segments[0] ? `${host === "jobs.eu.lever.co" ? "eu:" : ""}${segments[0]}` : null;
  } else if (host === "jobs.ashbyhq.com") {
    ats = "ASHBY"; identifier = segments[0] ?? null;
  } else if (/^[a-z0-9-]+\.jobs\.personio\.(?:de|com)$/.test(host)) {
    ats = "PERSONIO";
    identifier = `${host.endsWith(".de") ? "de:" : ""}${host.split(".")[0]}`;
  } else if (/^[a-z0-9-]+\.recruitee\.com$/.test(host)) {
    ats = "RECRUITEE"; identifier = host.split(".")[0]!;
  }
  if (!ats || !identifier || !validSourceIdentifier({ type: ats, sourceIdentifier: identifier })) return null;
  return { ats, identifier, confidence: "HIGH", url: url.href };
}

export function detectAts(careerUrl: string | null, html: string, base: string): Detection {
  if (careerUrl) {
    const direct = atsFromUrl(careerUrl);
    if (direct) return direct;
  }
  const matches = pageLinks(html, base).map((link) => atsFromUrl(link.url)).filter((item): item is Detection => !!item);
  const unique = new Map(matches.map((item) => [`${item.ats}:${item.identifier}`, item]));
  if (unique.size === 1) return unique.values().next().value!;
  if (unique.size > 1) {
    const first = unique.values().next().value!;
    return { ...first, confidence: "MEDIUM" };
  }
  const unescaped = decodeHTML(html.replaceAll("\\/", "/"));
  const rawUrls = unescaped.match(/https?:\/\/(?:boards|job-boards)\.greenhouse\.io\/[a-z0-9_-]+|https?:\/\/jobs(?:\.eu)?\.lever\.co\/[a-z0-9_-]+|https?:\/\/jobs\.ashbyhq\.com\/[a-z0-9_-]+|https?:\/\/[a-z0-9-]+\.jobs\.personio\.(?:de|com)\b|https?:\/\/[a-z0-9-]+\.recruitee\.com\b/gi) ?? [];
  const raw = rawUrls.map(atsFromUrl).filter((item): item is Detection => !!item);
  const rawUnique = new Map(raw.map((item) => [`${item.ats}:${item.identifier}`, item]));
  if (rawUnique.size === 1) return { ...rawUnique.values().next().value!, confidence: "MEDIUM" };
  if (rawUnique.size > 1) return { ...rawUnique.values().next().value!, confidence: "MEDIUM" };
  const hint = /greenhouse|lever|ashby|personio|recruitee/i.exec(html)?.[0]?.toUpperCase() as SupportedAts | undefined;
  return { ats: hint ?? "UNKNOWN", identifier: null, confidence: hint ? "LOW" : null, url: null };
}

export function detectAtsFromJobs(urls: string[]): Detection | null {
  const boards = new Map<string, Detection>();
  for (const value of urls) {
    const detected = atsFromUrl(value);
    if (detected) boards.set(`${detected.ats}:${detected.identifier}`, detected);
  }
  if (!boards.size) return null;
  const first = boards.values().next().value!;
  return boards.size === 1 ? first : { ...first, confidence: "MEDIUM" };
}

export function boardUrl(detection: Detection) {
  if (!detection.url || !detection.identifier) return null;
  const url = new URL(detection.url);
  if (detection.ats === "PERSONIO" || detection.ats === "RECRUITEE")
    return url.origin;
  const slug = detection.ats === "LEVER" ? detection.identifier.replace(/^eu:/, "") : detection.identifier;
  return `${url.origin}/${encodeURIComponent(slug)}`;
}
