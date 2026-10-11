"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { AdminSearch } from "./search";
import { BrandLogo } from "@/components/brand-logo";
export function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [error, setError] = useState("");
  return (
    <aside className="admin-sidebar">
      <Link href="/admin" className="brand" aria-label="vmiyou admin home">
        <BrandLogo eager />
      </Link>
      <span className="admin-eyebrow">OWNER WORKSPACE</span>
      <AdminSearch />
      <nav aria-label="Admin navigation">
        {[
          { label: "Workspace", links: [["Overview", "/admin"], ["Analytics", "/admin/analytics"]] },
          { label: "Management", links: [["Jobs", "/admin/jobs"], ["Companies", "/admin/companies"], ["Sources", "/admin/sources"], ["Discovery", "/admin/discovery"], ["Import logs", "/admin/logs"]] },
          { label: "Platform", links: [["Integrations", "/admin/integrations"], ["System", "/admin/system"], ["Audit log", "/admin/audit-logs"]] },
        ].map((group) => <div className="admin-nav-group" key={group.label}>
          <span className="admin-nav-label">{group.label}</span>
          {group.links.map(([name, href]) => <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined}>{name}</Link>)}
          {group.label === "Platform" && <span className="admin-nav-placeholder">Settings<small>Later</small></span>}
        </div>)}
        <div className="admin-nav-group admin-future-nav"><span className="admin-nav-label">Future-ready</span>
          {["Users", "Candidates", "Employers", "Applications"].map((label) => <span className="admin-nav-placeholder" key={label}>{label}<small>Later</small></span>)}
        </div>
      </nav>
      <div className="admin-sidebar-bottom">
        <Link href="/">View public site ↗</Link>
        <button
          type="button"
          onClick={async () => {
            try {
              const result = await fetch("/api/admin/logout", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: "{}",
              });
              if (!result.ok && result.status !== 401) throw new Error();
              router.replace("/admin/login");
              router.refresh();
            } catch {
              setError("Could not sign out. Please retry.");
            }
          }}
        >
          Sign out
        </button>
        {error && <p role="alert">{error}</p>}
        <small>Private workspace · UTC</small>
      </div>
    </aside>
  );
}
