import "server-only";

export function siteOrigin() {
  const raw = process.env.APP_ORIGIN;
  if (!raw) return "http://localhost:3000";
  const url = new URL(raw);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.pathname !== "/" || url.search || url.hash)
    throw new Error("APP_ORIGIN must be an HTTP(S) origin without path or credentials");
  return url.origin;
}

export function seoEnabled() {
  return Boolean(process.env.APP_ORIGIN);
}

export function canonical(path: string) {
  return new URL(path, siteOrigin()).toString();
}

export function robots(indexable: boolean) {
  return { index: seoEnabled() && indexable, follow: true };
}
