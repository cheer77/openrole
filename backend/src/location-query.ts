import type { Prisma } from "./generated/prisma/client.js";

const eu = [
  "AT",
  "BE",
  "BG",
  "HR",
  "CY",
  "CZ",
  "DK",
  "EE",
  "FI",
  "FR",
  "DE",
  "GR",
  "HU",
  "IE",
  "IT",
  "LV",
  "LT",
  "LU",
  "MT",
  "NL",
  "PL",
  "PT",
  "RO",
  "SK",
  "SI",
  "ES",
  "SE",
];
const names: Record<string, string[]> = {
  Spain: ["Spain"],
  Germany: ["Germany"],
  UK: ["United Kingdom", "UK"],
  USA: ["United States", "USA"],
  Worldwide: ["Worldwide", "Anywhere", "Global"],
  EU: ["European Union", "EU"],
  Europe: ["Europe", "European Union", "EU"],
};
const codes: Record<string, string[]> = {
  Spain: ["ES"],
  Germany: ["DE"],
  UK: ["GB", "UK"],
  USA: ["US"],
  EU: eu,
  Europe: [
    ...eu,
    "GB",
    "CH",
    "NO",
    "IS",
    "UA",
    "RS",
    "AL",
    "BA",
    "ME",
    "MK",
    "MD",
  ],
};
// Match supplied geography, never infer worldwide eligibility from the Remote flag.
// Short region tokens use exact equality to avoid matching e.g. "EU" inside "Seoul".
export function locationWhere(location: string): Prisma.JobWhereInput {
  if (location === "Other")
    return {
      NOT: {
        OR: ["Worldwide", "Europe", "Spain", "Germany", "UK", "USA"].map(
          locationWhere,
        ),
      },
    };
  const aliases = names[location] ?? [location];
  return {
    OR: [
      ...(codes[location] ?? []).map((code) => ({
        country: { not: null, equals: code, mode: "insensitive" as const },
      })),
      ...aliases.flatMap((name) => [
        { country: { not: null, equals: name, mode: "insensitive" as const } },
        { region: { not: null, equals: name, mode: "insensitive" as const } },
        {
          location: {
            ...(name.length <= 3 ? { equals: name } : { contains: name }),
            mode: "insensitive" as const,
          },
        },
      ]),
    ],
  };
}
