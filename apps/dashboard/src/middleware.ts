import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE } from "./lib/session";

/**
 * Cheap gate: presence of the session cookie. Full JWT verification happens
 * server-side in every page/action via requireSession — this only stops
 * anonymous browsing early. /tv, /live, /actions, /api/boards, /api/actions,
 * /api/unseen, /api/version, /sounds and /wall (the wall displays' celebration
 * audio and static images, e.g. Danny's host portrait on /live/game-day) are
 * deliberately public (data-minimal board numbers for the wall display).
 * /wall must NOT be shortened to a prefix that collides with a real
 * authenticated route (e.g. "game-day" would also whitelist the manager-only
 * /game-day and /game-day-history pages below this same matcher).
 * /api/ingest is public but guarded by its own INGEST_SECRET bearer token.
 *
 * /api/version was missing from this list until now — wall displays have no
 * session cookie, so every poll was silently redirected to /sign-in instead
 * of getting real JSON, the `.catch` in checkForNewDeploy swallowed the
 * failure, and the auto-reload-on-new-deploy feature never actually fired on
 * any real wall display.
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
    "/((?!sign-in|tv|live|actions|api/boards|api/actions|api/unseen|api/version|api/cron|api/ingest|sounds|wall|_next/static|_next/image|favicon.ico|icon.svg|robots.txt).*)",
  ],
};
