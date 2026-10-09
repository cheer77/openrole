import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// Return a permanent status before App Router begins streaming the page.
export async function proxy(request: NextRequest) {
  const slug = request.nextUrl.pathname.slice("/jobs/".length);
  if (!/^[a-zA-Z0-9_-]+$/.test(slug)) return NextResponse.next();
  const api = (process.env.API_URL || "http://127.0.0.1:4000").replace(/\/$/, "");
  try {
    const result = await fetch(`${api}/jobs/${slug}`, {
      method: "HEAD",
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    if (result.status === 410)
      return new Response("This job is no longer available.", {
        status: 410,
        headers: { "Content-Type": "text/plain; charset=utf-8", "X-Robots-Tag": "noindex" },
      });
    if (result.status === 404)
      return NextResponse.rewrite(new URL("/_not-found", request.url), { status: 404 });
  } catch {
    // The page handles transient API errors with its regular error UI.
  }
  return NextResponse.next();
}

export const config = { matcher: "/jobs/:slug" };
