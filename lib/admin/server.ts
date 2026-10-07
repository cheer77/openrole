import "server-only";
import { cookies } from "next/headers";
export const ownerCookie = "openrole-owner";
export async function ownerToken() {
  return (await cookies()).get(ownerCookie)?.value || "";
}
export async function ownerRequest(path: string, options: RequestInit = {}) {
  const token = await ownerToken();
  return fetch(
    `${(process.env.API_URL || "http://127.0.0.1:4000").replace(/\/$/, "")}/admin/${path}`,
    {
      ...options,
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
        ...options.headers,
      },
    },
  );
}
export function sameOrigin(request: Request) {
  // Next may normalize request.url to its bind address. Host retains the
  // browser-facing authority; deployments behind a proxy pin APP_ORIGIN.
  const url = new URL(request.url);
  const host = request.headers.get("host");
  const expected =
    process.env.APP_ORIGIN || (host ? `${url.protocol}//${host}` : url.origin);
  return (
    request.headers.get("origin") === expected &&
    request.headers.get("sec-fetch-site") !== "cross-site"
  );
}
export async function limitedJson(
  request: Request,
  max: number,
): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Missing body");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel();
      throw new Error("Body too large");
    }
    chunks.push(value);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
}
