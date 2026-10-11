"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AdminSearchField } from "./search-field";
type Item = { id: string; title?: string; name?: string; status?: string; company?: { name: string } };
type Results = { jobs: Item[]; companies: Item[]; sources: Item[] };
export function AdminSearch() {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Results>();
  const [error, setError] = useState("");
  const open = () => dialog.current?.showModal();
  const close = () => { dialog.current?.close(); trigger.current?.focus(); };
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (dialog.current?.open) dialog.current.close(); else dialog.current?.showModal();
      }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);
  useEffect(() => {
    if (query.trim().length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch("/api/admin/search?q=" + encodeURIComponent(query.trim()), { signal: controller.signal, cache: "no-store" });
        if (!response.ok) throw new Error("Search unavailable");
        setResults(await response.json() as Results);
        setError("");
      } catch { if (!controller.signal.aborted) setError("Search unavailable. Please retry."); }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query]);
  return <>
    <button ref={trigger} type="button" className="admin-search-trigger" onClick={open}>Search all <kbd>⌘ / Ctrl K</kbd></button>
    <dialog ref={dialog} className="admin-dialog admin-search-dialog" aria-label="Search admin records" onClose={() => trigger.current?.focus()}>
      <div className="admin-dialog-heading"><h2>Search admin</h2><button className="icon-button" type="button" aria-label="Close search" onClick={close}>×</button></div>
      <AdminSearchField
        autoFocus
        value={query}
        onChange={(value) => { setQuery(value); setResults(undefined); setError(""); }}
        onClear={() => { setQuery(""); setResults(undefined); setError(""); }}
        placeholder="Jobs, companies, sources…"
        maxLength={100}
        ariaLabel="Search jobs, companies, and sources"
      />
      {error && <p role="alert" className="field-error">{error}</p>}
      {query.trim().length < 2 && <p className="admin-muted">Enter at least 2 characters.</p>}
      {query.trim().length >= 2 && results && <div className="admin-search-results">
        {(["jobs", "companies", "sources"] as const).map((kind) => <section key={kind}><h3>{kind}</h3>
          {results[kind].length ? results[kind].map((item) => <Link key={item.id} href={"/admin/" + kind + "?entity=" + encodeURIComponent(item.id)} onClick={close}>
            <strong>{item.title || item.name}</strong><small>{item.company?.name || item.status || "Open record"}</small>
          </Link>) : <p className="admin-muted">No matches.</p>}
        </section>)}
      </div>}
    </dialog>
  </>;
}
