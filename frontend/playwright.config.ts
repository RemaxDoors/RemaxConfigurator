import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests for Remax ConfigHub.
 *
 * Point at a running instance with BASE_URL — a local dev server, or the Azure
 * app to check a deploy:
 *
 *   BASE_URL=https://rapid-door-estimator.azurewebsites.net npx playwright test
 *
 * With no BASE_URL it starts `npm run dev` itself and tests that.
 *
 * These are read-only. Nothing here creates, edits or deletes a rule,
 * parameter or default, because the only databases to run against hold real
 * pricing configuration — a test that "cleans up after itself" is one failed
 * assertion away from leaving that configuration changed. Anything that writes
 * belongs against a scratch database, and is marked as such.
 */
const baseURL = process.env.BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  // The app talks to two databases over ODBC; a cold page can genuinely take
  // several seconds before anything renders.
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  // A test that only passes on the second run is a broken test. Retry in CI
  // only, where the flake is usually the runner rather than the app.
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    // The configurator wizard and the admin tables are the parts most likely
    // to break on a narrow screen, and salespeople do open quotes on tablets.
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: "npm run dev",
        url: "http://localhost:3000",
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
