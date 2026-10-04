import { readFile } from "node:fs/promises";
import { z } from "zod";
import { createDb } from "./db.js";
import { createQueue, enqueueSources } from "./queue.js";
import { sourceIdentifierSchema } from "./providers/providers.js";
import { httpUrl } from "./providers/normalize.js";

const sourcesSchema = z
  .array(
    z
      .object({
        name: z.string().trim().min(1).max(150),
        type: z.enum(["GREENHOUSE", "LEVER", "ASHBY", "MANUAL"]),
        sourceIdentifier: sourceIdentifierSchema,
        enabled: z.boolean(),
        company: z
          .object({
            name: z.string().trim().min(1).max(150),
            slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
            website: httpUrl.optional(),
            careerUrl: httpUrl.optional(),
            logoUrl: httpUrl.optional(),
            country: z.string().max(80).optional(),
          })
          .strict(),
      })
      .strict(),
  )
  .max(500);

async function main() {
  const [command, argument] = process.argv.slice(2);
  const db = createDb();
  try {
    if (command === "sources") {
      if (!argument)
        throw new Error("Usage: npm run sources:import -- sources.json");
      const sources = sourcesSchema.parse(
        JSON.parse(await readFile(argument, "utf8")),
      );
      await db.$transaction(async (tx) => {
        for (const source of sources) {
          const company = await tx.company.upsert({
            where: { slug: source.company.slug },
            create: source.company,
            update: source.company,
          });
          const key = {
            type: source.type,
            sourceIdentifier: source.sourceIdentifier,
          };
          const existing = await tx.source.findUnique({
            where: { type_sourceIdentifier: key },
          });
          if (existing && existing.companyId !== company.id)
            throw new Error("A source cannot be reassigned to another company");
          await tx.source.upsert({
            where: { type_sourceIdentifier: key },
            create: {
              ...key,
              name: source.name,
              enabled: source.enabled,
              companyId: company.id,
            },
            update: { name: source.name, enabled: source.enabled },
          });
        }
      });
      console.log(`Imported ${sources.length} source configurations`);
    } else if (command === "sync") {
      const queue = createQueue();
      try {
        console.log(
          `Queued ${await enqueueSources(queue, db, argument)} sources`,
        );
      } finally {
        await queue.close();
      }
    } else {
      throw new Error("Commands: sources <file.json> | sync [sourceId]");
    }
  } finally {
    await db.$disconnect();
  }
}
void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
