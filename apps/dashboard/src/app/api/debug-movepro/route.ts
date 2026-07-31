import { NextResponse, type NextRequest } from "next/server";

import { dashcardUrl, extractEmbedJwt } from "../../../lib/movepro-actions";

export const dynamic = "force-dynamic";
// Mint + single dashcard probe (up to 10s each) + an optional concurrent-
// dashcard batch (up to 25s, but run in parallel so it doesn't multiply).
export const maxDuration = 60;

const REPORT_URL = "https://api.movepro.com.au/nolimitsremovalists/api/v1/reports/17";
const TIMEOUT_MS = 10000;
// Deliberately longer than the single-probe timeout: the point of the
// concurrency test is to see the REAL elapsed time under fan-out load, even
// if that's well past 10s — a probe that itself times out at 10s can't tell
// "concurrent requests are slow" from "concurrent requests never respond."
const CONCURRENT_TIMEOUT_MS = 25000;

const JWT_SHAPE = /[A-Za-z0-9\-_]{10,}\.[A-Za-z0-9\-_]{10,}\.[A-Za-z0-9\-_]{10,}/;

/** Replaces a live JWT (a working bearer-equivalent credential) with a
 * length-preserving placeholder before it's ever put in a response body —
 * seeing "we got a token back" has full diagnostic value, seeing the actual
 * token does not. */
function redactJwt(text: string): string {
  const match = text.match(JWT_SHAPE);
  if (!match) return text;
  return text.replace(match[0], `<redacted-jwt:${match[0].length}chars>`);
}

type FetchProbe =
  | { status: number; elapsedMs: number; text: string }
  | { errorName: string; errorMessage: string; errorCause?: string };

async function timedFetch(
  url: string,
  headers: Record<string, string>,
  timeoutMs: number = TIMEOUT_MS,
): Promise<FetchProbe> {
  const start = Date.now();
  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(timeoutMs) });
    const text = await res.text();
    return { status: res.status, elapsedMs: Date.now() - start, text };
  } catch (err) {
    return {
      errorName: err instanceof Error ? err.name : "UnknownError",
      errorMessage: err instanceof Error ? err.message : String(err),
      ...(err instanceof Error && err.cause ? { errorCause: String(err.cause) } : {}),
    };
  }
}

type ProbeResult =
  | { status: number; elapsedMs: number; bodyFirst200chars: string }
  | { errorName: string; errorMessage: string; errorCause?: string };

function toProbeResult(r: FetchProbe): ProbeResult {
  if ("text" in r) {
    return { status: r.status, elapsedMs: r.elapsedMs, bodyFirst200chars: redactJwt(r.text).slice(0, 200) };
  }
  return r;
}

/** N distinct past date strings (yyyy-MM-dd), for a concurrent batch that
 * mirrors getActionsSnapshot's real pattern: N different Metabase report
 * queries fired at once, not N identical (and possibly cached/coalesced)
 * ones. Plain UTC day math — this is a load probe, not a Sydney-calendar
 * calculation, so exact timezone boundaries don't matter here. */
function pastDates(n: number): string[] {
  const dates: string[] = [];
  const now = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

/**
 * One-shot connectivity probe for the two MovePro/Metabase calls /actions
 * depends on — isolates whether a failure is auth (bad/missing token),
 * network (timeout/DNS/connection refused), or a response-shape mismatch,
 * without guessing via timeout tuning. Also fires a concurrent batch of
 * dashcard requests (?concurrency=N, default 20, max 40) mirroring
 * getActionsSnapshot's real fan-out pattern — a single isolated request can
 * look fine while N of them at once overwhelm Metabase, and that's a
 * different failure mode than plain per-request latency. Session-gated (not
 * in middleware's public list): the mint response carries a live Metabase
 * JWT (redacted above) and the dashcard response carries real customer
 * names, neither of which belongs in a public route.
 */
export async function GET(request: NextRequest) {
  const token = process.env.MOVEPRO_TOKEN;
  const tokenSet = Boolean(token);

  const requestedConcurrency = Number(request.nextUrl.searchParams.get("concurrency"));
  const concurrency = Number.isFinite(requestedConcurrency)
    ? Math.min(40, Math.max(1, Math.round(requestedConcurrency)))
    : 20;

  const mintRaw = await timedFetch(REPORT_URL, {
    ...(token ? { authorization: `Bearer ${token}` } : {}),
    accept: "application/json, text/plain, */*",
    origin: "https://app.movepro.com.au",
    referer: "https://app.movepro.com.au/",
    "x-request-with": "XMLHttpRequest",
  });
  const mint = toProbeResult(mintRaw);

  const jwt =
    "text" in mintRaw && mintRaw.status >= 200 && mintRaw.status < 300
      ? ((): string | null => {
          try {
            return extractEmbedJwt(JSON.parse(mintRaw.text));
          } catch {
            return null;
          }
        })()
      : null;

  let dashcard: ProbeResult | { skipped: string };
  let concurrentDashcards: { concurrency: number; results: ProbeResult[] } | { skipped: string };

  if (jwt) {
    const dashcardRaw = await timedFetch(dashcardUrl(jwt, "thisday"), { accept: "application/json" });
    dashcard = toProbeResult(dashcardRaw);

    const dates = pastDates(concurrency);
    const results = await Promise.all(
      dates.map((d) =>
        timedFetch(dashcardUrl(jwt, `${d}~${d}`), { accept: "application/json" }, CONCURRENT_TIMEOUT_MS).then(
          toProbeResult,
        ),
      ),
    );
    concurrentDashcards = { concurrency, results };
  } else {
    const reason =
      "text" in mintRaw && mintRaw.status >= 200 && mintRaw.status < 300
        ? "mint response didn't yield a report.metabase_token to use"
        : "mint step didn't return 2xx — no JWT to probe with";
    dashcard = { skipped: reason };
    concurrentDashcards = { skipped: reason };
  }

  return NextResponse.json(
    { tokenSet, mint, dashcard, concurrentDashcards },
    { headers: { "cache-control": "no-store" } },
  );
}
