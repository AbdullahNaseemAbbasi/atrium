import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Short-lived signed tokens. Downloads in Supabase mode use Storage signed
 * URLs; the contract stays the same either way: authorize first, then issue
 * a link that expires quickly and names exactly one object.
 */
const TTL_SECONDS = 60;

function secret() {
  return process.env.STORAGE_SIGNING_SECRET ?? process.env.SESSION_SECRET ?? "atrium-local-storage-secret";
}

/** Signs `claims` with an expiry. Used for download links and upload tickets. */
export function signClaims<T extends object>(claims: T, ttlSeconds: number) {
  const body = Buffer.from(JSON.stringify({ ...claims, exp: Math.floor(Date.now() / 1000) + ttlSeconds })).toString("base64url");
  const signature = createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${signature}`;
}

/** The claims of a token this server signed, or null if it was altered or has expired. */
export function verifyClaims<T extends object>(token: string): (T & { exp: number }) | null {
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  const expected = Buffer.from(createHmac("sha256", secret()).update(body).digest("base64url"));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
  try {
    const claims = JSON.parse(Buffer.from(body, "base64url").toString()) as T & { exp: number };
    if (claims.exp < Math.floor(Date.now() / 1000)) return null;
    return claims;
  } catch {
    return null;
  }
}

export interface DownloadClaims {
  /** Deliverable version or project file id. */
  objectId: string;
  kind: "version" | "file";
  /** User the link was issued to; the route re-checks access for this user. */
  userId: string;
  orgSlug: string;
  exp: number;
}

export function signDownload(claims: Omit<DownloadClaims, "exp">) {
  return { token: signClaims(claims, TTL_SECONDS), expiresInSeconds: TTL_SECONDS };
}

export function verifyDownload(token: string): DownloadClaims | null {
  return verifyClaims<DownloadClaims>(token);
}
