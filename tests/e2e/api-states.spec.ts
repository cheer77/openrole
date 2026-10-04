import { expect, test } from "@playwright/test";

test("API failure preserves filters and retry recovers real results", async ({
  page,
}, info) => {
  const query = `__test_outage_${info.project.name}`;
  await page.goto(`/jobs?q=${query}&category=Frontend`);
  await expect(
    page.getByRole("region", { name: "Job results" }).getByRole("alert"),
  ).toContainText("We couldn’t load jobs");
  await expect(
    page.getByRole("textbox", { name: "Job title, company, or keyword" }),
  ).toHaveValue(query);
  await expect(
    page.getByRole("button", { name: "Frontend", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.locator(".job-card h3").first()).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Job results" }).getByRole("alert"),
  ).toHaveCount(0);
  await expect(page).toHaveURL(/category=Frontend/);
});

test("server transitions show skeletons and keep only the latest filter selection", async ({
  page,
}, info) => {
  await page.goto("/jobs");
  await page
    .getByRole("textbox", { name: "Job title, company, or keyword" })
    .fill(`__test_slow_${info.project.name}`);
  await page.getByRole("button", { name: "Search jobs", exact: true }).click();
  await expect(
    page.getByRole("status", { name: "Loading jobs" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Frontend", exact: true }).click();
  await expect(page.locator(".job-card h3").first()).toBeVisible();
  await expect(page).toHaveURL(/category=Frontend/);
  await expect(page).toHaveURL(/q=__test_slow_/);
  await expect(page.getByRole("status", { name: "Loading jobs" })).toHaveCount(
    0,
  );
});

test("invalid salary range stays editable without calling it an empty result", async ({
  page,
}) => {
  await page.goto("/jobs?salaryMin=150000&salaryMax=100000");
  await expect(
    page.getByRole("region", { name: "Job results" }).getByRole("alert"),
  ).toContainText("Minimum salary must not exceed");
  await page.getByRole("button", { name: "Clear all", exact: true }).click();
  await expect(page.locator(".job-card h3").first()).toBeVisible();
});
