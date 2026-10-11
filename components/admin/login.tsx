"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";
export function OwnerLogin() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      method="post"
      className="owner-login-card"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        const password = String(
          new FormData(e.currentTarget).get("password") || "",
        );
        try {
          const response = await fetch("/api/admin/login", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ password }),
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.message);
          router.replace("/admin");
          router.refresh();
        } catch (error) {
          setError(
            error instanceof Error ? error.message : "Unable to sign in",
          );
          setBusy(false);
        }
      }}
    >
      <Link href="/" className="brand owner-login-brand" aria-label="vmiyou home">
        <BrandLogo eager />
      </Link>
      <span className="admin-eyebrow">VMIYOU / OWNER ACCESS</span>
      <h1>Your workspace.</h1>
      <p>Sign in to manage your job board and understand its growth.</p>
      <label htmlFor="owner-password">Owner password</label>
      <input
        id="owner-password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        maxLength={256}
      />
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
      <button className="primary-button" disabled={busy}>
        {busy ? "Signing in…" : "Sign in"}
      </button>
      <Link className="inline-link" href="/">
        Back to vmiyou
      </Link>
    </form>
  );
}
