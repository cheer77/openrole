"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { activity, track, trackedPath } from "@/lib/analytics-client";
export function Analytics() {
  const path = usePathname();
  const previous = useRef("");
  const currentPath = useRef(path);
  const visibleSince = useRef(0);
  useEffect(() => { currentPath.current = path; visibleSince.current = trackedPath(path) && document.visibilityState === "visible" ? Date.now() : 0; }, [path]);
  useEffect(() => {
    if (previous.current === path) return;
    previous.current = path;
    track("PAGE_VIEW", path);
  }, [path]);
  useEffect(() => {
    const visibility = () => { visibleSince.current = trackedPath(currentPath.current) && document.visibilityState === "visible" ? Date.now() : 0; };
    const timer = window.setInterval(() => {
      if (!visibleSince.current || document.visibilityState !== "visible" || !trackedPath(currentPath.current)) return;
      const now = Date.now();
      const seconds = (now - visibleSince.current) / 1000;
      visibleSince.current = now;
      if (seconds <= 65) activity("HEARTBEAT", seconds);
    }, 50000);
    document.addEventListener("visibilitychange", visibility);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", visibility); };
  }, []);
  return null;
}
export function JobView({ jobId }: { jobId: string }) {
  const path = usePathname();
  const last = useRef("");
  useEffect(() => {
    const key = path + jobId;
    if (last.current === key) return;
    last.current = key;
    track("JOB_VIEW", path, jobId);
  }, [path, jobId]);
  return null;
}
