import { Prisma } from "./generated/prisma/client.js";
import { locationCodes, locationNames } from "./location-query.js";
import { countryNames, type jobsQuery } from "./jobs-query.js";

type Filters = ReturnType<typeof jobsQuery>;
export type RankedJob = { id: string | null; total: bigint; score: number | null;
  exactTitle: boolean | null; titleTokenMatches: number | null; phraseSimilarity: number | null; descriptionMatches: number | null };

const genericTerms = new Set(["manager", "specialist", "assistant", "engineer", "developer"]);

export function normalizeSearch(value: string): { phrase: string; tokens: string[] } {
  const phrase = value.toLowerCase().replace(/[^\p{L}\p{N}+#.]+/gu, " ").replace(/\s+/g, " ").trim();
  return { phrase, tokens: [...new Set(phrase.split(" ").filter(Boolean))].slice(0, 12) };
}

const or = (parts: Prisma.Sql[]) => Prisma.sql`(${Prisma.join(parts, " OR ")})`;
const and = (parts: Prisma.Sql[]) => Prisma.sql`(${Prisma.join(parts, " AND ")})`;
const like = (value: string) => `%${value.replace(/[\\%_]/g, "\\$&")}%`;
const text = (value: string) => Prisma.sql`${value}`;
const locationMatch = (value: string): Prisma.Sql => {
  if (value === "Other") return Prisma.sql`NOT COALESCE(${or(["Worldwide", "Europe", "Spain", "Germany", "UK", "USA"].map(locationMatch))}, false)`;
  const names = locationNames[value] ?? [value];
  return or([
    ...(locationCodes[value] ?? []).map((code) => Prisma.sql`j."country" ILIKE ${code}`),
    ...names.flatMap((name) => [
      Prisma.sql`j."country" ILIKE ${name}`,
      Prisma.sql`j."region" ILIKE ${name}`,
      name.length <= 3 ? Prisma.sql`j."location" ILIKE ${name}` : Prisma.sql`j."location" ILIKE ${like(name)}`,
    ]),
  ]);
};

function filterSql({ query, currency }: Filters): Prisma.Sql {
  const clauses: Prisma.Sql[] = [Prisma.sql`j."status" = 'ACTIVE'`, Prisma.sql`c."enabled"`, Prisma.sql`s."enabled"`];
  if (query.category) clauses.push(Prisma.sql`j."category" ILIKE ${query.category}`);
  if (query.company) clauses.push(Prisma.sql`c."slug" = ${query.company}`);
  if (query.companyName) clauses.push(Prisma.sql`c."name" ILIKE ${like(query.companyName)}`);
  if (query.location) clauses.push(locationMatch(query.location));
  if (query.place) {
    const place = like(query.place);
    const countryCode = countryNames[query.place.toLowerCase()];
    clauses.push(or([
      Prisma.sql`j."location" ILIKE ${place}`, Prisma.sql`j."city" ILIKE ${place}`,
      Prisma.sql`j."region" ILIKE ${place}`, Prisma.sql`j."country" ILIKE ${place}`,
      ...(countryCode ? [Prisma.sql`j."country" ILIKE ${countryCode}`] : []),
    ]));
  }
  if (query.country) clauses.push(Prisma.sql`j."country" ILIKE ${query.country}`);
  if (query.region) clauses.push(Prisma.sql`j."region" ILIKE ${query.region}`);
  if (query.remoteType) clauses.push(Prisma.sql`j."remoteType"::text = ${query.remoteType}`);
  if (query.employmentKind) clauses.push(Prisma.sql`j."employmentKind" = ${query.employmentKind}`);
  if (query.experience) clauses.push(Prisma.sql`j."experienceLevel" = ${query.experience}`);
  if (query.technologies?.length) clauses.push(Prisma.sql`j."technologies" @> ARRAY[${Prisma.join(query.technologies.map(text))}]::text[]`);
  if (query.salaryMin !== undefined) clauses.push(Prisma.sql`(j."salaryMax" >= ${query.salaryMin} OR (j."salaryMax" IS NULL AND j."salaryMin" >= ${query.salaryMin}))`);
  if (query.salaryMax !== undefined) clauses.push(Prisma.sql`(j."salaryMin" <= ${query.salaryMax} OR (j."salaryMin" IS NULL AND j."salaryMax" <= ${query.salaryMax}))`);
  if (currency) clauses.push(Prisma.sql`j."currency" = ${currency}`, Prisma.sql`(j."salaryMin" IS NOT NULL OR j."salaryMax" IS NOT NULL)`);
  if (query.posted) clauses.push(Prisma.sql`j."sortDate" >= ${new Date(Date.now() - Number(query.posted) * 86400000)}`);
  return and(clauses);
}

export function rankedJobsSql(filters: Filters): Prisma.Sql {
  const { phrase, tokens } = normalizeSearch(filters.query.search ?? "");
  if (!tokens.length) throw new Error("Search terms required");
  const title = Prisma.sql`lower(j."title")`;
  const titleHits = tokens.map((token) => Prisma.sql`CASE WHEN ${title} LIKE ${like(token)} THEN 1 ELSE 0 END`);
  const matched = Prisma.sql`(${Prisma.join(titleHits, " + ")})`;
  const titleWeight = tokens.map((token) => Prisma.sql`CASE WHEN ${title} LIKE ${like(token)} THEN ${genericTerms.has(token) && tokens.length > 1 ? 7 : 18} ELSE 0 END`);
  const tokenScore = Prisma.sql`(${Prisma.join(titleWeight, " + ")})`;
  const candidateQueries = tokens.flatMap((token) => {
    const term = like(token);
    const techVariants = [...new Set([token, token.toUpperCase(), token[0]?.toUpperCase() + token.slice(1)])];
    const short = token.length < 3;
    return [
      short ? Prisma.sql`SELECT "id" FROM "Job" WHERE to_tsvector('simple', "title") @@ plainto_tsquery('simple', ${token})` : Prisma.sql`SELECT "id" FROM "Job" WHERE "title" ILIKE ${term}`,
      short ? Prisma.sql`SELECT "id" FROM "Job" WHERE to_tsvector('simple', "category") @@ plainto_tsquery('simple', ${token})` : Prisma.sql`SELECT "id" FROM "Job" WHERE "category" ILIKE ${term}`,
      short ? Prisma.sql`SELECT j."id" FROM "Job" j JOIN "Company" c ON c."id" = j."companyId" WHERE to_tsvector('simple', c."name") @@ plainto_tsquery('simple', ${token})` : Prisma.sql`SELECT j."id" FROM "Job" j JOIN "Company" c ON c."id" = j."companyId" WHERE c."name" ILIKE ${term}`,
      Prisma.sql`SELECT "id" FROM "Job" WHERE "technologies" && ARRAY[${Prisma.join(techVariants.map(text))}]::text[]`,
      ...(token.length >= 4 ? [Prisma.sql`SELECT "id" FROM "Job" WHERE "title" % ${token}`] : []),
    ];
  });
  // Reuse indexed full-text hits; rescanning each long description for every score is costly.
  const descriptionQueries = tokens.map((token) =>
    Prisma.sql`SELECT "id" FROM "Job" WHERE to_tsvector('simple', "description") @@ plainto_tsquery('simple', ${token})`);
  candidateQueries.push(Prisma.sql`SELECT "id" FROM description_matches`);
  const categoryHits = Prisma.sql`(${Prisma.join(tokens.map((token) => Prisma.sql`CASE WHEN j."category" ILIKE ${like(token)} OR EXISTS (SELECT 1 FROM unnest(j."technologies") t WHERE t ILIKE ${like(token)}) THEN 1 ELSE 0 END`), " + ")})`;
  const companyHits = Prisma.sql`(${Prisma.join(tokens.map((token) => Prisma.sql`CASE WHEN c."name" ILIKE ${like(token)} THEN 1 ELSE 0 END`), " + ")})`;
  const descriptionHits = Prisma.sql`coalesce(dm.hits, 0)`;
  const score = Prisma.sql`(
    CASE WHEN ${title} = ${phrase} THEN 150 ELSE 0 END +
    CASE WHEN ${title} LIKE ${`${phrase}%`} THEN 110 ELSE 0 END +
    CASE WHEN ${title} LIKE ${like(phrase)} THEN 85 ELSE 0 END +
    CASE WHEN ${matched} = ${tokens.length} THEN 70 WHEN ${matched} > ${Math.floor(tokens.length / 2)} THEN 30 ELSE 0 END +
    ${tokenScore} + round(similarity(${title}, ${phrase}) * 20)::int +
    ${categoryHits} * 8 + ${companyHits} * 6 + least(${descriptionHits}, 3) * 2
  )`;
  const offset = (filters.query.page - 1) * filters.query.limit;
  const order = filters.query.sort === "oldest" ? Prisma.sql`"sortDate" ASC` :
    filters.query.sort === "salary-high" ? Prisma.sql`"salaryMax" DESC NULLS LAST, "salaryMin" DESC NULLS LAST` :
    filters.query.sort === "salary-low" ? Prisma.sql`"salaryMin" ASC NULLS LAST, "salaryMax" ASC NULLS LAST` :
    filters.query.sort === "newest" ? Prisma.sql`"sortDate" DESC` : Prisma.sql`score DESC, "sortDate" DESC`;
  return Prisma.sql`WITH description_matches AS MATERIALIZED (
    SELECT "id", count(*)::int AS hits FROM (${Prisma.join(descriptionQueries, " UNION ALL ")}) matching GROUP BY "id"
  ), candidates AS (${Prisma.join(candidateQueries, " UNION ")}), scored AS (
    SELECT j."id", j."sortDate", j."salaryMin", j."salaryMax", ${score} AS score,
      (${title} = ${phrase}) AS "exactTitle", ${matched} AS "titleTokenMatches",
      similarity(${title}, ${phrase}) AS "phraseSimilarity", ${descriptionHits} AS "descriptionMatches"
    FROM candidates matched_jobs JOIN "Job" j ON j."id" = matched_jobs."id"
    JOIN "Company" c ON c."id" = j."companyId"
    JOIN "Source" s ON s."id" = j."sourceId"
    LEFT JOIN description_matches dm ON dm."id" = j."id"
    WHERE ${filterSql(filters)}
  ), counted AS (SELECT count(*) AS total FROM scored), page AS (
    SELECT "id", score, "exactTitle", "titleTokenMatches", "phraseSimilarity", "descriptionMatches"
    FROM scored ORDER BY ${order}, "id" ASC LIMIT ${filters.query.limit} OFFSET ${offset}
  ) SELECT page."id", page.score, page."exactTitle", page."titleTokenMatches",
    page."phraseSimilarity", page."descriptionMatches", counted.total FROM counted LEFT JOIN page ON true`;
}
