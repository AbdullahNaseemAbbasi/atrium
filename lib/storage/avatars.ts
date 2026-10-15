import "server-only";
import { AVATARS_BUCKET, usesSupabase } from "@/lib/supabase/config";
import { supabaseAdmin } from "@/lib/supabase/server";

/**
 * Profile photos. Supabase mode stores them in the public `avatars` bucket
 * under a fresh path per upload (so browsers and the image optimizer never
 * show a stale photo); memory mode keeps a small data URL on the user row.
 */
export const MAX_AVATAR_BYTES = 1.5 * 1024 * 1024;

const SIGNATURES: { type: string; extension: string; matches: (bytes: Uint8Array) => boolean }[] = [
  { type: "image/jpeg", extension: "jpg", matches: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { type: "image/png", extension: "png", matches: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  {
    type: "image/webp",
    extension: "webp",
    matches: (b) => String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP",
  },
];

/** The image type from the file's first bytes (the browser's `type` is only a hint). */
export function sniffAvatar(bytes: Uint8Array) {
  return SIGNATURES.find((signature) => signature.matches(bytes)) ?? null;
}

export async function storeAvatar(userId: string, bytes: Uint8Array, kind: { type: string; extension: string }) {
  if (!usesSupabase()) return `data:${kind.type};base64,${Buffer.from(bytes).toString("base64")}`;
  const path = `users/${userId}/${crypto.randomUUID()}.${kind.extension}`;
  const storage = supabaseAdmin().storage.from(AVATARS_BUCKET);
  const { error } = await storage.upload(path, bytes, { contentType: kind.type, cacheControl: "31536000", upsert: false });
  if (error) throw new Error(`Uploading the photo failed: ${error.message}`);
  return storage.getPublicUrl(path).data.publicUrl;
}

/** Removes a photo this user uploaded earlier. Seeded demo portraits and outside URLs are left alone. */
export async function removeAvatar(url: string | undefined, userId: string) {
  if (!url || !usesSupabase()) return;
  const marker = `/storage/v1/object/public/${AVATARS_BUCKET}/`;
  const index = url.indexOf(marker);
  if (index === -1) return;
  const path = decodeURIComponent(url.slice(index + marker.length));
  if (!path.startsWith(`users/${userId}/`)) return;
  const { error } = await supabaseAdmin().storage.from(AVATARS_BUCKET).remove([path]);
  if (error) console.error(`[atrium] removing old avatar ${path} failed`, error.message);
}
