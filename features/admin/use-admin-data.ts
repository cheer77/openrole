"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
export function useAdminData<T>(path: string, revision = 0) {
  const router = useRouter();
  const key = path + ":" + revision;
  const [state, setState] = useState<{
    key: string;
    data?: T;
    error?: string;
  }>();
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch("/api/admin/" + path, {
          signal: controller.signal,
          cache: "no-store",
        });
        if (response.status === 401) {
          router.replace("/admin/login");
          return;
        }
        const data = await response.json();
        if (!response.ok)
          throw new Error(data.message || "Unable to load data");
        setState({ key, data });
      } catch (error) {
        if (!controller.signal.aborted)
          setState({
            key,
            error:
              error instanceof Error ? error.message : "Unable to load data",
          });
      }
    })();
    return () => controller.abort();
  }, [path, key, router]);
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
