import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE } from "./lib/session";

/**
 * Cheap gate: presence of the session cookie. Full JWT verification happens
 * server-side in every page/action via requireSession — this only stops
 * anonymous browsing early. /tv and /api/boards are deliberately public
 * (data-minimal board numbers for the wall display).
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (request.cookies.has(SESSION_COOKIE)) return NextResponse.next();
  const signInUrl = new URL("/sign-in", request.url);
  if (pathname !== "/sign-in") signInUrl.searchParams.set("from", pathname);
  return NextResponse.redirect(signInUrl);
}

export const config = {
  matcher: [
    "/((?!sign-in|tv|api/boards|api/cron|_next/static|_next/image|favicon.ico|icon.svg|robots.txt).*)",
  ],
};
