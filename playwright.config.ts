import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration.
 *
 * Two test suites:
 *   1. E2E tests (tests/e2e/) — run against a live Next.js dev server.
 *   2. Scraper tests (tests/e2e/scrapers/) — hit real township websites.
 *      These are tagged @slow and skipped in CI by default.
 *
 * Docs: https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
  ],
  use: {
    // Base URL for e2e tests — assumes `npm run dev` is running
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // Start dev server automatically for e2e tests
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
