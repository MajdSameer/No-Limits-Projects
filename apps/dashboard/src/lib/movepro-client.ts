/**
 * Shared low-level MovePro/Metabase client: per-report JWT minting (cached
 * independently per report — each report id mints against a different URL
 * and returns an unrelated JWT) and a fetch-with-one-retry-on-401/400
 * wrapper. Report-specific URL building and row shapes live in each report's
 * own module (movepro-actions.ts for report 17's dashboard embed,
 * movepro-unseen.ts for report 9's question embed) — this only knows about
 * authentication and generic HTTP retry, not what the data looks like.
 */

// A hung/unresponsive external request has no default Node timeout — without
// one, a single stuck fetch silently burns the entire route's maxDuration and
// the caller gets an opaque platform 504 with nothing logged. This bounds
// each request so a real failure surfaces fast, as a readable error. 20s:
// /api/debug-movepro proved these endpoints legitimately take 5s+ (Metabase
// actually executing the report query), not a network block.
export const FETCH_TIMEOUT_MS = 20000;

/** Verified report-mint response shape: { report: { metabase_token: "<jwt>" } }.
 * Report 17 also nests a `resource: { dashboard }`, report 9 a
 * `resource: { question }` — the JWT itself lives at the same path either
 * way, so this works unchanged for both. */
export function extractEmbedJwt(body: unknown): string {
  const jwt = (body as { report?: { metabase_token?: unknown } })?.report?.metabase_token;
  if (typeof jwt !== "string" || !jwt) {
    throw new Error(
      `MovePro report mint: expected report.metabase_token, got: ${JSON.stringify(body).slice(0, 500)}`,
    );
  }
  return jwt;
}

interface JwtCacheEntry {
  token: string;
  at: number;
}
const JWT_TTL_MS = 24 * 60 * 60 * 1000;
const jwtCaches = new Map<string, JwtCacheEntry>();

async function mintEmbedJwt(reportUrl: string, cacheKey: string): Promise<string> {
  const token = process.env.MOVEPRO_TOKEN;
  if (!token) throw new Error("MOVEPRO_TOKEN is not set");

  // Headers match MovePro's own app request exactly (verified externally) —
  // the API appears to expect this shape (origin/referer/x-request-with),
  // not just the bearer token.
  const res = await fetch(reportUrl, {
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/json, text/plain, */*",
      origin: "https://app.movepro.com.au",
      referer: "https://app.movepro.com.au/",
      "x-request-with": "XMLHttpRequest",
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`MovePro report mint ${res.status}: ${await res.text()}`);
  }
  const jwt = extractEmbedJwt(await res.json());
  jwtCaches.set(cacheKey, { token: jwt, at: Date.now() });
  return jwt;
}

async function getEmbedJwt(reportUrl: string, cacheKey: string, forceFresh = false): Promise<string> {
  const cached = jwtCaches.get(cacheKey);
  if (!forceFresh && cached && Date.now() - cached.at < JWT_TTL_MS) return cached.token;
  return mintEmbedJwt(reportUrl, cacheKey);
}

/** Fetches a JWT-authenticated Metabase embed URL, re-minting the JWT once
 * and retrying on a 401/400 (an expired or invalid embed JWT) — same
 * semantics as the original per-report retry logic, just parametrized.
 * `buildUrl` receives the JWT since it's embedded in the URL path, not a
 * header. Returns the raw Response; callers check `.ok` and parse the body
 * themselves, since the expected shape differs per report. */
export async function fetchWithJwtRetry(
  reportUrl: string,
  cacheKey: string,
  buildUrl: (jwt: string) => string,
  headers: Record<string, string>,
): Promise<Response> {
  const jwt = await getEmbedJwt(reportUrl, cacheKey);
  const res = await fetch(buildUrl(jwt), { headers, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (res.status === 401 || res.status === 400) {
    const freshJwt = await getEmbedJwt(reportUrl, cacheKey, true);
    return fetch(buildUrl(freshJwt), { headers, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  }
  return res;
}
