import type { ChartMetric } from "./types.ts";

export const chartMetrics: {
  key: ChartMetric;
  label: string;
  title: string;
  dash?: string;
}[] = [
  { key: "visitors", label: "Visitors", title: "Unique visitors" },
  { key: "pageViews", label: "Page views", title: "Page views", dash: "3 4" },
  { key: "jobViews", label: "Job views", title: "Job views", dash: "7 3" },
  { key: "applyClicks", label: "Apply clicks", title: "Apply clicks" },
  {
    key: "applyConversion",
    label: "Conversion",
    title: "Apply conversion",
    dash: "8 3 2 3",
  },
];
export const metricValue = (value: number | null, key: ChartMetric) =>
  value === null
    ? "—"
    : key === "applyConversion"
      ? `${value.toFixed(1)}%`
      : value.toLocaleString("en-US");
export function comparison(
  current: number | null,
  previous: number | null,
  key: ChartMetric,
) {
  if (current === null || previous === null)
    return { text: "Not available", direction: "neutral" };
  const delta = current - previous;
  if (!delta) return { text: "No change", direction: "neutral" };
  if (previous === 0 && key !== "applyConversion")
    return { text: "New activity", direction: "up" };
  const change = key === "applyConversion" ? delta : (delta / previous) * 100;
  return {
    text: `${change > 0 ? "+" : "−"}${Math.abs(change).toFixed(1)}${key === "applyConversion" ? " pp" : "%"}`,
    direction: delta > 0 ? "up" : "down",
  };
}
export function countDomain(max: number) {
  const target = Math.max(5, max) / 5;
  const magnitude = 10 ** Math.floor(Math.log10(target));
  const step = [1, 2, 5, 10].find((n) => n * magnitude >= target)! * magnitude;
  return step * 5;
}
export function chartDate(timestamp: string, hourly: boolean, full = false) {
  return new Date(timestamp).toLocaleString("en-US", {
    timeZone: "UTC",
    ...(hourly && !full ? {} : { month: "short", day: "numeric" }),
    ...(hourly
      ? { hour: "2-digit", minute: "2-digit", hourCycle: "h23" as const }
      : {}),
  });
}
