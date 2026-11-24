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
// a diagnostic probe (since removed — /api/debug-movepro) proved these
// endpoints legitimately take 5s+ (Metabase actually executing the report
// query), not a network block.
export const FETCH_TIMEOUT_MS = 20000;

// Names to keep off both /actions boards. Originally just site inspectors,
// inactive staff, and other non-roster entities that show up in MovePro's
// activity/unseen data despite not being real reps — but it's since also
// grown to cover real reps management wants hidden from /actions
// specifically (e.g. they still show elsewhere, like /live or Game Day,
// just not here). Shared here (not duplicated per report) since both boards
// need it — movepro-unseen.ts exempts "Unassigned" from this list on its own
// board, where it's a meaningful bucket rather than noise.
const EXCLUDED_NAMES = new Set(
  [
    "Liam",
    "Max",
    "Danny",
    "Unassigned",
    "Kate",
    "Youi",
    "Avan",
    "Hermez",
    "Ace",
    "Martin",
    "Andy",
    "kinan",
    "Sales",
    "Mark",
    "Domanic",
    "Jake",
    "Rony",
    "Simon",
    "Francis",
    "Harry",
    "Eva",
  ].map((n) => n.toLowerCase()),
);

export function isExcludedName(name: string): boolean {
  return EXCLUDED_NAMES.has(name.toLowerCase());
}

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

/** Cleans a pasted MOVEPRO_TOKEN: trims whitespace/newlines, strips wrapping quotes and a leading
 * "Bearer " — the usual copy/paste mistakes from the browser's Authorization header. */
export function normalizeMoveproToken(raw: string): string {
  let t = raw.trim().replace(/^["'`]+|["'`]+$/g, "").trim();
  t = t.replace(/^authorization:\s*/i, "").replace(/^bearer\s+/i, "");
  return t.replace(/\s+/g, "");
}

/** A SAFE description of the token's shape (never the value) for error messages — enough to spot a
 * truncated / wrong / stale paste without leaking the credential. */
export function describeMoveproToken(raw: string | undefined): string {
  if (!raw) return "not set";
  const t = normalizeMoveproToken(raw);
  const pipe = t.indexOf("|");
  return `length ${t.length}, ${pipe > 0 ? `id part ${pipe} digits + ${t.length - pipe - 1}-char secret` : "no '|' (expected 'id|secret')"}${raw !== t ? ", had extra whitespace/'Bearer'/quotes (auto-cleaned)" : ""}`;
}

interface JwtCacheEntry {
  token: string;
  at: number;
}
const JWT_TTL_MS = 24 * 60 * 60 * 1000;
const jwtCaches = new Map<string, JwtCacheEntry>();

async function mintEmbedJwt(reportUrl: string, cacheKey: string): Promise<string> {
  const rawToken = process.env.MOVEPRO_TOKEN;
  if (!rawToken) throw new Error("MOVEPRO_TOKEN is not set");
  const token = normalizeMoveproToken(rawToken);

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
    const hint = res.status === 401 ? ` [MOVEPRO_TOKEN as deployed: ${describeMoveproToken(rawToken)}]` : "";
    throw new Error(`MovePro report mint ${res.status}: ${await res.text()}${hint}`);
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
