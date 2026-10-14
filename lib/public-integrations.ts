export type PublicIntegration = { provider: string; identifier: string };

const patterns: Record<string, RegExp> = {
  ga4: /^G-[A-Z0-9]{4,20}$/,
  gtm: /^GTM-[A-Z0-9]{4,20}$/,
  meta: /^\d{8,20}$/,
  clarity: /^[a-z0-9]{5,32}$/i,
};

// Only these public fields may enter the shared CDN/browser configuration cache.
export function parsePublicIntegrations(value: unknown): PublicIntegration[] {
  if (!Array.isArray(value)) throw new Error("Invalid integration configuration");
  return value.map((row: unknown) => {
    if (!row || typeof row !== "object" ||
      !("provider" in row) || typeof row.provider !== "string" ||
      !("identifier" in row) || typeof row.identifier !== "string" ||
      !Object.hasOwn(patterns, row.provider) || !patterns[row.provider].test(row.identifier)) {
      throw new Error("Invalid integration configuration");
    }
    return { provider: row.provider, identifier: row.identifier };
  });
}
