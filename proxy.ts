import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Runs before every page request.
 *
 * 1. Supabase mode: refreshes the auth session (tokens expire hourly) and
 *    writes the new cookies to both the request and the response, as the
 *    @supabase/ssr guide requires. `getClaims()` verifies the JWT.
 * 2. Sends signed-out visitors to /login before rendering a protected area.
 *
 * This is a fast path only. Real authorization (membership, role, resource
 * access) happens in the data access layer on every request.
 */
const PROTECTED = [/^\/w\//, /^\/portal\//, /^\/admin(\/|$)/, /^\/onboarding(\/|$)/];

function toLogin(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = `?next=${encodeURIComponent(request.nextUrl.pathname + request.nextUrl.search)}`;
  return NextResponse.redirect(url);
}

function supabaseEnabled() {
  return (
    process.env.ATRIUM_BACKEND !== "memory" &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY && process.env.SUPABASE_SECRET_KEY)
  );
}

export async function proxy(request: NextRequest) {
  const isProtected = PROTECTED.some((pattern) => pattern.test(request.nextUrl.pathname));

  if (!supabaseEnabled()) {
    if (isProtected && !request.cookies.has("atrium_session")) return toLogin(request);
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        for (const [key, value] of Object.entries(headers ?? {})) response.headers.set(key, value);
      },
    },
  });

  // Don't put code between creating the client and this call: it refreshes the session.
  const { data } = await supabase.auth.getClaims();
  if (isProtected && !data?.claims) {
    const redirect = toLogin(request);
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  }
  return response;
}

export const config = {
  matcher: [
    // Everything except static files and images, so sessions refresh on public pages too.
    "/((?!_next/static|_next/image|favicon.ico|screenshots/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)",
  ],
};
