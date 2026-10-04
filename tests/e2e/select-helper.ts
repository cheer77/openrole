import type { Locator } from "@playwright/test";
export async function selectOption(trigger: Locator, value: string) {
  await trigger.click();
  await trigger
    .page()
    .getByRole("option")
    .filter({ visible: true })
    .and(trigger.page().locator(`[data-value="${value}"]`))
    .click();
}
