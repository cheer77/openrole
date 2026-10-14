import { parsePublicIntegrations } from "../../../lib/public-integrations.ts";

export async function GET() {
  try {
    const response = await fetch(`${process.env.API_URL || "http://127.0.0.1:4000"}/integrations`, {
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) throw new Error("Integration settings unavailable");
    return Response.json(parsePublicIntegrations(await response.json()), {
      headers: { "cache-control": "public, max-age=0, s-maxage=60" },
    });
  } catch {
    // A failure is not a successful empty configuration: neither cache stores it.
    return Response.json([], { status: 503, headers: { "cache-control": "no-store" } });
  }
}
