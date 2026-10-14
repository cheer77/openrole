import type { MetadataRoute } from "next";
import { seoEnabled, siteOrigin } from "@/lib/seo-site";

// Generated at build time using this deployment’s APP_ORIGIN.
// An environment without APP_ORIGIN continues to disallow crawling.

export default function robots(): MetadataRoute.Robots {
  if (!seoEnabled()) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api", "/internal"] },
    sitemap: `${siteOrigin()}/sitemap.xml`,
  };
}
