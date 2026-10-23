export type FetchJson = (url: string) => Promise<unknown>;
export type FetchText = (url: string) => Promise<string>;

export class ProviderSnapshotChangedError extends Error {
  override readonly name = "ProviderSnapshotChangedError";
}

export function isTransientProviderError(error: unknown) {
  return error instanceof Error && (
    /^Provider HTTP (?:429|5\d\d)$/.test(error.message) ||
    error instanceof ProviderSnapshotChangedError ||
    error.name === "TimeoutError" || error.name === "AbortError" ||
    error.message === "fetch failed"
  );
}

export const fetchTextWithHeaders = async (url: string, headers: Record<string, string> = {}) => {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(20000),
    redirect: "error",
    headers: {
      Accept: "application/json, application/xml, text/xml",
      "User-Agent": "vmiyou/0.2 (job-board-sync)",
      ...headers,
    },
  });
  if (!response.ok) throw new Error(`Provider HTTP ${response.status}`);
  if (!response.body) throw new Error("Provider returned no body");
  const chunks: Uint8Array[] = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.byteLength;
    if (size > 20 * 1024 * 1024) {
      await response.body.cancel().catch(() => undefined);
      throw new Error("Provider response exceeds 20 MB");
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
};

export const fetchText: FetchText = (url) => fetchTextWithHeaders(url);

export const fetchJson: FetchJson = async (url) =>
  JSON.parse(await fetchText(url)) as unknown;
