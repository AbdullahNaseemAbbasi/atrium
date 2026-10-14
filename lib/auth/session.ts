import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * Signed session cookie for the demo build.
 *
 * Supabase Auth replaces this module later; the rest of the app only talks to
 * `readSessionUserId`, `createSession` and `destroySession`, so the swap stays
 * local to this file. The cookie is httpOnly, SameSite=Lax and HMAC-signed so
 * it cannot be forged by editing it in the browser.
 */
const COOKIE_NAME = "atrium_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

function secret() {
  const value = process.env.SESSION_SECRET;
  if (value && value.length >= 32) return value;
  if (process.env.NODE_ENV === "production" && process.env.ATRIUM_DEMO !== "true") {
    throw new Error("SESSION_SECRET must be set to at least 32 characters in production.");
  }
  return "atrium-local-development-secret-do-not-use-in-prod";
}

function sign(value: string) {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

function verify(token: string): string | null {
  const [userId, signature] = token.split(".");
  if (!userId || !signature) return null;
  const expected = Buffer.from(sign(userId));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
  return userId;
}

export async function readSessionUserId(): Promise<string | null> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  return token ? verify(token) : null;
}

export async function createSession(userId: string) {
  (await cookies()).set(COOKIE_NAME, `${userId}.${sign(userId)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function destroySession() {
  (await cookies()).delete(COOKIE_NAME);
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
