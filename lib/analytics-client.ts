"use client";
// getRandomValues also works on local-network HTTP previews, where browsers
// do not expose randomUUID. Both paths use browser cryptographic randomness.
function anonymousId() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
type Session = {
  id: string;
  last: number;
  referrer?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
};
export function trackingDisabled() {
  try {
    return (
      navigator.doNotTrack === "1" ||
      (navigator as Navigator & { globalPrivacyControl?: boolean })
        .globalPrivacyControl ||
      localStorage.getItem("openrole-analytics-disabled") === "1"
    );
  } catch {
    return true;
  }
}
export function track(
  type: "PAGE_VIEW" | "JOB_VIEW" | "APPLY_CLICK",
  path: string,
  jobId?: string,
) {
  if (
    trackingDisabled() ||
    !trackedPath(path)
  )
    return;
  try {
    const now = Date.now();
    let visitor = JSON.parse(
      localStorage.getItem("openrole-visitor") || "null",
    ) as { id: string; expires: number } | null;
    if (!visitor || visitor.expires < now) {
      visitor = { id: anonymousId(), expires: now + 30 * 86400000 };
      localStorage.setItem("openrole-visitor", JSON.stringify(visitor));
    }
    let session = JSON.parse(
      sessionStorage.getItem("openrole-session") || "null",
    ) as Session | null;
    if (!session || now - session.last > 1800000) {
      const params = new URLSearchParams(location.search);
      const ref = document.referrer ? new URL(document.referrer) : null;
      session = {
        id: anonymousId(),
        last: now,
        referrer:
          ref && ref.origin !== location.origin ? ref.hostname : undefined,
        utmSource: params.get("utm_source")?.slice(0, 100),
        utmMedium: params.get("utm_medium")?.slice(0, 100),
        utmCampaign: params.get("utm_campaign")?.slice(0, 100),
      };
    }
    session.last = now;
    sessionStorage.setItem("openrole-session", JSON.stringify(session));
    const payload = {
      id: anonymousId(),
      type,
      path,
      jobId,
      visitorId: visitor.id,
      sessionId: session.id,
      referrer: session.referrer,
      utmSource: session.utmSource,
      utmMedium: session.utmMedium,
      utmCampaign: session.utmCampaign,
    };
    const body = JSON.stringify(payload);
    if (
      !navigator.sendBeacon(
        "/api/events",
        new Blob([body], { type: "application/json" }),
      )
    )
      void fetch("/api/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {});
  } catch {
    /* Storage restrictions and analytics failures never affect navigation. */
  }
}

export function trackedPath(path: string) {
  return /^\/(?:jobs(?:\/[a-zA-Z0-9_-]+)?|companies(?:\/[a-zA-Z0-9_-]+)?|(?:categories|technologies|locations)\/[a-zA-Z0-9_-]+|remote-jobs|privacy)?$/.test(path);
}

export function activity(kind: "HEARTBEAT" | "SEARCH" | "FILTER", seconds = 0) {
  if (trackingDisabled() || document.visibilityState !== "visible") return;
  try {
    const session = JSON.parse(sessionStorage.getItem("openrole-session") || "null") as Session | null;
    const visitor = JSON.parse(localStorage.getItem("openrole-visitor") || "null") as { id: string } | null;
    if (!session || !visitor || Date.now() - session.last > 1800000) return;
    session.last = Date.now();
    sessionStorage.setItem("openrole-session", JSON.stringify(session));
    const body = JSON.stringify({ sessionId: session.id, visitorId: visitor.id, kind, seconds: Math.max(0, Math.min(60, Math.floor(seconds))) });
    if (!navigator.sendBeacon("/api/activity", new Blob([body], { type: "application/json" })))
      void fetch("/api/activity", { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true }).catch(() => {});
  } catch {
    // Analytics must not affect public interactions.
  }
}
