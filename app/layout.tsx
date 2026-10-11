import { Analytics } from "@/components/analytics";
import { PublicIntegrations } from "@/components/public-integrations";
import type { Metadata, Viewport } from "next";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { robots as indexRobots, siteOrigin } from "@/lib/seo-site";
import platformPackage from "@/package.json";
import "@/styles/tailwind.css";
import "@/styles/variables/tokens.css";
import "@/styles/base/reset.css";
import "@/styles/base/layout.css";
import "@/styles/base/accessibility.css";
import "@/styles/components/buttons.css";
import "@/styles/components/inputs.css";
import "@/styles/components/select.css";
import "@/styles/components/badges.css";
import "@/styles/components/company-logo.css";
import "@/styles/components/header.css";
import "@/styles/components/search.css";
import "@/styles/components/filters.css";
import "@/styles/components/job-card.css";
import "@/styles/components/pagination.css";
import "@/styles/components/feedback.css";
import "@/styles/components/filter-drawer.css";
import "@/styles/components/footer.css";
import "@/styles/pages/jobs.css";
import "@/styles/pages/job-details.css";
import "@/styles/pages/companies.css";
import "@/styles/pages/home.css";
import "@/styles/pages/auth.css";
import "@/styles/pages/admin.css";
import "@/styles/pages/seo.css";
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin()),
  applicationName: "vmiyou",
  icons: {
    shortcut: "/favicon/favicon.ico",
    icon: [
      { url: "/favicon/favicon.ico", sizes: "any" },
      { url: "/favicon/favicon-16x16.png", type: "image/png", sizes: "16x16" },
      { url: "/favicon/favicon-32x32.png", type: "image/png", sizes: "32x32" },
      { url: "/favicon/favicon-96x96.png", type: "image/png", sizes: "96x96" },
      { url: "/favicon/favicon-128.png", type: "image/png", sizes: "128x128" },
      { url: "/favicon/favicon-196x196.png", type: "image/png", sizes: "196x196" },
    ],
    apple: [
      { url: "/favicon/apple-touch-icon-57x57.png", type: "image/png", sizes: "57x57" },
      { url: "/favicon/apple-touch-icon-60x60.png", type: "image/png", sizes: "60x60" },
      { url: "/favicon/apple-touch-icon-72x72.png", type: "image/png", sizes: "72x72" },
      { url: "/favicon/apple-touch-icon-76x76.png", type: "image/png", sizes: "76x76" },
      { url: "/favicon/apple-touch-icon-114x114.png", type: "image/png", sizes: "114x114" },
      { url: "/favicon/apple-touch-icon-120x120.png", type: "image/png", sizes: "120x120" },
      { url: "/favicon/apple-touch-icon-144x144.png", type: "image/png", sizes: "144x144" },
      { url: "/favicon/apple-touch-icon-152x152.png", type: "image/png", sizes: "152x152" },
    ],
  },
  other: {
    "msapplication-config": "/favicon/browserconfig.xml",
    "msapplication-TileColor": "#ffffff",
    "msapplication-TileImage": "/favicon/mstile-144x144.png",
  },
  title: {
    default: "vmiyou — Find your next job",
    template: "%s | vmiyou",
  },
  description:
    "Discover jobs across industries with clear location requirements. Search remote, hybrid, and on-site opportunities around the world.",
  openGraph: {
    type: "website",
    siteName: "vmiyou",
  },
  robots: indexRobots(true),
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        <Analytics />
        <PublicIntegrations />
        <SiteHeader />
        {children}
        <SiteFooter version={platformPackage.version} />
      </body>
    </html>
  );
}
