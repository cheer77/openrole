export async function GET() {
  try {
    const response = await fetch(`${process.env.API_URL || "http://127.0.0.1:4000"}/integrations`, {
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) throw new Error("Integration settings unavailable");
    return new Response(await response.text(), {
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  } catch {
    return Response.json([], { headers: { "cache-control": "no-store" } });
  }
}
