import { timingSafeEqual } from "node:crypto";
import { connection } from "next/server";
import { resetDb } from "@/lib/data/store";
import { resetDemoData } from "@/lib/data/supabase/demo-seed";
import { usesSupabase } from "@/lib/supabase/config";
import { supabaseAdmin } from "@/lib/supabase/server";

/**
 * Scheduled demo reset (for example every night). Puts the two demo
 * workspaces and demo profiles back to the seed; workspaces people created
 * themselves are untouched. Needs `Authorization: Bearer <CRON_SECRET>`;
 * anything else gets a 404 so the endpoint isn't discoverable.
 */
export async function GET(request: Request) {
  await connection();
  const secret = process.env.CRON_SECRET;
  if (!secret || !matches(request.headers.get("authorization") ?? "", `Bearer ${secret}`)) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  if (!usesSupabase()) {
    resetDb();
    return Response.json({ reset: "memory" }, { headers: { "Cache-Control": "no-store" } });
  }
  const summary = await resetDemoData(supabaseAdmin());
  return Response.json(
    { reset: "supabase", objects: summary.objects, removedObjects: summary.removedObjects },
    { headers: { "Cache-Control": "no-store" } },
  );
}

function matches(received: string, expected: string) {
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
