import { createHmac } from "node:crypto";
import type { BrowserContext, Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { createSeed, DEMO_PASSWORD } from "../lib/data/seed";
import { E2E_SESSION_SECRET } from "../playwright.config";

/** `E2E_BACKEND=supabase` runs the suite against a server on Supabase (see playwright.config.ts). */
export const ON_SUPABASE = process.env.E2E_BACKEND === "supabase";

const emails = new Map(createSeed(new Date()).users.map((user) => [user.id, user.email]));

/**
 * Signs in as a seeded user. Memory backend: sets the same HMAC session
 * cookie the app issues. Supabase: signs in through the real login form, so
 * the context gets genuine Supabase Auth cookies.
 */
export async function signInAs(context: BrowserContext, userId: string, baseURL: string) {
  if (!ON_SUPABASE) {
    const signature = createHmac("sha256", E2E_SESSION_SECRET).update(userId).digest("base64url");
    await context.addCookies([{ name: "atrium_session", value: `${userId}.${signature}`, url: baseURL }]);
    return;
  }
  const email = emails.get(userId);
  if (!email) throw new Error(`No seeded user ${userId}`);
  const page = await context.newPage();
  await page.goto(`${baseURL}/login`);
  // The form streams in over its Suspense fallback; type only once the swap is done.
  const password = page.locator('input[name="password"]');
  await expect(password).toHaveCount(1);
  await page.getByLabel("Work email").fill(email);
  await password.fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: /^Sign in/ }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 30_000 });
  await page.close();
}

/** Asserts the page rendered a not-found screen (soft 404 inside a streamed layout). */
export async function expectNotFound(page: Page) {
  await expect(page.getByText(/not found|doesn.t exist|couldn.t find|isn.t available|404/i).first()).toBeVisible();
}
