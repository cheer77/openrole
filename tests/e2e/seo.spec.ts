import { test, expect } from "@playwright/test";

test("active jobs expose factual structured data and canonical URL", async ({ page, request }) => {
  await page.goto("/jobs?q=Linear");
  await page.locator(".view-job").first().click();
  await expect(page).toHaveURL(/\/jobs\/linear-/);
  const jobUrl = new URL(page.url());
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", `https://jobs.example.test${jobUrl.pathname}`);
  const jsonLd = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent() ?? "null");
  expect(jsonLd["@type"]).toBe("JobPosting");
  expect(jsonLd.title).toContain("Engineer");
  expect(jsonLd.hiringOrganization.name).toBe("Linear");
  expect(jsonLd.url).toBe(`https://jobs.example.test${jobUrl.pathname}`);
  expect(jsonLd.jobLocationType).toBeUndefined();
  const robots = await request.get("/robots.txt");
  expect(await robots.text()).toContain("Sitemap: https://jobs.example.test/sitemap.xml");
  await page.getByRole("link", { name: "More jobs at Linear" }).click();
  await expect(page).toHaveURL(/\/companies\/linear$/);
  await expect(page.locator(".company-profile h1")).toHaveText("Linear");
});

test("closed and expired jobs leave index and apply flow", async ({ page, request }) => {
  await page.goto("/jobs/closed-job-phase5");
  await expect(page.locator(".closed-job-notice")).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(0);
  await expect(page.locator("a.apply-button")).toHaveCount(0);
  expect((await request.get("http://127.0.0.1:4001/jobs/expired-job-phase5")).status()).toBe(410);
  expect((await request.get("/jobs/expired-job-phase5")).status()).toBe(410);
  const map = await (await request.get("/sitemaps/jobs-1.xml")).text();
  expect(map).not.toContain("closed-job-phase5");
  expect(map).not.toContain("expired-job-phase5");
});

test("sitemap follows active inventory and thin/filter pages are noindex", async ({ page, request }) => {
  const index = await (await request.get("/sitemap.xml")).text();
  expect(index).toContain("jobs-1.xml");
  expect(index).toContain("companies-1.xml");
  const map = await (await request.get("/sitemaps/jobs-1.xml")).text();
  expect(map).toContain("https://jobs.example.test/jobs/");
  await page.goto("/categories/ai-ml");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await page.goto("/jobs?q=React");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await page.goto("/jobs");
  await expect(page.getByRole("link", { name: "Page 2", exact: true })).toHaveAttribute("href", /page=2/);
});

test("company and landing pages fit narrow viewports", async ({ page }) => {
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 800 });
    for (const path of ["/companies/linear", "/categories/frontend", "/remote-jobs"]) {
      await page.goto(path);
      await expect(page.locator("h1")).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }
  }
});
