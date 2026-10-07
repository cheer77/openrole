import { redirect } from "next/navigation";
import { ownerRequest, ownerToken } from "@/lib/admin/server";
import { AdminNav } from "@/components/admin/nav";
export const dynamic = "force-dynamic";
export default async function OwnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await ownerToken())) redirect("/admin/login");
  const response = await ownerRequest("session");
  if (response.status === 401) redirect("/admin/login");
  if (!response.ok) throw new Error("Owner service unavailable");
  return (
    <div className="admin-shell">
      <AdminNav />
      <main id="main-content" className="admin-main">
        {children}
      </main>
    </div>
  );
}
