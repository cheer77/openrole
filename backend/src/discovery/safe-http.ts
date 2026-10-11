import { lookup } from "node:dns/promises";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { BlockList, isIP } from "node:net";
import { decodeHTML } from "entities";

const blockedV4 = new BlockList();
const blockedV6 = new BlockList();
for (const [address, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10],
  ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12],
  ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.168.0.0", 16],
  ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24],
  ["224.0.0.0", 4], ["240.0.0.0", 4],
] as const) blockedV4.addSubnet(address, prefix, "ipv4");
for (const [address, prefix] of [
  ["::", 128], ["::1", 128], ["::ffff:0:0", 96],
  ["64:ff9b::", 96], ["100::", 64], ["2001::", 32],
  ["2001:db8::", 32], ["2002::", 16], ["fc00::", 7],
  ["fe80::", 10], ["ff00::", 8],
] as const) blockedV6.addSubnet(address, prefix, "ipv6");

export function publicAddress(address: string) {
  const family = isIP(address);
  return family !== 0 && !(family === 4
    ? blockedV4.check(address, "ipv4")
    : blockedV6.check(address, "ipv6"));
}

export function validatePublicUrl(value: string) {
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password ||
      (url.port && !["80", "443"].includes(url.port)) || !url.hostname ||
      url.hostname === "localhost" || url.hostname.endsWith(".localhost") ||
      url.hostname.endsWith(".local") || url.hostname.endsWith(".internal") ||
      /(^|\.)(linkedin|indeed)\.[a-z.]+$/i.test(url.hostname))
    throw new Error("Discovery URL is not an allowed public website");
  if (isIP(url.hostname) && !publicAddress(url.hostname))
    throw new Error("Discovery URL resolves to a non-public address");
  url.hash = "";
  return url;
}

async function requestPage(url: URL, resolve = lookup): Promise<{ html: string; redirect?: string }> {
  let dnsTimer: ReturnType<typeof setTimeout> | undefined;
  const addresses = await Promise.race([
    resolve(url.hostname, { all: true }),
    new Promise<never>((_, reject) => {
      dnsTimer = setTimeout(() => reject(new Error("Discovery DNS timed out")), 8000);
    }),
  ]).finally(() => clearTimeout(dnsTimer));
  if (!addresses.length || addresses.some(({ address }) => !publicAddress(address)))
    throw new Error("Discovery hostname resolves to a non-public address");
  const pinned = addresses[0]!;
  return new Promise((accept, reject) => {
    const transport = url.protocol === "https:" ? httpsRequest : httpRequest;
    const request = transport(url, {
      method: "GET", timeout: 8000, maxHeaderSize: 16384,
      headers: { Accept: "text/html", "User-Agent": "vmiyou-discovery/0.5" },
      lookup: (_hostname, _options, callback) => callback(null, pinned.address, pinned.family),
    }, (response) => {
      const status = response.statusCode ?? 0;
      if ([301, 302, 303, 307, 308].includes(status)) {
        const target = response.headers.location;
        response.destroy();
        if (!target) reject(new Error("Discovery redirect has no location"));
        else accept({ html: "", redirect: target });
        return;
      }
      if (status !== 200) { response.destroy(); reject(new Error(`Discovery HTTP ${status}`)); return; }
      const type = response.headers["content-type"] ?? "";
      if (!/text\/html|application\/xhtml\+xml/i.test(type)) {
        response.destroy(); reject(new Error("Discovery response is not HTML")); return;
      }
      const chunks: Buffer[] = [];
      let size = 0;
      response.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > 512 * 1024) { response.destroy(new Error("Discovery response exceeds 512 KB")); return; }
        chunks.push(chunk);
      });
      response.on("end", () => accept({ html: Buffer.concat(chunks).toString("utf8") }));
      response.on("error", reject);
    });
    request.on("timeout", () => request.destroy(new Error("Discovery request timed out")));
    request.on("error", reject);
    request.end();
  });
}

export async function safeGetHtml(value: string) {
  let url = validatePublicUrl(value);
  for (let redirects = 0; redirects <= 2; redirects++) {
    const result = await requestPage(url);
    if (!result.redirect) return { url: url.href, html: result.html };
    if (redirects === 2) throw new Error("Discovery redirect limit reached");
    url = validatePublicUrl(new URL(decodeHTML(result.redirect), url).href);
  }
  throw new Error("Discovery redirect limit reached");
}
