import { test, expect } from "@playwright/test";

test("custom select supports keyboard, dismissal and form submission", async ({
  page,
}) => {
  await page.goto("/jobs");
  const location = page.getByRole("combobox", { name: "Search location" });
  await location.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("listbox")).toBeVisible();
  await page.keyboard.type("Spain");
  await page.keyboard.press("Enter");
  await expect(location).toHaveAttribute("data-value", "Spain");
  await expect(location).toBeFocused();
  await location.click();
  await page.keyboard.press("End");
  await page.keyboard.press("Escape");
  await expect(location).toHaveAttribute("data-value", "Spain");
  await expect(page.getByRole("listbox")).toHaveCount(0);
  await location.click();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("listbox")).toHaveCount(0);
  await location.click();
  await page.getByRole("heading", { level: 1 }).click();
  await expect(page.getByRole("listbox")).toHaveCount(0);
  await page.getByRole("button", { name: "Search jobs", exact: true }).click();
  await expect(page).toHaveURL(/location=Spain/);
});

test("long select stays within mobile viewport and inside filter dialog", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/jobs");
  await page.locator(".mobile-filter-button").click();
  const dialog = page.getByRole("dialog");
  const category = dialog.getByRole("combobox", { name: "Job category" });
  await category.click();
  const menu = dialog.getByRole("listbox");
  await expect(menu).toBeVisible();
  const bounds = await menu.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.y).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(320);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(568);
  expect(await menu.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(
    true,
  );
  await category.press("End");
  await category.press("Enter");
  await expect(category).not.toHaveAttribute("data-value", "");
  await category.click();
  await category.press("Escape");
  await expect(dialog).toBeVisible();
  await expect(menu).toHaveCount(0);
  await category.click();
  await page.screenshot({
    path: `test-results/custom-select-${test.info().project.name}.png`,
  });
});

test("touch selects options in search and modal without blocking list scrolling", async ({
  page,
}, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile"));
  await page.goto("/jobs");
  const location = page.getByRole("combobox", { name: "Search location" });
  await location.tap();
  await page.getByRole("option", { name: "Spain", exact: true }).tap();
  await expect(location).toHaveAttribute("data-value", "Spain");
  await page.locator(".mobile-filter-button").tap();
  const category = page
    .getByRole("dialog")
    .getByRole("combobox", { name: "Job category" });
  await category.tap();
  await page
    .getByRole("listbox")
    .evaluate((el) => (el.scrollTop = el.scrollHeight));
  await page.getByRole("option", { name: "Sales", exact: true }).tap();
  await expect(category).toHaveAttribute("data-value", "Sales");
});
