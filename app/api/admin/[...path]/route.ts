import { cookies } from "next/headers";
import {
  limitedJson,
  ownerCookie,
  ownerRequest,
  sameOrigin,
} from "@/lib/admin/server";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const path = (await params).path.join("/");
  if (!/^(session|dashboard|jobs|companies|sources|logs)$/.test(path))
    return new Response(null, { status: 404 });
  try {
    const response = await ownerRequest(path + new URL(request.url).search);
    return new Response(await response.text(), {
      status: response.status,
      headers: {
        "content-type": "application/json",
        "cache-control": "no-store",
      },
    });
  } catch {
    return Response.json(
      { message: "Admin service unavailable. Please retry." },
      { status: 503 },
    );
  }
}
async function mutate(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  if (!sameOrigin(request))
    return Response.json(
      { message: "Invalid request origin" },
      { status: 403 },
    );
  const path = (await params).path.join("/");
  if (
    !/^(login|logout|companies|sources|(?:jobs|companies|sources)\/[a-zA-Z0-9_-]+(?:\/(?:status|reset|sync))?)$/.test(
      path,
    )
  )
    return new Response(null, { status: 404 });
  try {
    const input =
      request.method === "DELETE"
        ? undefined
        : await limitedJson(request, 200000);
    let response: Response;
    if (path === "login") {
      if (request.method !== "POST") return new Response(null, { status: 405 });
      response = await fetch(
        `${process.env.API_URL || "http://127.0.0.1:4000"}/owner-auth/login`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-internal-key": process.env.INTERNAL_API_KEY || "",
          },
          body: JSON.stringify(input),
          signal: AbortSignal.timeout(15000),
          cache: "no-store",
        },
      );
    } else
      response = await ownerRequest(path, {
        method: request.method,
        body: input === undefined ? undefined : JSON.stringify(input),
      });
    const body = await response.json();
    if (!response.ok)
      return Response.json(
        {
          message:
            typeof body.message === "string"
              ? body.message
              : "Request could not be completed",
        },
        { status: response.status },
      );
    if (path === "login") {
      (await cookies()).set(ownerCookie, body.token, {
        httpOnly: true,
        sameSite: "strict",
        secure:
          process.env.ADMIN_COOKIE_SECURE !== "false" &&
          process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 8 * 3600,
      });
      return Response.json(
        { ok: true },
        { headers: { "cache-control": "no-store" } },
      );
    }
    if (path === "logout") (await cookies()).delete(ownerCookie);
    return Response.json(body, { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json(
      { message: "Request failed. Check the form and try again." },
      { status: 503 },
    );
  }
}
export const POST = mutate;
export const PATCH = mutate;
export const DELETE = mutate;
