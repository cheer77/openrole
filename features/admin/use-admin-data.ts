"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
export function useAdminData<T>(path: string, revision = 0, refreshMs = 0) {
  const router = useRouter();
  const key = path + ":" + revision;
  const [state, setState] = useState<{
    key: string;
    data?: T;
    error?: string;
  }>();
  useEffect(() => {
    let stopped = false;
    let inFlight = false;
    let failures = 0;
    let nextAt = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;
    const active = () =>
      !refreshMs ||
      (document.visibilityState === "visible" && navigator.onLine);
    const schedule = () => {
      clearTimeout(timer);
      if (!stopped && refreshMs && !inFlight && active())
        timer = setTimeout(
          () => void request(),
          Math.max(0, nextAt - Date.now()),
        );
    };
    async function request() {
      if (stopped || inFlight || !active()) return;
      inFlight = true;
      controller = new AbortController();
      const timeout = setTimeout(() => controller?.abort(), 20000);
      try {
        const response = await fetch("/api/admin/" + path, {
          signal: controller.signal,
          cache: "no-store",
        });
        if (stopped) return;
        if (response.status === 401) {
          stopped = true;
          router.replace("/admin/login");
          return;
        }
        const data = await response.json();
        if (!response.ok)
          throw new Error(data.message || "Unable to load data");
        if (stopped) return;
        failures = 0;
        setState({ key, data });
      } catch (error) {
        if (!stopped) {
          failures++;
          setState((previous) => ({
            key,
            // A failed background refresh must not remove the current chart.
            data:
              refreshMs && previous?.key === key ? previous.data : undefined,
            error:
              error instanceof Error ? error.message : "Unable to load data",
          }));
        }
      } finally {
        clearTimeout(timeout);
        inFlight = false;
        // Schedule after completion: slow requests cannot overlap or catch up.
        // Failures back off to 60/120 seconds instead of hammering the API.
        nextAt =
          Date.now() + Math.min(refreshMs * 2 ** Math.min(failures, 2), 120000);
        schedule();
      }
    }
    if (refreshMs) {
      document.addEventListener("visibilitychange", schedule);
      window.addEventListener("online", schedule);
      window.addEventListener("offline", schedule);
    }
    void request();
    return () => {
      stopped = true;
      clearTimeout(timer);
      controller?.abort();
      document.removeEventListener("visibilitychange", schedule);
      window.removeEventListener("online", schedule);
      window.removeEventListener("offline", schedule);
    };
  }, [path, key, router, refreshMs]);
  return {
    data: state?.key === key ? state.data : undefined,
    error: state?.key === key ? state.error : undefined,
    loading: state?.key !== key,
  };
}
export async function adminMutation(
  path: string,
  method: string,
  body?: unknown,
) {
  const response = await fetch("/api/admin/" + path, {
    method,
    headers: { "content-type": "application/json" },
    ...(method === "DELETE" ? {} : { body: JSON.stringify(body ?? {}) }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Unable to save changes");
  return data;
}
