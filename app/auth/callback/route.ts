import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/auth/safe-next";
import { usesSupabase } from "@/lib/supabase/config";

/**
 * Landing point for links Supabase Auth sends by email (password reset,
 * email confirmation). Exchanges the one-time code for a session, then
 * continues to `next` (same-site paths only).
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const next = safeNext(url.searchParams.get("next")) ?? "/login";
  const code = url.searchParams.get("code");

  if (usesSupabase() && code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  }
  return NextResponse.redirect(new URL("/login?error=link", url.origin));
}
