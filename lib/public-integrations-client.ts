import { parsePublicIntegrations, type PublicIntegration } from "./public-integrations.ts";

const CACHE_TTL_MS = 60_000;
let cached: { items: PublicIntegration[]; expiresAt: number } | undefined;
let pending: Promise<PublicIntegration[]> | undefined;

// In-memory only: shared by navigations, cleared on reload, never persisted.
export function loadPublicIntegrations(): Promise<PublicIntegration[]> {
  if (cached && Date.now() < cached.expiresAt) return Promise.resolve(cached.items);
  if (pending) return pending;
  pending = (async () => {
    const response = await fetch("/api/integrations", {
      credentials: "omit",
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error("Integration settings unavailable");
    const items = parsePublicIntegrations(await response.json());
    cached = { items, expiresAt: Date.now() + CACHE_TTL_MS };
    return items;
  })().finally(() => { pending = undefined; });
  return pending;
}
