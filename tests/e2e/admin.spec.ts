import { test, expect } from "@playwright/test";
import { selectOption } from "./select-helper";
const password = "test-owner-password-only-2026";

test("owner workspace protects access, manages records and fits mobile", async ({
  page,
  context,
}, info) => {
  test.setTimeout(60000);
  const suffix = info.project.name.replace(/[^a-z0-9]/g, "-");
  const companyName = `Test Owner ${suffix}`;
  const sourceName = `Test Board ${suffix}`;
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login/);
  expect((await page.request.get("/api/admin/jobs")).status()).toBe(401);
  const forbidden = await page.request.post("/api/admin/login", {
    headers: { Origin: "https://untrusted.example" },
    data: { password },
  });
  expect(forbidden.status()).toBe(403);
  await page.getByLabel("Owner password").fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Overview", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Selected period metrics" }),
  ).toContainText("Unique visitors");
  const cookie = (await context.cookies()).find(
    (c) => c.name === "openrole-owner",
  );
  expect(cookie?.httpOnly).toBe(true);
  expect(cookie?.sameSite).toBe("Strict");
  expect(
    await page.evaluate(() => document.cookie.includes("openrole-owner")),
  ).toBe(false);
  await selectOption(
    page.getByRole("combobox", { name: "Analytics date range" }),
    "30",
  );
  await page.getByRole("button", { name: "Apply clicks", exact: true }).click();
  await expect(
    page.getByRole("img", { name: "Apply clicks over the selected period" }),
  ).toBeVisible();
  await page.screenshot({
    path: `test-results/admin-dashboard-${suffix}.png`,
    fullPage: true,
  });
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.setViewportSize({
    width: info.project.name.includes("mobile") ? 390 : 1440,
    height: 900,
  });
  await page
    .getByRole("navigation", { name: "Admin navigation" })
    .getByRole("link", { name: "Companies", exact: true })
    .click();
  await page.getByRole("button", { name: "Add company" }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name", { exact: true }).fill(companyName);
  await dialog.getByLabel("URL slug").fill("owner-" + suffix);
  await dialog
    .getByLabel("Website", { exact: true })
    .fill("https://example.com");
  await dialog.getByLabel("Enabled", { exact: true }).check();
  await dialog.getByRole("button", { name: "Save changes" }).click();
  await expect(dialog).toHaveCount(0);
  await page
    .getByRole("textbox", { name: "Search companies" })
    .fill(companyName);
  await page.getByRole("button", { name: "Search", exact: true }).click();
  let row = page
    .getByRole("row")
    .filter({ has: page.getByText(companyName, { exact: true }) });
  await expect(row).toContainText("Enabled");
  await row.getByRole("button", { name: "Disable", exact: true }).click();
  await expect(row).toContainText("Disabled");
  await row.getByRole("button", { name: "Enable", exact: true }).click();
  await expect(row).toContainText("Enabled");
  await page
    .getByRole("navigation", { name: "Admin navigation" })
    .getByRole("link", { name: "Sources", exact: true })
    .click();
  await page.getByRole("button", { name: "Add source" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name", { exact: true }).fill(sourceName);
  await dialog.getByLabel("Find a company").fill(companyName);
  const companySelect = dialog.getByRole("combobox", {
    name: "Company",
    exact: true,
  });
  await companySelect.click();
  await page.getByRole("option", { name: companyName, exact: true }).click();
  await selectOption(
    dialog.getByRole("combobox", { name: "Provider" }),
    "ASHBY",
  );
  await dialog.getByLabel("Source identifier").fill("fixture-" + suffix);
  await dialog.getByRole("button", { name: "Save changes" }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByRole("textbox", { name: "Search sources" }).fill(sourceName);
  await page.getByRole("button", { name: "Search", exact: true }).click();
  row = page
    .getByRole("row")
    .filter({ has: page.getByText(sourceName, { exact: true }) });
  await expect(row).toContainText("Disabled");
  await expect(row.getByRole("button", { name: "Sync now" })).toBeDisabled();
  await row.getByRole("button", { name: "Enable", exact: true }).click();
  await expect(row).toContainText("Enabled");
  await row.getByRole("button", { name: "Sync now" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Sync queued" }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "Admin navigation" })
    .getByRole("link", { name: "Import logs", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Import logs", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "Admin navigation" })
    .getByRole("link", { name: "Jobs", exact: true })
    .click();
  const titles: Record<string, string> = {
    "owner-desktop": "Senior Frontend Engineer",
    "owner-firefox": "Mobile Engineer, iOS",
    "owner-mobile-safari": "Staff AI Engineer",
    "owner-mobile": "Junior QA Engineer",
  };
  const title = titles[info.project.name];
  await page.getByRole("textbox", { name: "Search jobs" }).fill(title);
  await page.getByRole("button", { name: "Search", exact: true }).click();
  row = page.getByRole("row").filter({ hasText: title }).first();
  await row.getByRole("button", { name: "Edit", exact: true }).click();
  dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Job title", { exact: true })
    .fill("Edited " + suffix);
  await dialog.getByRole("button", { name: "Save changes" }).click();
  await expect(dialog).toHaveCount(0);
  await page
    .getByRole("textbox", { name: "Search jobs" })
    .fill("Edited " + suffix);
  await page.getByRole("button", { name: "Search", exact: true }).click();
  row = page
    .getByRole("row")
    .filter({ has: page.getByText("Edited " + suffix, { exact: true }) });
  await expect(row).toContainText("Manual edits protected");
  await row.getByRole("button", { name: "Hide", exact: true }).click();
  await expect(row).toContainText("HIDDEN");
  await row.getByRole("button", { name: "Unhide", exact: true }).click();
  await expect(row).toContainText("ACTIVE");
  await row.getByRole("button", { name: "Mark closed" }).click();
  await expect(row).toContainText("CLOSED");
  await row.getByRole("button", { name: "Delete", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete job", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/login/);
  expect((await page.request.get("/api/admin/dashboard")).status()).toBe(401);
});

test("analytics tracking respects privacy and never blocks Apply", async ({
  page,
  context,
}) => {
  const events: { type: string; path: string; [key: string]: unknown }[] = [];
  await page.exposeFunction("recordAnalytics", (body: string) =>
    events.push(JSON.parse(body)),
  );
  await page.addInitScript(() => {
    // Exercise the local-LAN HTTP path as well as secure-context browsers.
    Object.defineProperty(crypto, "randomUUID", { value: undefined });
    const original = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = (url, data) => {
      if (String(url) === "/api/events" && data instanceof Blob)
        void data.text().then((body) =>
          (
            window as unknown as {
              recordAnalytics: (body: string) => Promise<void>;
            }
          ).recordAnalytics(body),
        );
      return original(url, data);
    };
  });
  const ingestion = page.waitForResponse((r) =>
    r.url().endsWith("/api/events"),
  );

  await page.goto(
    "/jobs?utm_source=telegram&utm_medium=social&utm_campaign=test",
  );
  await expect
    .poll(() => events.some((e) => e.type === "PAGE_VIEW"))
    .toBe(true);
  expect((await ingestion).status()).toBe(204);
  await page.locator(".view-job").first().click();
  await expect.poll(() => events.some((e) => e.type === "JOB_VIEW")).toBe(true);
  const apply = page.locator("a.apply-button:visible").first();
  const href = await apply.getAttribute("href");
  await context.route(href!, (route) =>
    route.fulfill({ body: "Company application" }),
  );
  const popup = context.waitForEvent("page");
  await apply.click();
  await (await popup).close();
  await expect
    .poll(() => events.some((e) => e.type === "APPLY_CLICK"))
    .toBe(true);
  expect(events.every((e) => !e.path.includes("?"))).toBe(true);
  expect(events.some((e) => e.utmSource === "telegram")).toBe(true);
  await page.goto("/privacy");
  await page.getByRole("button", { name: "Disable analytics" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "disabled" }),
  ).toBeVisible();
  const count = events.length;
  await page.goto("/companies");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  expect(events.length).toBe(count);
  await page.evaluate(() =>
    localStorage.removeItem("openrole-analytics-disabled"),
  );
  await context.addInitScript(() =>
    Object.defineProperty(navigator, "doNotTrack", { get: () => "1" }),
  );
  await page.goto("/jobs");
  await expect(page.locator(".job-card").first()).toBeVisible();
  expect(events.length).toBe(count);
});

test("dashboard refresh is quiet, pauses when inactive and backs off on errors", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-10-07T10:00:00Z") });
  await page.clock.pauseAt(new Date("2026-10-07T10:00:00Z"));
  let requests = 0;
  let fail = false;
  let release: (() => void) | undefined;
  let hold = false;
  await page.route("**/api/admin/dashboard?*", async (route) => {
    requests++;
    if (hold)
      await new Promise<void>((resolve) => {
        release = resolve;
      });
    if (fail)
      return route.fulfill({
        status: 503,
        json: { message: "Temporary outage" },
      });
    const response = await route.fetch();
    const data = await response.json();
    data.summary.visitors = requests;
    await route.fulfill({ json: data });
  });
  await page.goto("/admin/login");
  await page.getByLabel("Owner password").fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  const value = page.locator(".admin-kpi").first().locator("strong");
  await expect(value).toHaveText("1");
  const chart = page.getByRole("img", {
    name: "Visitors over the selected period",
  });
  await chart.evaluate((element) =>
    element.setAttribute("data-preserved", "yes"),
  );
  await page.clock.runFor(29999);
  expect(requests).toBe(1);
  hold = true;
  await page.clock.runFor(1);
  await expect.poll(() => requests).toBe(2);
  await page.clock.runFor(10000);
  expect(requests).toBe(2);
  await expect(value).toHaveText("1");
  await expect(
    page.getByRole("status", { name: "Loading dashboard" }),
  ).toHaveCount(0);
  hold = false;
  release!();
  await expect(value).toHaveText("2");
  await expect(chart).toHaveAttribute("data-preserved", "yes");

  const visibility = async (state: "hidden" | "visible") =>
    page.evaluate((state) => {
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        value: state,
      });
      document.dispatchEvent(new Event("visibilitychange"));
    }, state);
  await visibility("hidden");
  await page.clock.runFor(120000);
  expect(requests).toBe(2);
  await visibility("visible");
  await page.clock.runFor(1);
  await expect(value).toHaveText("3");
  // Repeated focus changes must not bypass the minimum interval.
  await visibility("hidden");
  await visibility("visible");
  await page.clock.runFor(1000);
  expect(requests).toBe(3);

  await page.evaluate(() => {
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: false,
    });
    window.dispatchEvent(new Event("offline"));
  });
  await page.clock.runFor(120000);
  expect(requests).toBe(3);
  await page.evaluate(() => {
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: true,
    });
    window.dispatchEvent(new Event("online"));
  });
  await page.clock.runFor(1);
  await expect(value).toHaveText("4");
  fail = true;
  await page.clock.runFor(30000);
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Showing the last available data" }),
  ).toBeVisible();
  expect(requests).toBe(5);
  await expect(value).toHaveText("4");
  await page.clock.runFor(59999);
  expect(requests).toBe(5);
  fail = false;
  await page.clock.runFor(1);
  await expect(value).toHaveText("6");
  await expect(
    page.getByText("Showing the last available data", { exact: false }),
  ).toHaveCount(0);
  await page
    .getByRole("navigation", { name: "Admin navigation" })
    .getByRole("link", { name: "Jobs", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Jobs", exact: true }),
  ).toBeVisible();
  await page.clock.runFor(120000);
  expect(requests).toBe(6);
});
