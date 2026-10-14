import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests run against a production build on its own port, so they
 * never touch the data of a running dev server. The in-memory store starts
 * from the same seed on every boot.
 */
const PORT = 3200;
export const E2E_SESSION_SECRET = "e2e-session-secret-at-least-32-characters-long";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } }, testIgnore: /responsive/ },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /responsive/ },
  ],
  webServer: {
    command: `pnpm start --port ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { SESSION_SECRET: E2E_SESSION_SECRET, ATRIUM_DEMO: "true" },
  },
});
