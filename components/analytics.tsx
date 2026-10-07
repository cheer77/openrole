"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { track } from "@/lib/analytics-client";
export function Analytics() {
  const path = usePathname();
  const previous = useRef("");
  useEffect(() => {
    if (previous.current === path) return;
    previous.current = path;
    track("PAGE_VIEW", path);
  }, [path]);
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
