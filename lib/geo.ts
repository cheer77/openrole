// Enable only behind a trusted edge that replaces incoming geo headers.
// This is the GeoProvider boundary; no IP address is read, forwarded or stored.
export function geoFromHeaders(
  headers: Headers,
  provider = process.env.GEO_PROVIDER || "none",
) {
  const names =
    provider === "vercel"
      ? [
          "x-vercel-ip-country",
          "x-vercel-ip-country-region",
          "x-vercel-ip-city",
        ]
      : provider === "cloudflare"
        ? ["cf-ipcountry", "cf-region", "cf-ipcity"]
        : [];
  if (!names.length) return {};
  const clean = (value: string | null) => {
    try {
      return value
        ? decodeURIComponent(value)
            .replace(/[\u0000-\u001f]/g, "")
            .slice(0, 100)
        : undefined;
    } catch {
      return undefined;
    }
  };
  const country = clean(headers.get(names[0] || "x-unused-geo"))?.toUpperCase();
  return {
    country:
      country && /^[A-Z]{2}$/.test(country) && !["XX", "T1"].includes(country)
        ? country
        : undefined,
    region: clean(headers.get(names[1] || "x-unused-geo")),
    city: clean(headers.get(names[2] || "x-unused-geo")),
  };
}
