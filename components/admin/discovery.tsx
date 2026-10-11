"use client";

import Link from "next/link";
import { useState } from "react";
import { Select } from "@/components/select";
import { adminMutation, useAdminData } from "@/features/admin/use-admin-data";
import { AdminSearchField } from "./search-field";

type Company = {
  id: string; name: string; website: string | null; careerUrl: string | null;
  country: string | null; discoveredFrom: string | null; discoveredAt: string | null;
  discoveryStatus: string; lastDiscoveryAt: string | null; discoveryAttempts: number;
  nextRetryAt: string | null; detectedAts: string | null;
  detectedIdentifier: string | null; discoveryConfidence: string | null;
  validationStatus: string | null; discoveryError: string | null;
  discoverySourceId: string | null; jobsImported: number;
};
type Metrics = Record<"companiesDiscovered" | "atsDetected" | "sourcesCreated" |
  "sourcesValidated" | "jobsImported" | "failedDetections" | "unknownAts", number>;
type Collection = { items: Company[]; total: number; page: number; pages: number; metrics: Metrics };
const metrics: { key: keyof Metrics; label: string }[] = [
  { key: "companiesDiscovered", label: "Companies discovered" },
  { key: "atsDetected", label: "ATS detected" },
  { key: "sourcesCreated", label: "Sources created" },
  { key: "sourcesValidated", label: "Sources validated" },
  { key: "jobsImported", label: "Jobs imported" },
  { key: "failedDetections", label: "Failed detections" },
  { key: "unknownAts", label: "Unknown ATS" },
];
const statuses = ["PENDING", "SCANNING", "REVIEW", "ENABLED", "KNOWN", "FAILED", "REJECTED", "IGNORED"];
const date = (value: string | null) => value ? new Date(value).toLocaleString("en-GB", { timeZone: "UTC" }) : "—";

export function DiscoveryPage() {
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [failure, setFailure] = useState("");
  const params = new URLSearchParams({ page: String(page), search });
  if (status) params.set("status", status);
  const { data, loading, error } = useAdminData<Collection>(`discovery?${params}`, revision);
  async function act(item: Company, action: string) {
    setBusy(item.id); setNotice(""); setFailure("");
    try {
      await adminMutation(`discovery/${item.id}/${action}`, "POST");
      setNotice(`${action === "create-source" ? "Source created disabled" : `${action} queued or saved`} for ${item.name}.`);
      setRevision((value) => value + 1);
    } catch (cause) {
      setFailure(cause instanceof Error ? cause.message : "Action failed");
    } finally { setBusy(null); }
  }
  return <>
    <div className="admin-page-heading"><div><span className="admin-eyebrow">SOURCE EXPANSION</span>
      <h1>Discovery</h1><p>Companies found in imported jobs and approved catalogs. Review uncertain ATS matches here.</p>
    </div></div>
    {data && <div className="admin-kpis admin-discovery-kpis">{metrics.map(({ key, label }) =>
      <div className="admin-kpi" key={key}><span>{label}</span><strong>{data.metrics[key]}</strong></div>)}</div>}
    <form className="admin-toolbar" onSubmit={(event) => { event.preventDefault(); setSearch(draft.trim()); setPage(1); }}>
      <AdminSearchField ariaLabel="Search discovered companies" value={draft} onChange={setDraft}
        onClear={() => { setDraft(""); setSearch(""); setStatus(""); setPage(1); }}
        showClear={Boolean(draft || search)} placeholder="Search companies…" maxLength={150} />
      <button className="primary-button" type="submit">Search</button>
      <Select aria-label="Discovery status" value={status} onChange={(value) => { setStatus(value); setPage(1); }}>
        <option value="">All statuses</option>{statuses.map((value) => <option key={value} value={value}>{value}</option>)}
      </Select>
      <button className="admin-button" type="button" onClick={() => setRevision((value) => value + 1)}>Refresh</button>
    </form>
    {notice && <p className="admin-notice" role="status">{notice}</p>}
    {(failure || error) && <p className="field-error" role="alert">{failure || error}</p>}
    <section className="admin-panel admin-resource-panel admin-discovery-panel" aria-busy={loading}>
      {loading ? <div className="admin-loading" role="status">Loading discovery…</div> : data && <>
        <div className="admin-panel-heading"><h2>{data.total} companies</h2><span>Page {data.page} of {Math.max(1, data.pages)}</span></div>
        <div className="admin-table-scroll"><table><thead><tr>
          <th>Company</th><th>Career page</th><th>ATS / identifier</th><th>Confidence / validation</th>
          <th>Status / jobs</th><th>Last attempt / error</th><th>Actions</th>
        </tr></thead><tbody>{data.items.map((item) => <tr key={item.id}>
          <td><strong>{item.name}</strong><small>{item.country || "Country unknown"} · {item.discoveredFrom || "Unknown source"}</small>
            <small>Found {date(item.discoveredAt)}</small>{item.website && <a href={item.website} target="_blank" rel="noopener noreferrer">Website ↗</a>}</td>
          <td>{item.careerUrl ? <a href={item.careerUrl} target="_blank" rel="noopener noreferrer">Open careers ↗</a> : "—"}</td>
          <td><strong>{item.detectedAts || "UNKNOWN"}</strong><small>{item.detectedIdentifier || "No identifier"}</small></td>
          <td>{item.discoveryConfidence || "—"}<small>{item.validationStatus || "NOT_TESTED"}</small></td>
          <td><span className="admin-status">{item.discoveryStatus}</span><small>{item.jobsImported} imported jobs</small>
            {item.discoverySourceId && <Link href={`/admin/sources?entity=${item.discoverySourceId}`}>View source</Link>}</td>
          <td>{date(item.lastDiscoveryAt)}<small>{item.discoveryAttempts} attempts{item.nextRetryAt ? ` · retry ${date(item.nextRetryAt)}` : ""}</small>
            {item.discoveryError && <small className="admin-discovery-error">{item.discoveryError}</small>}</td>
          <td><div className="admin-row-actions">
            {["REVIEW", "FAILED", "PENDING"].includes(item.discoveryStatus) && item.detectedIdentifier && <button disabled={!!busy} onClick={() => void act(item, "approve")}>Approve</button>}
            {["REVIEW", "FAILED", "PENDING", "REJECTED", "IGNORED"].includes(item.discoveryStatus) && <button disabled={!!busy} onClick={() => void act(item, "retry")}>Retry</button>}
            {item.detectedIdentifier && !item.discoverySourceId && <button disabled={!!busy} onClick={() => void act(item, "create-source")}>Create Source</button>}
            {!["ENABLED", "KNOWN", "REJECTED", "IGNORED"].includes(item.discoveryStatus) && <button className="danger" disabled={!!busy} onClick={() => void act(item, "reject")}>Reject</button>}
            {!["ENABLED", "KNOWN", "IGNORED"].includes(item.discoveryStatus) && <button disabled={!!busy} onClick={() => void act(item, "ignore")}>Ignore company</button>}
          </div></td>
        </tr>)}</tbody></table></div>
        {!data.items.length && <div className="admin-empty">No companies match this filter.</div>}
        <div className="admin-pagination"><button className="admin-button" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
          <span>{page} / {Math.max(1, data.pages)}</span><button className="admin-button" disabled={page >= data.pages} onClick={() => setPage(page + 1)}>Next</button></div>
      </>}
    </section>
  </>;
}
