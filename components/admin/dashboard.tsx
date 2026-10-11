"use client";
import { useState } from "react";
import { Select } from "@/components/select";
import { useAdminData } from "@/features/admin/use-admin-data";
import type { Report, TopJob, ChartMetric } from "@/features/admin/types";
import { WorldMap, countryName } from "./charts";
import { TrendChart } from "./trend-chart";
import { OwnerAlerts } from "./owner-alerts";
import Link from "next/link";
const n = (v: number) => v.toLocaleString("en-US");
const duration = (seconds: number) => seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, "0")}s`;
export function Dashboard({ mode = "overview" }: { mode?: "overview" | "analytics" }) {
  const [chartMetrics, setChartMetrics] = useState<ChartMetric[]>([
    "visitors",
    "jobViews",
    "applyClicks",
  ]);
  const [chartTableOpen, setChartTableOpen] = useState(false);
  const [range, setRange] = useState("7");
  const [traffic, setTraffic] = useState("humans");
  const [revision, setRevision] = useState(0);
  const { data, error, loading } = useAdminData<Report>(
    `dashboard?range=${range}&traffic=${traffic}`,
    revision,
    30000,
  );
  const labels = {
    visitors: "Visitors",
    sessions: "Sessions",
    pageViews: "Page views",
    jobViews: "Job views",
    applyClicks: "Apply clicks",
    ctr: "Apply CTR",
  };
  return (
    <>
      <div className="admin-page-heading">
        <div>
          <span className="admin-eyebrow">{mode === "overview" ? "THE BIG PICTURE" : "AUDIENCE INSIGHTS"}</span>
          <h1>{mode === "overview" ? "Overview" : "Analytics"}</h1>
          <p>Updates every 30 seconds while this tab is visible.</p>
        </div>
        <div className="admin-heading-filters"><label className="admin-range">
          <span>Date range</span>
          <Select
            value={range}
            onChange={setRange}
            aria-label="Analytics date range"
          >
            {[
              ["today", "Today"],
              ["yesterday", "Yesterday"],
              ["7", "Last 7 days"],
              ["30", "Last 30 days"],
              ["90", "Last 90 days"],
            ].map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        </label><label className="admin-range"><span>Traffic</span><Select value={traffic} onChange={setTraffic} aria-label="Traffic filter">
          <option value="humans">Humans</option><option value="all">All traffic</option><option value="bots">Bots</option>
        </Select></label></div>
      </div>
      {loading && (
        <div
          className="admin-kpis"
          role="status"
          aria-label="Loading dashboard"
        >
          {[1, 2, 3, 4].map((i) => (
            <div className="admin-panel" key={i}>
              <span className="skeleton-line skeleton-title" />
              <span className="skeleton-line" />
            </div>
          ))}
        </div>
      )}
      {error && !data && (
        <div className="empty-state" role="alert">
          <p>{error}</p>
          <button
            className="primary-button"
            onClick={() => setRevision((v) => v + 1)}
          >
            Try again
          </button>
        </div>
      )}
      {error && data && (
        <p className="admin-muted" role="status">
          Update failed. Showing the last available data; retrying
          automatically.
        </p>
      )}
      {data && (
        <>
          {mode === "overview" && <section className="admin-kpis" aria-label="Selected period metrics">
            {(["visitors", "jobViews", "applyClicks", "ctr"] as const).map(
              (key) => (
                <div className="admin-kpi" key={key}>
                  <span>
                    {key === "visitors" ? "Unique visitors" : labels[key]}
                  </span>
                  <strong>
                    {n(data.summary[key])}
                    {key === "ctr" ? "%" : ""}
                  </strong>
                  <small>
                    {key === "ctr"
                      ? "Apply clicks / job views"
                      : key === "visitors"
                        ? "Approximate, anonymous"
                        : "Selected period"}
                  </small>
                </div>
              ),
            )}
          </section>}
          {mode === "overview" && <div className="admin-inline-stats">
            <span>
              Page views <strong>{n(data.summary.pageViews)}</strong>
            </span>
            <span>
              Sessions <strong>{n(data.summary.sessions)}</strong>
            </span>
            <span>
              Visitors today <strong>{n(data.visitorsToday)}</strong>
            </span>
            <span>
              Last 7 days <strong>{n(data.visitorsWeek)}</strong>
            </span>
            <span>
              Last 30 days <strong>{n(data.visitorsMonth)}</strong>
            </span>
          </div>}
          <section className="admin-kpis admin-engagement-kpis" aria-label="Audience engagement">
            {[
              ["Online now", n(data.engagement.onlineNow), "Activity in the last 5 minutes"],
              ["Avg session duration", duration(data.engagement.avgSessionSeconds), "Visible-tab time"],
              ["Avg engaged page time", duration(data.engagement.avgPageSeconds), "Visible-tab time per page"],
              ["Human traffic", `${Math.round(100 * data.engagement.breakdown.HUMAN / Math.max(1, Object.values(data.engagement.breakdown).reduce((a, b) => a + b, 0)))}%`, "Heuristic classification"],
              ["Likely bots", `${Math.round(100 * data.engagement.breakdown.LIKELY_BOT / Math.max(1, Object.values(data.engagement.breakdown).reduce((a, b) => a + b, 0)))}%`, "Heuristic classification"],
              ["Uncertain traffic", `${Math.round(100 * data.engagement.breakdown.UNCERTAIN / Math.max(1, Object.values(data.engagement.breakdown).reduce((a, b) => a + b, 0)))}%`, "Limited activity evidence"],
            ].map(([label, value, note]) => <div className="admin-kpi" key={label}><span>{label}</span><strong>{value}</strong><small>{note}</small></div>)}
          </section>
          {mode === "overview" && <OwnerAlerts />}
          {mode === "overview" && <p className="admin-overview-link"><Link href="/admin/analytics">Explore detailed analytics →</Link></p>}
          {mode === "analytics" && <><TrendChart
            data={data.chart}
            enabled={chartMetrics}
            onEnabledChange={setChartMetrics}
            tableOpen={chartTableOpen}
            onTableOpenChange={setChartTableOpen}
          />
          <div className="admin-inline-stats"><span>Active last 30 min <strong>{n(data.engagement.activeLast30Min)}</strong></span><span>Sessions <strong>{n(data.summary.sessions)}</strong></span><span>Page views <strong>{n(data.summary.pageViews)}</strong></span></div>
          <section className="admin-panel"><h2>Human / bot / uncertain</h2><div className="admin-breakdown-row">
            {(["HUMAN", "UNCERTAIN", "LIKELY_BOT"] as const).map((kind) => <span key={kind}>{kind.replace("_", " ").toLowerCase()} <strong>{n(data.engagement.breakdown[kind])}</strong></span>)}
          </div><p>Classification is estimated from anonymous activity; it does not block visits.</p></section>
          </>}
          {mode === "overview" && <section className="admin-inventory" aria-label="Job board inventory">
            {Object.entries({
              totalJobs: "Total jobs",
              activeJobs: "Active jobs",
              closedJobs: "Closed jobs",
              hiddenJobs: "Hidden jobs",
              jobsAddedToday: "Added today",
              companies: "Companies",
              sources: "Sources",
            }).map(([key, label]) => (
              <div key={key}>
                <strong>{n(data.inventory[key])}</strong>
                <span>{label}</span>
              </div>
            ))}
          </section>}
          {mode === "analytics" && <><div className="admin-dashboard-grid">
            <WorldMap
              countries={data.countries}
              total={data.summary.visitors}
            />
            <section className="admin-panel">
              <h2>Traffic sources</h2>
              <p>Where your audience finds you.</p>
              <div className="admin-table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Source</th>
                      <th>Visitors</th>
                      <th>%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      "Google",
                      "Telegram",
                      "Direct",
                      "LinkedIn",
                      "Facebook",
                      "Reddit",
                      "Other",
                    ].map((source) => {
                      const value =
                        data.traffic.find((r) => r.source === source)
                          ?.visitors || 0;
                      return (
                        <tr key={source}>
                          <td>{source}</td>
                          <td>{n(value)}</td>
                          <td>
                            {data.summary.visitors
                              ? ((value / data.summary.visitors) * 100).toFixed(
                                  1,
                                )
                              : "0"}
                            %
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
          <div className="admin-dashboard-grid">
            <section className="admin-panel">
              <h2>Top countries</h2>
              <div className="admin-table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Country</th>
                      <th>Visitors</th>
                      <th>Sessions</th>
                      <th>Views</th>
                      <th>Clicks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.countries.slice(0, 20).map((c) => (
                      <tr key={c.country || "unknown"}>
                        <td>{countryName(c.country)}</td>
                        <td>{n(c.visitors)}</td>
                        <td>{n(c.sessions)}</td>
                        <td>{n(c.jobViews)}</td>
                        <td>{n(c.applyClicks)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!data.countries.length && (
                <p className="admin-muted">No visits in this period.</p>
              )}
            </section>
            <section className="admin-panel">
              <h2>Top cities</h2>
              <p>Approximate; may be unavailable or inaccurate.</p>
              <div className="admin-table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>City / region</th>
                      <th>Country</th>
                      <th>Visitors</th>
                      <th>Sessions</th>
                      <th>Views</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.cities.map((c, i) => (
                      <tr key={i}>
                        <td>
                          {c.city}
                          <small>{c.region}</small>
                        </td>
                        <td>{countryName(c.country)}</td>
                        <td>{n(c.visitors)}</td>
                        <td>{n(c.sessions)}</td>
                        <td>{n(c.jobViews)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!data.cities.length && (
                <p className="admin-muted">
                  No city data supplied by the hosting provider.
                </p>
              )}
            </section>
          </div>
          <div className="admin-dashboard-grid admin-three">
            <TopJobs title="Most viewed jobs" jobs={data.topViewed} />
            <TopJobs title="Most applied jobs" jobs={data.topApplied} />
            <TopJobs
              title="Highest Apply CTR"
              jobs={data.topCtr}
              note="At least 5 views; clicks are not completed applications."
            />
          </div>
          <div className="admin-dashboard-grid admin-three">
            {[
              ["Devices", data.devices],
              ["Browsers", data.browsers],
              ["Operating systems", data.operatingSystems],
            ].map(([label, rows]) => (
              <Breakdown
                key={String(label)}
                title={String(label)}
                rows={rows as Report["devices"]}
              />
            ))}
          </div>
          <div className="admin-dashboard-grid">
            <Breakdown title="Referring domains" rows={data.referrers} />
            <section className="admin-panel">
              <h2>Campaigns</h2>
              <div className="admin-table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Source</th>
                      <th>Medium</th>
                      <th>Campaign</th>
                      <th>Visitors</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.campaigns.map((c, i) => (
                      <tr key={i}>
                        <td>{c.source || "—"}</td>
                        <td>{c.medium || "—"}</td>
                        <td>{c.campaign || "—"}</td>
                        <td>{n(c.visitors)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!data.campaigns.length && (
                <p className="admin-muted">No campaign tags recorded.</p>
              )}
            </section>
          </div>
          <section className="admin-panel admin-recent-sessions"><h2>Recent sessions</h2><p>Latest 20 anonymous sessions in the selected period.</p><div className="admin-table-scroll"><table><thead><tr><th>Country / city</th><th>Started (UTC)</th><th>Duration</th><th>Pages</th><th>Job views</th><th>Searches</th><th>Apply clicks</th><th>Referrer</th><th>Device</th><th>Visitor type</th><th>Bot score</th></tr></thead><tbody>
            {data.recentSessions.map((session) => <tr key={session.id}><td>{countryName(session.country)}<small>{session.city || "—"}</small></td><td>{new Date(session.startedAt).toLocaleString("en-GB", { timeZone: "UTC" })}</td><td>{duration(session.activeSeconds)}</td><td>{session.pages}</td><td>{session.jobViews}</td><td>{session.searches}</td><td>{session.applyClicks}</td><td>{session.referrer || "Direct"}</td><td>{session.device || "—"}</td><td>{session.visitorType.replace("_", " ")}</td><td>{session.botScore}</td></tr>)}
          </tbody></table></div>{!data.recentSessions.length && <p className="admin-muted">No sessions in this period.</p>}</section>
          <p className="admin-footnote">
            All dates use UTC. Anonymous visitor estimates can appear in
            multiple countries or sources, so rows are not additive. Raw events
            are retained for 90 days. Inventory includes enabled and disabled
            companies and sources.
          </p></>}
        </>
      )}
    </>
  );
}
function TopJobs({
  title,
  jobs,
  note,
}: {
  title: string;
  jobs: TopJob[];
  note?: string;
}) {
  return (
    <section className="admin-panel admin-top-jobs">
      <h2>{title}</h2>
      {note && <p>{note}</p>}
      {jobs.length > 0 && (
        <ol className="top-jobs" tabIndex={0} aria-label={`${title} list`}>
          {jobs.map((job) => (
            <li key={job.id}>
              <strong>{job.title}</strong>
              <span>{job.company}</span>
              <div>
                <small>{n(job.jobViews)} views</small>
                <small>{n(job.applyClicks)} clicks</small>
                <b>{job.ctr}%</b>
              </div>
            </li>
          ))}
        </ol>
      )}
      {!jobs.length && <p className="admin-muted">Not enough activity yet.</p>}
    </section>
  );
}
function Breakdown({
  title,
  rows,
}: {
  title: string;
  rows: Report["devices"];
}) {
  return (
    <section className="admin-panel">
      <h2>{title}</h2>
      <div className="admin-table-scroll">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Visitors</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name}>
                <td>{r.name}</td>
                <td>{n(r.visitors)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && <p className="admin-muted">No data yet.</p>}
    </section>
  );
}
