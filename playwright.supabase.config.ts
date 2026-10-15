import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

/**
 * The E2E suite on Supabase: sign-in goes through Supabase Auth (see
 * e2e/helpers.ts) and every write hits Postgres. Needs the Supabase keys in
 * .env.local. It changes the shared demo data, so reset it before and after
 * (`pnpm seed`, or GET /api/cron/reset-demo with the CRON_SECRET).
 */
process.env.E2E_BACKEND = "supabase";

type WebServer = Exclude<NonNullable<typeof base.webServer>, unknown[]>;
const server = base.webServer as WebServer;

export default defineConfig({
  ...base,
  webServer: { ...server, env: { ATRIUM_DEMO: "true" } },
});
