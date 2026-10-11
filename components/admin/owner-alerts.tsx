"use client";
import Link from "next/link";
import { useAdminData } from "@/features/admin/use-admin-data";
type Alert = { id: string; label: string; href: string };
export function OwnerAlerts() {
  const { data, error } = useAdminData<Alert[]>("alerts", 0, 30000);
  return <section className="admin-panel admin-owner-alerts"><h2>Needs attention</h2>
    {error && !data && <p className="admin-muted">Could not load alerts.</p>}
    {data && (!data.length ? <p className="admin-muted">Everything looks healthy.</p> : <ul>{data.map((alert) => <li key={alert.id}><Link href={alert.href}>{alert.label} →</Link></li>)}</ul>)}
  </section>;
}
