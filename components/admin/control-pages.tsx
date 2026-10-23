"use client";
import { useState } from "react";
import Link from "next/link";
import { Select } from "@/components/select";
import { AdminMutationError, adminMutation, useAdminData } from "@/features/admin/use-admin-data";

type SystemInfo = {
  api: string; database: string; redis: string;
  queue: Record<"waiting" | "active" | "failed" | "delayed", number>;
  sources: { total: number; enabled: number };
  lastImport: { finishedAt: string | null; source: { name: string } } | null;
};
type SyncInfo = {
  enabled: boolean;
  intervalHours: number;
  revision: number;
  appliedRevision: number;
  saved: boolean;
  applied: boolean;
  lastApplyError: string | null;
  scheduler: {
    status: "active" | "disabled" | "pending" | "error" | "unavailable";
    nextRunAt: string | null;
    intervalHours: number | null;
    error: string | null;
  };
};
type Integration = { provider: string; label: string; identifier: string; enabled: boolean; status: string };
type AuditEntry = { id: string; action: string; entityType: string; entityId: string | null; createdAt: string; details: unknown };
type AuditData = { items: AuditEntry[]; page: number; pages: number; total: number };

function Status({ value }: { value: string }) {
  return <span className={"admin-status status-" + (value === "Online" || value === "Active" ? "active" : "closed")}>{value}</span>;
}

export function SystemPage({ version }: { version: string }) {
  const [revision, setRevision] = useState(0);
  const { data, error, loading } = useAdminData<SystemInfo>("system", revision);
  const { data: sync, error: syncError, loading: syncLoading } = useAdminData<SyncInfo>("sync", revision);
  return <>
    <div className="admin-page-heading"><div><span className="admin-eyebrow">PLATFORM HEALTH</span><h1>System</h1><p>Live status when you open or refresh this page.</p></div><button className="admin-button" onClick={() => setRevision((v) => v + 1)}>Refresh</button></div>
    {loading && <p role="status">Checking services…</p>}{error && <p role="alert" className="field-error">{error}</p>}
    <div className="admin-control-grid">
      {data && <>
        <section className="admin-panel"><h2>Services</h2><dl className="admin-details"><div><dt>API</dt><dd><Status value={data.api} /></dd></div><div><dt>Database</dt><dd><Status value={data.database} /></dd></div><div><dt>Redis / queue</dt><dd><Status value={data.redis} /></dd></div></dl></section>
        <section className="admin-panel"><h2>Sync queue</h2><dl className="admin-details">{Object.entries(data.queue).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl></section>
        <section className="admin-panel"><h2>Sources</h2><p>{data.sources.enabled} enabled of {data.sources.total}</p><p>Last successful import: {data.lastImport?.finishedAt ? new Date(data.lastImport.finishedAt).toLocaleString() : "None yet"}</p><p>{data.lastImport?.source.name}</p><Link href="/admin/sources">Manage sources →</Link></section>
      </>}
      {syncLoading && <section className="admin-panel"><h2>Automatic synchronization</h2><p role="status">Loading scheduler settings…</p></section>}
      {syncError && <section className="admin-panel"><h2>Automatic synchronization</h2><p role="alert" className="field-error">{syncError}</p></section>}
      {sync && <SyncSettingsCard key={sync.revision} data={sync} />}
      <section className="admin-panel"><h2>Release</h2><p className="admin-version">v{version}</p></section>
    </div>
  </>;
}

function SyncSettingsCard({ data }: { data: SyncInfo }) {
  const [view, setView] = useState(data);
  const [enabled, setEnabled] = useState(data.enabled);
  const [intervalHours, setIntervalHours] = useState(String(data.intervalHours));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failure, setFailure] = useState("");
  async function save() {
    setBusy(true);
    setMessage("");
    setFailure("");
    try {
      const result = await adminMutation("sync", "PATCH", {
        enabled,
        intervalHours: Number(intervalHours),
        revision: view.revision,
      }) as SyncInfo;
      setView(result);
      setEnabled(result.enabled);
      setIntervalHours(String(result.intervalHours));
      setMessage(result.applied
        ? "Settings saved and scheduler applied."
        : "Settings saved. Scheduler application is pending automatic reconciliation.");
    } catch (error) {
      if (error instanceof AdminMutationError && error.status === 409) {
        setFailure("Settings changed in another session. The latest values have been loaded; review them and save again.");
        const response = await fetch("/api/admin/sync", { cache: "no-store" });
        if (response.ok) {
          const latest = await response.json() as SyncInfo;
          setView(latest);
          setEnabled(latest.enabled);
          setIntervalHours(String(latest.intervalHours));
        }
      } else {
        setFailure(error instanceof Error ? error.message : "Could not save synchronization settings.");
      }
    } finally {
      setBusy(false);
    }
  }

  const schedulerStatus = view.scheduler.status[0]?.toUpperCase() + view.scheduler.status.slice(1);
  const next = view.scheduler.nextRunAt
    ? `${new Date(view.scheduler.nextRunAt).toLocaleString("en-GB", { timeZone: "UTC" })} UTC`
    : "Not scheduled";
  return <section className="admin-panel admin-sync-settings">
    <div className="admin-panel-heading"><h2>Automatic synchronization</h2><Status value={schedulerStatus} /></div>
    <p className="admin-muted">Settings are stored in PostgreSQL. Scheduler status reflects the active BullMQ schedule.</p>
    <form onSubmit={(event) => { event.preventDefault(); void save(); }}>
      <label className="admin-checkbox"><input type="checkbox" checked={enabled} disabled={busy} onChange={(event) => setEnabled(event.target.checked)} /> Automatic synchronization</label>
      <label className="admin-field"><span>Sync interval</span><Select aria-label="Sync interval" value={intervalHours} disabled={busy} onChange={setIntervalHours}>{[1, 3, 6, 12, 24].map((hours) => <option key={hours} value={String(hours)}>{hours} {hours === 1 ? "hour" : "hours"}</option>)}</Select></label>
      <dl className="admin-details">
        <div><dt>Saved configuration</dt><dd>{view.enabled ? `Every ${view.intervalHours} hours` : "Disabled"}</dd></div>
        <div><dt>Scheduler status</dt><dd>{schedulerStatus}</dd></div>
        <div><dt>Next scheduled sync</dt><dd>{next}</dd></div>
      </dl>
      {view.lastApplyError && <p className="field-error" role="alert">Saved, but not applied: {view.lastApplyError}</p>}
      {view.scheduler.error && <p className="field-error" role="alert">Scheduler unavailable: {view.scheduler.error}</p>}
      {message && <p className="admin-notice" role="status">{message}</p>}
      {failure && <p className="field-error" role="alert">{failure}</p>}
      <div className="admin-form-actions"><button className="primary-button" type="submit" disabled={busy}>{busy ? "Saving…" : "Save settings"}</button></div>
    </form>
  </section>;
}

export function IntegrationsPage() {
  const [revision, setRevision] = useState(0);
  const { data, error, loading } = useAdminData<Integration[]>("integrations", revision);
  return <>
    <div className="admin-page-heading"><div><span className="admin-eyebrow">PLATFORM</span><h1>Integrations</h1><p>Scripts load on the public site only when enabled with a valid ID and analytics is allowed.</p></div></div>
    {loading && <p role="status">Loading integrations…</p>}{error && <p role="alert" className="field-error">{error}</p>}
    {data && <div className="admin-control-grid">{data.map((item) => <IntegrationCard key={item.provider} item={item} onSaved={() => setRevision((v) => v + 1)} />)}</div>}
    <p className="admin-footnote">Use either Google Analytics 4 or Google Tag Manager to install GA4 tracking; enabling both can count visits twice if GTM also contains GA4. External vendors may process data under their own policies.</p>
  </>;
}
function IntegrationCard({ item, onSaved }: { item: Integration; onSaved: () => void }) {
  const [identifier, setIdentifier] = useState(item.identifier);
  const [enabled, setEnabled] = useState(item.enabled);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const hint: Record<string, string> = { ga4: "G-XXXXXXXX", gtm: "GTM-XXXXXXX", meta: "Numeric Pixel ID", clarity: "Clarity project ID" };
  async function save() {
    setBusy(true); setMessage("");
    try { await adminMutation("integrations/" + item.provider, "PATCH", { identifier: identifier.trim(), enabled }); setIdentifier(identifier.trim()); setMessage("Saved."); onSaved(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Could not save."); }
    finally { setBusy(false); }
  }
  return <section className="admin-panel admin-integration"><div className="admin-panel-heading"><h2>{item.label}</h2><Status value={item.status} /></div><label className="admin-field"><span>Public ID</span><input value={identifier} maxLength={50} placeholder={hint[item.provider]} onChange={(event) => setIdentifier(event.target.value)} autoComplete="off" /></label><label className="admin-checkbox"><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} /> Enabled</label><div className="admin-form-actions"><button className="primary-button" disabled={busy} onClick={() => void save()}>Save settings</button></div>{message && <p role="status">{message}</p>}</section>;
}

export function AuditLogPage() {
  const [page, setPage] = useState(1);
  const { data, error, loading } = useAdminData<AuditData>("audit-logs?page=" + page);
  return <>
    <div className="admin-page-heading"><div><span className="admin-eyebrow">ACCOUNTABILITY</span><h1>Audit log</h1><p>Owner changes to jobs, companies, sources, and integrations. Times are UTC.</p></div></div>
    {loading && <p role="status">Loading history…</p>}{error && <p role="alert" className="field-error">{error}</p>}
    {data && <section className="admin-panel"><div className="admin-panel-heading"><h2>{data.total} changes</h2></div><div className="admin-table-scroll"><table><thead><tr><th>Time</th><th>Action</th><th>Record</th><th>Details</th></tr></thead><tbody>{data.items.map((entry) => <tr key={entry.id}><td>{new Date(entry.createdAt).toLocaleString("en-GB", { timeZone: "UTC" })}</td><td>{entry.action.replaceAll("_", " ")}</td><td>{entry.entityType} {entry.entityId}</td><td>{entry.details ? JSON.stringify(entry.details) : "—"}</td></tr>)}</tbody></table></div>{data.items.length === 0 && <p className="admin-empty">No owner changes recorded yet.</p>}{data.pages > 1 && <nav className="admin-pagination" aria-label="Audit log pages"><button className="admin-button" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button><span>{page} / {data.pages}</span><button className="admin-button" disabled={page >= data.pages} onClick={() => setPage(page + 1)}>Next</button></nav>}</section>}
  </>;
}
