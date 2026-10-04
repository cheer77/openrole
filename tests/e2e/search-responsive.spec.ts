import { selectOption } from "./select-helper";
import { test, expect } from "@playwright/test";

test("navigation and search controls have no duplicate entries", async ({
  page,
}) => {
  await page.goto("/jobs?workType=Remote&location=Europe");
  const navigation = page.getByRole("navigation", { name: "Main navigation" });
  await expect(navigation.getByRole("link")).toHaveText([
    "Find Jobs",
    "Companies",
  ]);
  await expect(
    page.getByRole("combobox", { name: "Search location" }),
  ).toHaveCount(1);
  await expect(
    page.getByRole("combobox", { name: "Search work arrangement" }),
  ).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Remote", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Clear all", exact: true }),
  ).toHaveCount(1);
  await page.getByRole("button", { name: "Clear all", exact: true }).click();
  await expect(
    page.getByRole("combobox", { name: "Search location" }),
  ).toHaveAttribute("data-value", "");
  await expect(
    page.getByRole("combobox", { name: "Search work arrangement" }),
  ).toHaveAttribute("data-value", "");
});

test("all search fields remain visible and preserve selections through resize and rotation", async ({
  page,
}, testInfo) => {
  await page.goto("/jobs");
  const location = page.getByRole("combobox", { name: "Search location" });
  const work = page.getByRole("combobox", { name: "Search work arrangement" });
  const search = page.getByRole("textbox", {
    name: "Job title, company, or keyword",
  });
  await selectOption(location, "Spain");
  await selectOption(work, "Remote");
  const sizes = [
    [280, 740],
    [320, 568],
    [360, 800],
    [375, 667],
    [390, 844],
    [414, 896],
    [430, 932],
    [540, 720],
    [640, 800],
    [768, 1024],
    [820, 1180],
    [900, 900],
    [1024, 768],
    [1150, 900],
    [1280, 900],
    [1440, 900],
    [568, 320],
    [812, 375],
  ];
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height });
    for (const field of [search, location, work]) {
      await expect(field).toBeVisible();
      const bounds = await field.boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
      expect(bounds!.height).toBeGreaterThanOrEqual(43.99);
    }
    await expect(location).toHaveAttribute("data-value", "Spain");
    await expect(work).toHaveAttribute("data-value", "Remote");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 320, height: 568 });
  await page.getByRole("button", { name: "Search jobs", exact: true }).click();
  await expect(page).toHaveURL(/location=Spain/);
  await expect(page).toHaveURL(/workType=Remote/);
  await expect(page.locator(".work-badge").first()).toHaveText("Remote");
  await page.reload();
  await expect(work).toHaveAttribute("data-value", "Remote");
  await expect(location).toHaveAttribute("data-value", "Spain");
  await page.screenshot({
    path: `test-results/search-${testInfo.project.name}-320.png`,
    scale: "css",
  });
});

test("filters remain usable in a short landscape viewport", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 812, height: 375 });
  await page.goto("/jobs");
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await selectOption(
    dialog.getByRole("combobox", { name: "Date posted" }),
    "1",
  );
  const apply = dialog.getByRole("button", { name: "Show 8 jobs" });
  await expect(apply).toBeInViewport();
  await page.screenshot({
    path: `test-results/drawer-landscape-${testInfo.project.name}.png`,
    scale: "css",
  });
  await apply.click();
  await expect(dialog).not.toBeVisible();
  await expect(page).toHaveURL(/posted=1/);
});

test("mobile navigation keeps all primary controls visible above safe area", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/jobs");
  const navigation = page.getByRole("navigation", {
    name: "Mobile navigation",
  });
  await expect(navigation).toBeVisible();
  await expect(
    navigation.getByText(/Jobs|Companies|Saved|Alerts|Profile/),
  ).toHaveCount(5);
  await expect(navigation.getByRole("link", { name: "Jobs" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(
    navigation.getByRole("button", { name: "Saved" }),
  ).toBeDisabled();
  await expect(
    navigation.getByRole("button", { name: "Alerts" }),
  ).toBeDisabled();
  await expect(
    navigation.getByRole("button", { name: "Profile" }),
  ).toBeDisabled();
  const bounds = await navigation.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(320);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(568);
  await navigation.getByRole("link", { name: "Companies" }).click();
  await expect(page).toHaveURL(/\/companies$/);
  await expect(
    page
      .getByRole("navigation", { name: "Mobile navigation" })
      .getByRole("link", { name: "Companies" }),
  ).toHaveAttribute("aria-current", "page");
});
