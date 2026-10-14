import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Short-lived signed download tokens. In production these are replaced by
 * Supabase Storage signed URLs; the contract stays the same: authorize first,
 * then issue a link that expires quickly and names exactly one object.
 */
const TTL_SECONDS = 60;

function secret() {
  return process.env.STORAGE_SIGNING_SECRET ?? process.env.SESSION_SECRET ?? "atrium-local-storage-secret";
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
  const payload: DownloadClaims = { ...claims, exp: Math.floor(Date.now() / 1000) + TTL_SECONDS };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", secret()).update(body).digest("base64url");
  return { token: `${body}.${signature}`, expiresInSeconds: TTL_SECONDS };
}

export function verifyDownload(token: string): DownloadClaims | null {
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  const expected = Buffer.from(createHmac("sha256", secret()).update(body).digest("base64url"));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
  try {
    const claims = JSON.parse(Buffer.from(body, "base64url").toString()) as DownloadClaims;
    if (claims.exp < Math.floor(Date.now() / 1000)) return null;
    return claims;
  } catch {
    return null;
  }
}
