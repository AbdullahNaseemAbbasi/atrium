import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic gate for signed-in areas: if there is no session cookie at all,
 * send the visitor to sign in before rendering. Real authorization (valid
 * signature, membership, role) happens in the data access layer on every
 * request, so this is only a fast path, never the security boundary.
 */
export function proxy(request: NextRequest) {
  const hasSession = request.cookies.has("atrium_session");
  if (!hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(request.nextUrl.pathname + request.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/w/:path*", "/portal/:path*", "/admin/:path*", "/onboarding"],
};
