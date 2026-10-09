import type { MetadataRoute } from "next";
import { seoEnabled, siteOrigin } from "@/lib/seo-site";

export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  if (!seoEnabled()) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api", "/internal"] },
    sitemap: `${siteOrigin()}/sitemap.xml`,
  };
}
