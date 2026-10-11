import { limitedJson, ownerToken, sameOrigin } from "@/lib/admin/server";

export async function POST(request: Request) {
  if (await ownerToken()) return new Response(null, { status: 204 });
  if (!sameOrigin(request)) return new Response(null, { status: 403 });
  if (request.headers.get("dnt") === "1" || request.headers.get("sec-gpc") === "1")
    return new Response(null, { status: 204 });
  if (!process.env.INTERNAL_API_KEY) return new Response(null, { status: 204 });
  try {
    const input = await limitedJson(request, 1000);
    const response = await fetch(`${process.env.API_URL || "http://127.0.0.1:4000"}/events/activity`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-internal-key": process.env.INTERNAL_API_KEY },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(3000),
      cache: "no-store",
    });
    return new Response(null, { status: response.ok ? 204 : response.status });
  } catch {
    return new Response(null, { status: 400 });
  }
}
