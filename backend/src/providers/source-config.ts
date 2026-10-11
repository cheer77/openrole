import { z } from "zod";

export const importSourceTypes = [
  "GREENHOUSE",
  "LEVER",
  "ASHBY",
  "SMARTRECRUITERS",
  "PERSONIO",
  "RECRUITEE",
  "USAJOBS",
  "CANADA_JOB_BANK",
  "ARBEITNOW",
] as const;
export const sourceIdentifierSchema = z
  .string()
  .regex(/^(?:(?:eu|de):)?[a-zA-Z0-9_-]{1,150}$/);

export function validSourceIdentifier(source: {
  type: string;
  sourceIdentifier: string;
}) {
  if (!sourceIdentifierSchema.safeParse(source.sourceIdentifier).success)
    return false;
  const { type, sourceIdentifier: id } = source;
  if (id.startsWith("eu:") && type !== "LEVER") return false;
  if (id.startsWith("de:") && type !== "PERSONIO") return false;
  if (type === "USAJOBS") return id === "public";
  if (type === "CANADA_JOB_BANK") return id === "official-en";
  if (type === "ARBEITNOW") return id === "all";
  // These identifiers are DNS labels, not arbitrary URL fragments.
  if (["PERSONIO", "RECRUITEE"].includes(type))
    return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(
      id.replace(/^de:/, ""),
    );
  return true;
}

export function parseIdentifier(type: string, sourceIdentifier: string) {
  if (!validSourceIdentifier({ type, sourceIdentifier }))
    throw new Error("Invalid identifier for this provider");
  return sourceIdentifier;
}
