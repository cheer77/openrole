import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  workers: 2,
  reporter: "list",
  use: { baseURL: "http://127.0.0.1:3100", trace: "retain-on-failure" },
  projects: [
    {
      name: "firefox",
      testIgnore: "**/admin.spec.ts",
      use: {
        ...devices["Desktop Firefox"],
        viewport: { width: 1440, height: 1000 },
      },
    },
    {
      name: "desktop",
      testIgnore: "**/admin.spec.ts",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1000 },
      },
    },
    {
      name: "mobile-safari",
      testIgnore: "**/admin.spec.ts",
      use: { ...devices["iPhone 13"], browserName: "webkit" },
    },
    {
      name: "mobile",
      testIgnore: "**/admin.spec.ts",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
    ...["desktop", "firefox", "mobile-safari", "mobile"].map((name) => ({
      name: "owner-" + name,
      testMatch: "**/admin.spec.ts",
      dependencies: ["desktop", "firefox", "mobile-safari", "mobile"],
      use:
        name === "firefox"
          ? {
              ...devices["Desktop Firefox"],
              viewport: { width: 1440, height: 1000 },
            }
          : name === "mobile-safari"
            ? { ...devices["iPhone 13"], browserName: "webkit" as const }
            : name === "mobile"
              ? {
                  ...devices["iPhone 13"],
                  defaultBrowserType: "chromium" as const,
                }
              : {
                  ...devices["Desktop Chrome"],
                  viewport: { width: 1440, height: 1000 },
                },
    })),
  ],
  webServer: [
    {
      command: "node --experimental-strip-types tests/support/start-api.mjs",
      url: "http://127.0.0.1:4001/health",
      reuseExistingServer: false,
      timeout: 60000,
    },
    {
      env: {
        API_URL: "http://127.0.0.1:4001",
        INTERNAL_API_KEY: "test-internal-key-openrole-012345678901234567890",
        ADMIN_COOKIE_SECURE: "false",
        GEO_PROVIDER: "none",
        APP_ORIGIN: "https://jobs.example.test",
      },
      command: "npm run start -- --hostname 127.0.0.1 --port 3100",
      url: "http://127.0.0.1:3100/login",
      reuseExistingServer: false,
      timeout: 60000,
    },
  ],
});
