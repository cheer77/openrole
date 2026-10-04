import { expect, test } from "@playwright/test";

test("account entry, roles, and mode links keep the selected audience", async ({
  page,
}) => {
  await page.goto("/");
  if (test.info().project.name.startsWith("mobile")) {
    await page
      .getByRole("navigation", { name: "Mobile navigation" })
      .getByRole("link", { name: "Sign in" })
      .click();
  } else {
    await page.getByRole("link", { name: "Sign in" }).click();
  }
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Welcome back",
  );
  await page
    .getByRole("navigation", { name: "Account type" })
    .getByRole("link", { name: "Employer" })
    .click();
  await expect(page).toHaveURL(/\/login\?role=employer$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Welcome back, employer",
  );
  await page.getByRole("link", { name: "Create an account" }).click();
  await expect(page).toHaveURL(/\/register\?role=employer$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Create your employer account",
  );
  await expect(page.getByRole("textbox", { name: "Full name" })).toBeVisible();
  await page.getByRole("link", { name: "Close and return home" }).click();
  await expect(page).toHaveURL(/\/$/);
});

test("registration preview validates fields and never submits account details", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST") requests.push(request.url());
  });
  await page.goto("/register");
  await page.getByRole("textbox", { name: "Full name" }).fill("Alex Example");
  await page
    .getByRole("textbox", { name: "Email address" })
    .fill("alex@example.com");
  await page.getByLabel("Password").fill("example-password");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("status")).toContainText("not sent or saved");
  await expect(page).toHaveURL(/\/register$/);
  expect(requests).toEqual([]);
});

test("Facebook and Google options show a preview message without leaving the page", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST") requests.push(request.url());
  });
  for (const path of ["/login", "/register?role=employer"]) {
    await page.goto(path);
    for (const provider of ["Facebook", "Google"]) {
      await page.getByRole("button", { name: provider }).click();
      await expect(page.getByRole("status")).toContainText(
        `${provider} sign-in is not available`,
      );
      await expect(page).toHaveURL(new RegExp(path.replace("?", "\\?") + "$"));
    }
  }
  expect(requests).toEqual([]);
});

test("auth screens fit a narrow phone without the regular mobile navigation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 280, height: 740 });
  for (const path of ["/login", "/register?role=employer"]) {
    await page.goto(path);
    await expect(
      page.getByRole("navigation", { name: "Account type" }),
    ).toBeVisible();
    await expect(page.locator(".mobile-bottom-nav")).toBeHidden();
    await expect(
      page.getByRole("button", { name: /Sign in|Create account/ }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Facebook" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Google" })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});
