import { createHmac } from "node:crypto";
import type { BrowserContext, Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { E2E_SESSION_SECRET } from "../playwright.config";

/** Signs in by setting the same HMAC session cookie the app issues. */
export async function signInAs(context: BrowserContext, userId: string, baseURL: string) {
  const signature = createHmac("sha256", E2E_SESSION_SECRET).update(userId).digest("base64url");
  await context.addCookies([{ name: "atrium_session", value: `${userId}.${signature}`, url: baseURL }]);
}

/** Asserts the page rendered a not-found screen (soft 404 inside a streamed layout). */
export async function expectNotFound(page: Page) {
  await expect(page.getByText(/not found|doesn.t exist|couldn.t find|isn.t available|404/i).first()).toBeVisible();
}
