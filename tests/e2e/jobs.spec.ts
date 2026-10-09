import { selectOption } from "./select-helper";
import { test, expect } from "@playwright/test";

test("search, URL sharing, empty state and reset", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/jobs");
  await expect(page.locator(".job-card")).toHaveCount(8);
  await page
    .getByRole("textbox", { name: "Job title, company, or keyword" })
    .fill("NestJS");
  await page.getByRole("button", { name: "Search jobs", exact: true }).click();
  await expect(page).toHaveURL(/q=NestJS/);
  await expect(page.locator(".job-card")).toHaveCount(1);
  await expect(page.locator(".job-card")).toContainText("Buffer");
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: "Job title, company, or keyword" }),
  ).toHaveValue("NestJS");
  await expect(page.locator(".job-card")).toHaveCount(1);
  await page
    .getByRole("textbox", { name: "Job title, company, or keyword" })
    .fill("nonexistent-role-123");
  await page.getByRole("button", { name: "Search jobs", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "A fresh search might open a door." }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Explore all jobs", exact: true })
    .click();
  await expect(page.locator(".job-card")).toHaveCount(8);
  expect(errors).toEqual([]);
});

test("company logos use the stored image and fall back cleanly when it fails", async ({
  page,
}) => {
  await page.goto("/jobs?q=Linear");
  const available = page
    .locator('.company-logo[aria-label="Linear logo"]')
    .first();
  await expect(available.locator("img")).toBeVisible();

  await page.goto("/jobs?q=Monzo");
  const missing = page
    .locator('.company-logo[aria-label="Monzo logo unavailable"]')
    .first();
  await expect(missing.locator("svg")).toBeVisible();
});

test("job description has safe sections, lists and links within the mobile viewport", async ({ page }) => {
  await page.goto("/jobs?q=Linear");
  await page.locator(".view-job").first().click();
  const description = page.locator(".job-description");
  await expect(description.getByRole("heading", { name: "Working at Linear", level: 2 })).toBeVisible();
  await expect(description.getByRole("heading", { name: "Requirements", level: 3 })).toBeVisible();
  await expect(description.locator("ul li")).toHaveCount(2);
  await expect(description.getByRole("link", { name: "our careers page" })).toHaveAttribute("rel", "noopener noreferrer");
  await expect(description.locator("script")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
});

test("quick filters combine and history restores them", async ({ page }) => {
  await page.goto("/jobs");
  await selectOption(
    page.getByRole("combobox", { name: "Search work arrangement" }),
    "Remote",
  );
  await page.getByRole("button", { name: "Search jobs", exact: true }).click();
  await expect(page).toHaveURL(/workType=Remote/);
  await page.getByRole("button", { name: "Frontend", exact: true }).click();
  await expect(page).toHaveURL(/category=Frontend/);
  await expect(page.locator(".job-card")).toHaveCount(3);
  await page.goBack();
  await expect(page).not.toHaveURL(/category=/);
  await expect(
    page.getByRole("button", { name: "Frontend", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  await page.goForward();
  await expect(page.locator(".job-card")).toHaveCount(3);
});

test("pagination, detail content, return state, external Apply", async ({
  page,
  context,
}) => {
  await page.goto("/jobs");
  await page.getByRole("link", { name: "Page 2", exact: true }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(
    page.getByRole("link", { name: "Page 2", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await page.locator(".view-job").first().click();
  await expect(
    page.getByRole("heading", { name: "Mobile Engineer, iOS", level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Is this role open to you?" }),
  ).toBeVisible();
  await expect(
    page.getByText("What you’ll bring", { exact: true }),
  ).toBeVisible();
  const apply = page.locator("a.apply-button:visible").first();
  await expect(apply).toHaveAttribute("target", "_blank");
  await expect(apply).toHaveAttribute("rel", "noopener noreferrer");
  await context.route("https://monzo.com/careers", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<h1>Company careers</h1>",
    }),
  );
  const popupPromise = page.waitForEvent("popup");
  await apply.click();
  const popup = await popupPromise;
  await expect(popup).toHaveURL("https://monzo.com/careers");
  await popup.close();
  await page.getByRole("link", { name: "Back to all jobs" }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.locator(".job-card h3").first()).toHaveText(
    "Mobile Engineer, iOS",
  );
});

test("salary sorting applies one currency and preserves URL on reload", async ({
  page,
}) => {
  await page.goto("/jobs");
  await selectOption(
    page.getByRole("combobox", { name: "Sort jobs" }),
    "salary-high",
  );
  await expect(page).toHaveURL(/currency=USD/);
  await expect(page.locator(".sort-note")).toContainText("USD");
  await expect(page.locator(".job-card h3").first()).toHaveText(
    "Staff AI Engineer",
  );
  await page.reload();
  await expect(
    page.getByRole("combobox", { name: "Sort jobs" }),
  ).toHaveAttribute("data-value", "salary-high");
});

test("desktop or mobile filters support category, geography, experience, date, tech and pay", async ({
  page,
}, testInfo) => {
  await page.goto("/jobs?page=2");
  await selectOption(
    page.getByRole("combobox", { name: "Search location" }),
    "Europe",
  );
  await page.getByRole("button", { name: "Search jobs", exact: true }).click();
  const mobile = testInfo.project.name.startsWith("mobile");
  if (mobile)
    await page.getByRole("button", { name: "Filters", exact: true }).click();
  const panel = mobile
    ? page.getByRole("dialog")
    : page.getByRole("complementary", { name: "Job filters" });
  await selectOption(
    panel.getByRole("combobox", { name: "Job category" }),
    "Frontend",
  );
  await panel.getByRole("button", { name: "Senior", exact: true }).click();
  await selectOption(panel.getByRole("combobox", { name: "Date posted" }), "1");
  await panel.getByRole("checkbox", { name: "React", exact: true }).check();
  await selectOption(
    panel.getByRole("combobox", { name: "Salary currency" }),
    "EUR",
  );
  await panel
    .getByRole("spinbutton", { name: "Minimum annual salary" })
    .fill("100000");
  await panel
    .getByRole("spinbutton", { name: "Maximum annual salary" })
    .click();
  if (mobile) {
    await expect(
      panel.getByRole("button", { name: "Show 1 jobs" }),
    ).toBeVisible();
    await panel.getByRole("button", { name: "Show 1 jobs" }).click();
  }
  await expect(page.locator(".job-card")).toHaveCount(1);
  await expect(page.locator(".job-card h3")).toHaveText(
    "Senior Frontend Engineer",
  );
  await expect(page).not.toHaveURL(/page=2/);
  await expect(page).toHaveURL(/salaryMin=100000/);
});

test("responsive layout fits viewport and captures the product", async ({
  page,
}, testInfo) => {
  await page.goto("/jobs");
  await expect(page.locator(".job-card").first()).toBeVisible();
  await page.screenshot({
    path: `test-results/openrole-${testInfo.project.name}.png`,
    fullPage: true,
    scale: "css",
  });
  const widths = testInfo.project.name.startsWith("mobile")
    ? [320, 390, 520]
    : [768, 1024, 1440];
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    await page.screenshot({
      path: `test-results/${page.url().includes("from=") || /jobs\/[^?]+/.test(new URL(page.url()).pathname) ? "detail" : "jobs"}-${width}.png`,
      scale: "css",
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  await page.locator(".view-job").first().click();
  await expect(
    page.getByRole("heading", { name: "Working at Linear" }),
  ).toBeVisible();
  await page.screenshot({
    path: `test-results/openrole-detail-${testInfo.project.name}.png`,
    fullPage: true,
    scale: "css",
  });
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    await page.screenshot({
      path: `test-results/${page.url().includes("from=") || /jobs\/[^?]+/.test(new URL(page.url()).pathname) ? "detail" : "jobs"}-${width}.png`,
      scale: "css",
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
});

test("mobile drawer closes with Escape and discards unapplied changes", async ({
  page,
}, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile"));
  await page.goto("/jobs");
  const open = page.getByRole("button", { name: "Filters", exact: true });
  await open.click();
  const dialog = page.getByRole("dialog");
  await page.screenshot({
    path: "test-results/filter-drawer.png",
    scale: "css",
  });
  await selectOption(
    dialog.getByRole("combobox", { name: "Job category" }),
    "Sales",
  );
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(open).toBeFocused();
  await expect(page).not.toHaveURL(/category=/);
  await open.click();
  await expect(
    dialog.getByRole("combobox", { name: "Job category" }),
  ).toHaveAttribute("data-value", "");
});

test("unknown job has a useful 404", async ({ page }) => {
  const response = await page.goto("/jobs/not-a-real-job");
  expect(response?.status()).toBe(404);
  await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute(
    "content",
    /noindex/,
  );
  await expect(
    page.getByRole("heading", { name: "This role isn’t here." }),
  ).toBeVisible();
});

test("companies navigation opens a working company search", async ({
  page,
}, testInfo) => {
  await page.goto("/jobs");
  await page
    .getByRole("navigation", {
      name: testInfo.project.name.startsWith("mobile")
        ? "Mobile navigation"
        : "Main navigation",
    })
    .getByRole("link", { name: "Companies", exact: true })
    .click();
  await expect(page.locator(".company-card")).toHaveCount(10);
  await page.screenshot({
    path: `test-results/companies-${testInfo.project.name}.png`,
    scale: "css",
  });
  await page
    .getByRole("link", { name: "View jobs at Linear", exact: true })
    .click();
  await expect(page).toHaveURL(/\/companies\/linear/);
  await expect(page.locator(".job-card")).toHaveCount(3);
  await expect(page.locator(".company-name").first()).toHaveText("Linear");
});

test("cards have full salary amounts and a working title link", async ({
  page,
}) => {
  await page.goto("/jobs");
  const card = page.locator(".job-card").first();
  await expect(card.locator(".card-salary")).toContainText("€95,000–€130,000");
  await card
    .getByRole("link", { name: "Senior Frontend Engineer", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Senior Frontend Engineer", level: 1 }),
  ).toBeVisible();
});

test("filter groups collapse without losing selections", async ({
  page,
}, testInfo) => {
  await page.goto("/jobs?category=Frontend");
  if (testInfo.project.name.startsWith("mobile"))
    await page.locator(".mobile-filter-button").click();
  const panel = testInfo.project.name.startsWith("mobile")
    ? page.getByRole("dialog")
    : page.getByRole("complementary", { name: "Job filters" });
  const section = panel
    .locator("details")
    .filter({ has: page.locator("summary", { hasText: "Category" }) });
  await section.locator("summary").click();
  await expect(section.getByRole("combobox")).not.toBeVisible();
  await section.locator("summary").click();
  await expect(section.getByRole("combobox")).toHaveAttribute(
    "data-value",
    "Frontend",
  );
});

test("drawer Clear all immediately resets quick categories and applied filters", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/jobs?workType=Remote&location=Europe");
  const backend = page.getByRole("button", { name: "Backend", exact: true });
  await backend.click();
  await expect(backend).toHaveAttribute("aria-pressed", "true");
  await page.locator(".mobile-filter-button").click();
  const dialog = page.getByRole("dialog");
  await selectOption(
    dialog.getByRole("combobox", { name: "Job category" }),
    "Sales",
  );
  await dialog.getByRole("button", { name: "Clear all", exact: true }).click();
  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(/\/jobs$/);
  await expect(backend).toHaveAttribute("aria-pressed", "false");
  await expect(
    dialog.getByRole("combobox", { name: "Job category" }),
  ).toHaveAttribute("data-value", "");
  await dialog.getByRole("button", { name: "Close filters" }).click();
  await expect(
    page.getByRole("combobox", { name: "Search location" }),
  ).toHaveAttribute("data-value", "");
  await expect(
    page.getByRole("combobox", { name: "Search work arrangement" }),
  ).toHaveAttribute("data-value", "");
  await page.locator(".mobile-filter-button").click();
  await expect(
    dialog.getByRole("combobox", { name: "Job category" }),
  ).toHaveAttribute("data-value", "");
  await dialog.getByRole("button", { name: /Show .* jobs/ }).click();
  await expect(page).toHaveURL(/\/jobs$/);
  await page.reload();
  await expect(backend).toHaveAttribute("aria-pressed", "false");
});
