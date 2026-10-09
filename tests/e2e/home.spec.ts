import { expect, test } from "@playwright/test";
import { selectOption } from "./select-helper";

test("home search carries selected values into the working jobs listing", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Find work that fits your life.",
  );
  const search = page.getByRole("search", { name: "Search jobs" });
  await search
    .getByRole("searchbox", { name: "Job title, company, or keyword" })
    .fill("Frontend");
  await selectOption(
    search.getByRole("combobox", { name: "Search location" }),
    "Europe",
  );
  await selectOption(
    search.getByRole("combobox", { name: "Search work arrangement" }),
    "Remote",
  );
  await search.getByRole("button", { name: "Search jobs" }).click();
  await expect(page).toHaveURL(/\/jobs\?\w/);
  await expect(page).toHaveURL(/q=Frontend/);
  await expect(page).toHaveURL(/location=Europe/);
  await expect(page).toHaveURL(/workType=Remote/);
  await expect(page.locator(".job-card").first()).toBeVisible();
});

test("home discovery links use real jobs and company routes", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".home-job-card")).toHaveCount(4);
  await expect(page.locator(".home-company-card")).toHaveCount(8);
  await page.locator(".home-company-card").first().click();
  await expect(page).toHaveURL(/\/companies\/[a-z0-9-]+$/);
  await expect(page.locator(".company-profile h1")).toBeVisible();
  await page.getByRole("link", { name: "Openrole home" }).click();
  await page
    .getByRole("navigation", { name: "Popular searches" })
    .getByRole("link", { name: "Remote" })
    .click();
  await expect(page).toHaveURL(/workType=Remote/);
  await page.getByRole("link", { name: "Openrole home" }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.getByRole("link", { name: "All companies" }).click();
  await expect(page).toHaveURL(/\/companies$/);
});

test("home fits narrow mobile screens without hiding search controls", async ({
  page,
}) => {
  await page.setViewportSize({ width: 280, height: 740 });
  await page.goto("/");
  const search = page.getByRole("search", { name: "Search jobs" });
  for (const control of [
    search.getByRole("searchbox"),
    search.getByRole("combobox", { name: "Search location" }),
    search.getByRole("combobox", { name: "Search work arrangement" }),
    search.getByRole("button", { name: "Search jobs" }),
  ]) {
    await expect(control).toBeVisible();
    const bounds = await control.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(280);
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/home-${test.info().project.name}-280.png`,
    fullPage: true,
  });
});
