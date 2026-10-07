"use client";
import { useRef, useState, useEffect } from "react";
import { Select } from "@/components/select";
import { adminMutation, useAdminData } from "@/features/admin/use-admin-data";
import type { AdminItem, Collection, Resource } from "@/features/admin/types";
import { categories } from "@/features/jobs/types";
const date = (value?: string | null) =>
  value
    ? new Date(value).toLocaleString("en-GB", { timeZone: "UTC" })
    : "Never";
const names = {
  jobs: "Jobs",
  companies: "Companies",
  sources: "Sources",
  logs: "Import logs",
};
export function ResourceList({ resource }: { resource: Resource }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [editing, setEditing] = useState<AdminItem | null>(null);
  const [deleting, setDeleting] = useState<AdminItem | null>(null);
  const [message, setMessage] = useState("");
  const [failure, setFailure] = useState("");
  const [busy, setBusy] = useState(false);
  const params = new URLSearchParams({ search, page: String(page) });
  if (status) params.set("status", status);
  const { data, error, loading } = useAdminData<Collection>(
    `${resource}?${params}`,
    revision,
  );
  async function change(
    path: string,
    method: string,
    body?: unknown,
    success = "Changes saved.",
  ) {
    setBusy(true);
    setFailure("");
    setMessage("");
    try {
      await adminMutation(path, method, body);
      setMessage(success);
      setRevision((v) => v + 1);
      return true;
    } catch (error) {
      setFailure(error instanceof Error ? error.message : "Request failed");
      return false;
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="admin-page-heading">
        <div>
          <span className="admin-eyebrow">JOB BOARD MANAGEMENT</span>
          <h1>{names[resource]}</h1>
          <p>
            {resource === "logs"
              ? "Every import, with its outcome. Retained for 30 days."
              : resource === "sources"
                ? "Connect career boards and keep opportunities fresh."
                : resource === "jobs"
                  ? "Review listings and curate what candidates see."
                  : "The teams behind your opportunities."}
          </p>
        </div>
        {["companies", "sources"].includes(resource) && (
          <button
            className="primary-button"
            onClick={() => setEditing({ id: "", enabled: false })}
          >
            Add {resource === "companies" ? "company" : "source"}
          </button>
        )}
      </div>
      <form
        className="admin-toolbar"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setSearch(
            String(new FormData(e.currentTarget).get("search") || "").trim(),
          );
        }}
      >
        <label>
          <span className="sr-only">Search {resource}</span>
          <input
            name="search"
            placeholder={`Search ${resource}…`}
            maxLength={150}
          />
        </label>
        <button className="primary-button">Search</button>
        {resource === "jobs" && (
          <Select
            aria-label="Job status"
            value={status}
            onChange={(v) => {
              setStatus(v);
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="CLOSED">Closed</option>
            <option value="HIDDEN">Hidden</option>
          </Select>
        )}
        <button
          className="admin-button"
          type="button"
          onClick={() => setRevision((v) => v + 1)}
        >
          Refresh
        </button>
      </form>
      {message && (
        <p className="admin-notice" role="status">
          {message}
        </p>
      )}
      {(failure || error) && (
        <p className="field-error" role="alert">
          {failure || error}
        </p>
      )}
      <section className="admin-panel admin-resource-panel" aria-busy={loading}>
        {loading ? (
          <div className="admin-loading" role="status">
            Loading {resource}…<span className="skeleton-line" />
          </div>
        ) : (
          data && (
            <>
              <div className="admin-panel-heading">
                <h2>
                  {data.total} {resource === "logs" ? "imports" : resource}
                </h2>
                <span>
                  Page {data.page} of {Math.max(1, data.pages)}
                </span>
              </div>
              <div className="admin-table-scroll">
                <table>
                  <thead>
                    <tr>
                      {resource === "jobs" ? (
                        <>
                          <th>Role / company</th>
                          <th>Status</th>
                          <th>Source</th>
                          <th>Actions</th>
                        </>
                      ) : resource === "companies" ? (
                        <>
                          <th>Company</th>
                          <th>Status</th>
                          <th>Jobs / sources</th>
                          <th>Actions</th>
                        </>
                      ) : resource === "sources" ? (
                        <>
                          <th>Source / company</th>
                          <th>Status</th>
                          <th>Last sync / successful</th>
                          <th>Imported jobs</th>
                          <th>Actions</th>
                        </>
                      ) : (
                        <>
                          <th>Source</th>
                          <th>Started / finished (UTC)</th>
                          <th>Status</th>
                          <th>Found / created / updated / closed</th>
                          <th>Error</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((item) => (
                      <tr key={item.id}>
                        {resource === "jobs" ? (
                          <>
                            <td>
                              <strong>{item.title}</strong>
                              <small>{item.company?.name}</small>
                              {item.manualOverride && (
                                <small>Manual edits protected</small>
                              )}
                            </td>
                            <td>
                              <span
                                className={`admin-status status-${item.status?.toLowerCase()}`}
                              >
                                {item.status}
                              </span>
                              {item.statusOverride && (
                                <small>Owner override</small>
                              )}
                            </td>
                            <td>{item.source?.name}</td>
                            <td>
                              <div className="admin-row-actions">
                                <button
                                  disabled={busy}
                                  onClick={() => setEditing(item)}
                                >
                                  Edit
                                </button>
                                <button
                                  disabled={busy}
                                  onClick={() =>
                                    void change(
                                      `jobs/${item.id}/status`,
                                      "PATCH",
                                      {
                                        status:
                                          item.status === "HIDDEN"
                                            ? "ACTIVE"
                                            : "HIDDEN",
                                      },
                                    )
                                  }
                                >
                                  {item.status === "HIDDEN" ? "Unhide" : "Hide"}
                                </button>
                                <button
                                  disabled={busy}
                                  onClick={() =>
                                    void change(
                                      `jobs/${item.id}/status`,
                                      "PATCH",
                                      {
                                        status:
                                          item.status === "CLOSED"
                                            ? "ACTIVE"
                                            : "CLOSED",
                                      },
                                    )
                                  }
                                >
                                  {item.status === "CLOSED"
                                    ? "Reopen"
                                    : "Mark closed"}
                                </button>
                                <button
                                  disabled={busy}
                                  className="danger"
                                  onClick={() => setDeleting(item)}
                                >
                                  Delete
                                </button>
                                {(item.manualOverride ||
                                  item.statusOverride) && (
                                  <button
                                    disabled={busy}
                                    onClick={() =>
                                      void change(
                                        `jobs/${item.id}/reset`,
                                        "POST",
                                        {},
                                        "Import overrides cleared. Next sync restores source data.",
                                      )
                                    }
                                  >
                                    Use source data
                                  </button>
                                )}
                              </div>
                            </td>
                          </>
                        ) : resource === "companies" ? (
                          <>
                            <td>
                              <strong>{item.name}</strong>
                              <small>
                                {item.country || "Country not specified"}
                              </small>
                            </td>
                            <td>
                              <span
                                className={`admin-status status-${item.enabled ? "active" : "closed"}`}
                              >
                                {item.enabled ? "Enabled" : "Disabled"}
                              </span>
                            </td>
                            <td>
                              {item._count?.jobs} / {item._count?.sources}
                            </td>
                            <td>
                              <div className="admin-row-actions">
                                <button
                                  disabled={busy}
                                  onClick={() => setEditing(item)}
                                >
                                  Edit
                                </button>
                                <button
                                  disabled={busy}
                                  onClick={() =>
                                    void change(
                                      `companies/${item.id}`,
                                      "PATCH",
                                      companyBody(item, !item.enabled),
                                    )
                                  }
                                >
                                  {item.enabled ? "Disable" : "Enable"}
                                </button>
                              </div>
                            </td>
                          </>
                        ) : resource === "sources" ? (
                          <>
                            <td>
                              <strong>{item.name}</strong>
                              <small>
                                {item.company?.name} · {item.type}
                              </small>
                              <small>{item.sourceIdentifier}</small>
                              {item.lastError && (
                                <small className="field-error">
                                  {item.lastError}
                                </small>
                              )}
                            </td>
                            <td>
                              <span
                                className={`admin-status status-${item.enabled ? "active" : "closed"}`}
                              >
                                {item.enabled ? "Enabled" : "Disabled"}
                              </span>
                              {!item.company?.enabled && (
                                <small>Company disabled</small>
                              )}
                            </td>
                            <td>
                              {date(item.lastSyncAt)}
                              <small>{date(item.lastSuccessfulSync)}</small>
                            </td>
                            <td>{item._count?.jobs}</td>
                            <td>
                              <div className="admin-row-actions">
                                <button
                                  disabled={busy || item.type === "MANUAL"}
                                  onClick={() => setEditing(item)}
                                >
                                  Edit
                                </button>
                                <button
                                  disabled={busy || item.type === "MANUAL"}
                                  onClick={() =>
                                    void change(
                                      `sources/${item.id}`,
                                      "PATCH",
                                      sourceBody(item, !item.enabled),
                                    )
                                  }
                                >
                                  {item.enabled ? "Disable" : "Enable"}
                                </button>
                                <button
                                  disabled={
                                    busy ||
                                    !item.enabled ||
                                    !item.company?.enabled ||
                                    item.type === "MANUAL"
                                  }
                                  onClick={() =>
                                    void change(
                                      `sources/${item.id}/sync`,
                                      "POST",
                                      {},
                                      "Sync queued. Refresh import logs to see its outcome.",
                                    )
                                  }
                                >
                                  Sync now
                                </button>
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
                            <td>
                              <strong>{item.source?.name}</strong>
                            </td>
                            <td>
                              {date(item.startedAt)}
                              <small>{date(item.finishedAt)}</small>
                            </td>
                            <td>
                              <span
                                className={`admin-status status-${item.status?.toLowerCase()}`}
                              >
                                {item.status}
                              </span>
                            </td>
                            <td>
                              {item.jobsFound} / {item.jobsCreated} /{" "}
                              {item.jobsUpdated} / {item.jobsClosed}
                            </td>
                            <td>{item.error || "—"}</td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {data.items.length === 0 && (
                <div className="admin-empty">
                  <h3>Nothing here yet.</h3>
                  <p>
                    {search || status
                      ? "Try another search or status."
                      : resource === "logs"
                        ? "Run a source sync to create your first import log."
                        : "Add or import your first records to get started."}
                  </p>
                </div>
              )}
              {data.pages > 1 && (
                <nav className="admin-pagination" aria-label="Admin pagination">
                  <button
                    className="admin-button"
                    disabled={page === 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Previous
                  </button>
                  <span>
                    {page} / {data.pages}
                  </span>
                  <button
                    className="admin-button"
                    disabled={page >= data.pages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </button>
                </nav>
              )}
            </>
          )
        )}
      </section>
      {editing && (
        <Editor
          resource={resource}
          item={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            setRevision((v) => v + 1);
            setMessage("Changes saved.");
          }}
        />
      )}
      {deleting && (
        <Modal title="Delete this job?" onClose={() => setDeleting(null)}>
          <p>
            <strong>{deleting.title}</strong>
          </p>
          <p>
            This removes the listing and prevents its source from importing it
            again. Analytics counts remain anonymous.
          </p>
          <div className="admin-form-actions">
            <button className="admin-button" onClick={() => setDeleting(null)}>
              Cancel
            </button>
            <button
              className="primary-button"
              disabled={busy}
              onClick={async () => {
                if (
                  await change(
                    `jobs/${deleting.id}`,
                    "DELETE",
                    undefined,
                    "Job deleted.",
                  )
                )
                  setDeleting(null);
              }}
            >
              Delete job
            </button>
          </div>
          {failure && (
            <p role="alert" className="field-error">
              {failure}
            </p>
          )}
        </Modal>
      )}
    </>
  );
}
function companyBody(item: AdminItem, enabled: boolean) {
  return {
    name: item.name,
    slug: item.slug,
    website: item.website || null,
    careerUrl: item.careerUrl || null,
    country: item.country || null,
    enabled,
  };
}
function sourceBody(item: AdminItem, enabled: boolean) {
  return {
    name: item.name,
    type: item.type,
    companyId: item.companyId,
    sourceIdentifier: item.sourceIdentifier,
    enabled,
  };
}
function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.showModal();
    return () => previous?.focus();
  }, []);
  return (
    <dialog
      ref={ref}
      className="admin-dialog"
      aria-labelledby="admin-dialog-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className="admin-dialog-heading">
        <h2 id="admin-dialog-title">{title}</h2>
        <button
          className="icon-button"
          aria-label="Close editor"
          onClick={onClose}
        >
          ×
        </button>
      </div>
      {children}
    </dialog>
  );
}
function Editor({
  resource,
  item,
  onClose,
  onSaved,
}: {
  resource: Resource;
  item: AdminItem;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [type, setType] = useState(item.type || "GREENHOUSE");
  const [remote, setRemote] = useState(item.remoteType || "UNKNOWN");
  const [experience, setExperience] = useState(item.experienceLevel || "");
  const [category, setCategory] = useState(item.category || "Other");
  const field = (
    name: keyof AdminItem,
    label: string,
    options: { required?: boolean; type?: string; maxLength?: number } = {},
  ) => (
    <label className="admin-field" key={name}>
      <span>{label}</span>
      <input name={name} defaultValue={String(item[name] ?? "")} {...options} />
    </label>
  );
  return (
    <Modal
      title={`${item.id ? "Edit" : "Add"} ${resource === "jobs" ? "job" : resource === "companies" ? "company" : "source"}`}
      onClose={onClose}
    >
      <form
        className="admin-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          const form = new FormData(e.currentTarget);
          const text = (key: string) => String(form.get(key) || "").trim();
          const nullable = (key: string) => text(key) || null;
          let body: unknown;
          if (resource === "companies")
            body = {
              name: text("name"),
              slug: text("slug"),
              website: nullable("website"),
              careerUrl: nullable("careerUrl"),
              country: nullable("country"),
              enabled: form.has("enabled"),
            };
          else if (resource === "sources")
            body = {
              name: text("name"),
              type,
              companyId: item.id ? item.companyId : text("companyId"),
              sourceIdentifier: text("sourceIdentifier"),
              enabled: form.has("enabled"),
            };
          else
            body = {
              title: text("title"),
              description: text("description"),
              shortDescription: text("shortDescription"),
              category,
              location: text("location"),
              remoteType: remote,
              experienceLevel: experience || null,
              salaryMin: text("salaryMin") ? Number(text("salaryMin")) : null,
              salaryMax: text("salaryMax") ? Number(text("salaryMax")) : null,
              currency: nullable("currency")?.toUpperCase() || null,
              technologies: text("technologies")
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean),
              applyUrl: text("applyUrl"),
            };
          try {
            await adminMutation(
              resource + (item.id ? "/" + item.id : ""),
              item.id ? "PATCH" : "POST",
              body,
            );
            onSaved();
          } catch (error) {
            setError(error instanceof Error ? error.message : "Unable to save");
            setBusy(false);
          }
        }}
      >
        {resource === "jobs" ? (
          <>
            {field("title", "Job title", { required: true, maxLength: 250 })}
            <label className="admin-field">
              <span>Description</span>
              <textarea
                name="description"
                defaultValue={item.description}
                required
                maxLength={100000}
                rows={9}
              />
            </label>
            {field("shortDescription", "Short description", {
              maxLength: 1000,
            })}
            <label className="admin-field">
              <span>Category</span>
              <Select
                value={category}
                onChange={setCategory}
                aria-label="Category"
              >
                {[
                  ...new Set([...categories, item.category].filter(Boolean)),
                ].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </Select>
            </label>
            {field("location", "Location", { maxLength: 500 })}
            <div className="admin-form-grid">
              <label className="admin-field">
                <span>Work arrangement</span>
                <Select
                  value={remote}
                  onChange={setRemote}
                  aria-label="Work arrangement"
                >
                  {["UNKNOWN", "REMOTE", "HYBRID", "ON_SITE"].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </Select>
              </label>
              <label className="admin-field">
                <span>Experience</span>
                <Select
                  value={experience}
                  onChange={setExperience}
                  aria-label="Experience"
                >
                  <option value="">Not specified</option>
                  {["Junior", "Middle", "Senior", "Lead"].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </Select>
              </label>
            </div>
            <div className="admin-form-grid">
              {field("salaryMin", "Annual salary from", { type: "number" })}
              {field("salaryMax", "Annual salary to", { type: "number" })}
            </div>
            {field("currency", "Currency code (e.g. USD)", { maxLength: 3 })}
            <label className="admin-field">
              <span>Technologies (comma separated)</span>
              <input
                name="technologies"
                defaultValue={item.technologies?.join(", ")}
                maxLength={1000}
              />
            </label>
            {field("applyUrl", "Apply URL", { type: "url", required: true })}
            <p className="admin-muted">
              Manual edits stay protected during imports. Use “Use source data”
              to restore automatic updates.
            </p>
          </>
        ) : (
          <>
            {field("name", "Name", { required: true, maxLength: 120 })}
            {resource === "companies" ? (
              <>
                {field("slug", "URL slug", { required: true, maxLength: 120 })}
                {field("website", "Website", { type: "url" })}
                {field("careerUrl", "Careers URL", { type: "url" })}
                {field("country", "Country", { maxLength: 80 })}
              </>
            ) : (
              <>
                {item.id ? (
                  <p>
                    Company: {item.company?.name}. To change the board or
                    company, add a new source.
                  </p>
                ) : (
                  <CompanyField />
                )}
                <label className="admin-field">
                  <span>Provider</span>
                  <Select
                    value={type}
                    onChange={setType}
                    disabled={!!item.id}
                    aria-label="Provider"
                  >
                    {["GREENHOUSE", "LEVER", "ASHBY"].map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </Select>
                </label>
                <label className="admin-field">
                  <span>Source identifier</span>
                  <input
                    name="sourceIdentifier"
                    defaultValue={item.sourceIdentifier}
                    required
                    readOnly={!!item.id}
                    maxLength={100}
                  />
                </label>
                <p className="admin-muted">
                  Board identifier, not a URL. For a Lever EU board use
                  eu:board-name.
                </p>
              </>
            )}
            <label className="admin-checkbox">
              <input
                type="checkbox"
                name="enabled"
                defaultChecked={item.enabled}
              />{" "}
              Enabled
            </label>
            {resource === "companies" && (
              <p className="admin-muted">
                Disabling a company hides its jobs and pauses its source
                imports.
              </p>
            )}
          </>
        )}
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        <div className="admin-form-actions">
          <button type="button" className="admin-button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary-button" disabled={busy}>
            {busy ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
function CompanyField() {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState("");
  const [chosen, setChosen] = useState<AdminItem>();
  const { data } = useAdminData<Collection>(
    "companies?search=" + encodeURIComponent(search),
  );
  const options = data?.items || [];
  return (
    <div className="admin-field">
      <label>
        Find a company
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          maxLength={150}
          placeholder="Search by company name"
        />
      </label>
      <Select
        aria-label="Company"
        value={selected}
        onChange={(v) => {
          setSelected(v);
          setChosen(options.find((c) => c.id === v));
        }}
      >
        <option value="">Choose a company</option>
        {chosen && !options.some((c) => c.id === chosen.id) && (
          <option value={chosen.id}>{chosen.name}</option>
        )}
        {options.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </Select>
      <input type="hidden" name="companyId" value={selected} />
    </div>
  );
}
