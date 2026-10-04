"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./icon";

export function SiteHeader() {
  const pathname = usePathname();
  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link href="/" className="brand" aria-label="Openrole home">
          <span className="brand-symbol">
            <Icon name="arrow" size={23} />
          </span>
          openrole<span className="brand-period">.</span>
        </Link>
        <nav aria-label="Main navigation">
          <Link
            className={pathname.startsWith("/jobs") ? "nav-active" : ""}
            href="/jobs"
            aria-current={pathname === "/jobs" ? "page" : undefined}
          >
            Find Jobs
          </Link>
          <Link
            className={pathname === "/companies" ? "nav-active" : ""}
            href="/companies"
            aria-current={pathname === "/companies" ? "page" : undefined}
          >
            Companies
          </Link>
        </nav>
        <div className="header-actions" aria-label="Account tools">
          <div className="header-shortcuts">
            <button
              type="button"
              className="header-action"
              disabled
              aria-label="Favorite jobs — coming soon"
              title="Favorite jobs — coming soon"
            >
              <Icon name="star" size={21} />
            </button>
            <button
              type="button"
              className="header-action"
              disabled
              aria-label="Notifications — coming soon"
              title="Notifications — coming soon"
            >
              <Icon name="bell" size={21} />
            </button>
          </div>
          <Link className="header-account" href="/login" aria-label="Sign in">
            <span className="header-avatar">
              <Icon name="user" size={20} />
            </span>
            <span className="header-account-name">Guest</span>
          </Link>
        </div>
      </div>
      <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
        <Link
          href="/jobs"
          className={pathname.startsWith("/jobs") ? "mobile-nav-active" : ""}
          aria-current={pathname.startsWith("/jobs") ? "page" : undefined}
        >
          <Icon name="search" size={22} />
          <span>Jobs</span>
        </Link>
        <Link
          href="/companies"
          className={pathname === "/companies" ? "mobile-nav-active" : ""}
          aria-current={pathname === "/companies" ? "page" : undefined}
        >
          <Icon name="briefcase" size={22} />
          <span>Companies</span>
        </Link>
        <button type="button" disabled title="Saved jobs — coming soon">
          <Icon name="star" size={22} />
          <span>Saved</span>
        </button>
        <button type="button" disabled title="Notifications — coming soon">
          <Icon name="bell" size={22} />
          <span>Alerts</span>
        </button>
        <Link href="/login" aria-label="Sign in">
          <Icon name="user" size={22} />
          <span>Profile</span>
        </Link>
      </nav>
    </header>
  );
}
export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container footer-inner">
        <Link href="/" className="footer-brand">
          openrole.
        </Link>
        <p>Tech careers, everywhere.</p>
        <nav aria-label="Footer navigation">
          <Link href="/jobs">Find Jobs</Link>
          <Link href="/companies">Companies</Link>
          <span>Discover your next role</span>
        </nav>
      </div>
    </footer>
  );
}
