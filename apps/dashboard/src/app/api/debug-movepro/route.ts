import { NextResponse } from "next/server";

import { dashcardUrl, extractEmbedJwt } from "../../../lib/movepro-actions";

export const dynamic = "force-dynamic";
// Two sequential probes, up to 10s each — give both room to finish.
export const maxDuration = 25;

const REPORT_URL = "https://api.movepro.com.au/nolimitsremovalists/api/v1/reports/17";
const TIMEOUT_MS = 10000;

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

async function timedFetch(url: string, headers: Record<string, string>): Promise<FetchProbe> {
  const start = Date.now();
  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
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

/**
 * One-shot connectivity probe for the two MovePro/Metabase calls /actions
 * depends on — isolates whether a failure is auth (bad/missing token),
 * network (timeout/DNS/connection refused — the current production
 * symptom), or a response-shape mismatch, without guessing via timeout
 * tuning. Session-gated (not in middleware's public list): the mint response
 * carries a live Metabase JWT (redacted above) and the dashcard response
 * carries real customer names, neither of which belongs in a public route.
 */
export async function GET() {
  const token = process.env.MOVEPRO_TOKEN;
  const tokenSet = Boolean(token);

  const mintRaw = await timedFetch(REPORT_URL, {
    ...(token ? { authorization: `Bearer ${token}` } : {}),
    accept: "application/json, text/plain, */*",
    origin: "https://app.movepro.com.au",
    referer: "https://app.movepro.com.au/",
    "x-request-with": "XMLHttpRequest",
  });
  const mint = toProbeResult(mintRaw);

  let dashcard: ProbeResult | { skipped: string };
  if ("text" in mintRaw && mintRaw.status >= 200 && mintRaw.status < 300) {
    const jwt = ((): string | null => {
      try {
        return extractEmbedJwt(JSON.parse(mintRaw.text));
      } catch {
        return null;
      }
    })();
    if (jwt) {
      const dashcardRaw = await timedFetch(dashcardUrl(jwt, "thisday"), { accept: "application/json" });
      dashcard = toProbeResult(dashcardRaw);
    } else {
      dashcard = { skipped: "mint response didn't yield a report.metabase_token to use" };
    }
  } else {
    dashcard = { skipped: "mint step didn't return 2xx — no JWT to probe with" };
  }

  return NextResponse.json({ tokenSet, mint, dashcard }, { headers: { "cache-control": "no-store" } });
}
