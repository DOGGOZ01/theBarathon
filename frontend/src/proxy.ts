import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/register"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    PUBLIC_PATHS.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/manifest") ||
    pathname.startsWith("/sw.js") ||
    pathname.startsWith("/icons")
  ) {
    return NextResponse.next();
  }

  const hasSession = request.cookies.has("refresh_token");
  if (!hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // /tiles is the self-hosted PMTiles map archive: plain OpenStreetMap data,
  // not sensitive, and it must be reachable via HTTP range requests without
  // going through the auth-redirect logic below.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|tiles).*)"],
};
