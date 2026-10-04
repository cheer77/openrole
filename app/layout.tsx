import type { Metadata, Viewport } from "next";
import { SiteFooter, SiteHeader } from "@/components/site-header";
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
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: {
    default: "Openrole — Find your next chapter in tech",
    template: "%s | Openrole",
  },
  description:
    "Discover tech and digital jobs with clear location requirements. Search remote, hybrid, and on-site opportunities around the world. Phase 1 demo.",
  robots: { index: false, follow: false },
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
        <SiteHeader />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
