"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
export function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [error, setError] = useState("");
  return (
    <aside className="admin-sidebar">
      <Link href="/admin" className="brand">
        openrole<span className="brand-period">.</span>
      </Link>
      <span className="admin-eyebrow">OWNER WORKSPACE</span>
      <nav aria-label="Admin navigation">
        {[
          ["Overview", "/admin"],
          ["Jobs", "/admin/jobs"],
          ["Companies", "/admin/companies"],
          ["Sources", "/admin/sources"],
          ["Import logs", "/admin/logs"],
        ].map(([name, href]) => (
          <Link
            key={href}
            href={href}
            aria-current={pathname === href ? "page" : undefined}
          >
            {name}
          </Link>
        ))}
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
