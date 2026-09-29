import { NextResponse, type NextRequest } from "next/server";

/**
 * Edge guard (Next 16 proxy, formerly middleware): any dashboard page without
 * a session cookie bounces to /login. Full session validation happens
 * server-side in pages/routes; this only avoids rendering shells for guests.
 */
const PUBLIC_PATHS = ["/login", "/register", "/api/auth", "/api/rest/health", "/l", "/api/webhooks"];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (isPublic) return NextResponse.next();

  const hasSession = req.cookies.has("omnipost_session");
  if (!hasSession) {
    // API routes get JSON 401, never an HTML redirect.
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        {
          error: {
            code: "UNAUTHENTICATED",
            message: "You must be signed in to do that.",
          },
        },
        { status: 401 },
      );
    }
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    // everything except static assets and Next internals
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
