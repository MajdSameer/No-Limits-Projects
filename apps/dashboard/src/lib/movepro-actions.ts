import { addDays } from "date-fns";
import { format, toZonedTime } from "date-fns-tz";
import { unstable_cache } from "next/cache";

import { fetchWithJwtRetry, isExcludedName } from "./movepro-client";
import { SYDNEY_TZ, sydneyToday } from "./sydney";

/**
 * /actions data source: MovePro's Metabase-embedded activity report (calls,
 * emails, messages per sales agent). Unrelated to packages/movepro (the quote
 * calculator's mock/live adapter for the marketing site, MOVEPRO_MODE/
 * MOVEPRO_API_KEY/MOVEPRO_BASE_URL) — this talks to a different MovePro API
 * (api.movepro.com.au + movepro.metabaseapp.com) using its own token,
 * MOVEPRO_TOKEN, via the shared client in movepro-client.ts (also used by
 * movepro-unseen.ts for report 9). Report/dashcard/card ids (17, 269, 628)
 * are fixed — they identify this specific saved report in MovePro, not
 * something to configure.
 */

const REPORT_URL = "https://api.movepro.com.au/nolimitsremovalists/api/v1/reports/17";
const DASHCARD_URL = "https://movepro.metabaseapp.com/api/embed/dashboard";
const DASHCARD_ID = 269;
const CARD_ID = 628;
// Cache key for this report's JWT in movepro-client's per-report cache —
// arbitrary, just needs to be unique per report (see movepro-unseen.ts's "unseen").
const JWT_CACHE_KEY = "actions";

export { extractEmbedJwt } from "./movepro-client";

export interface ActionRowDTO {
  name: string;
  calls: number;
  emails: number;
  messages: number;
  total: number;
}

export interface ActionsResponseDTO {
  updatedAt: string;
  daily: ActionRowDTO[];
  monthly: ActionRowDTO[];
}

interface AgentAgg {
  totalActions: number;
  calls: number;
  emails: number;
  messages: number;
}

function emptyAgg(): AgentAgg {
  return { totalActions: 0, calls: 0, emails: 0, messages: 0 };
}

/**
 * "Thomas Issac NoLimits" → "Issac", "Ann Ablahad" → "Ann", "Luka No Limits" →
 * "Luka", "Randee Naamo" → "Randee". Matches the first-name convention used
 * everywhere else on the wall (/live), with the company-name suffix MovePro
 * appends to some agents stripped first — when it's present, the meaningful
 * name is the word right before it, not the first word.
 */
export function parseActionAgentName(raw: string): string {
  const stripped = raw.replace(/\s*(no\s*limits)\s*$/i, "").trim();
  const words = stripped.split(/\s+/).filter(Boolean);
  if (words.length === 0) return raw.trim();
  return stripped.length < raw.trim().length ? words[words.length - 1]! : words[0]!;
}

/** Row shape from the report: [order_id, ref, sales_agent, customer, status, created_at, total_actions, calls, emails, messages]. */
export type ActionRow = [
  unknown,
  unknown,
  string,
  unknown,
  unknown,
  unknown,
  number | null,
  number | null,
  number | null,
  number | null,
];

/** Pure aggregation of one query's raw rows into a per-agent map, keyed by the
 * raw sales_agent string (display-name parsing happens later, at assembly). */
export function sumRowsByAgent(rows: ActionRow[]): Map<string, AgentAgg> {
  const byAgent = new Map<string, AgentAgg>();
  for (const row of rows) {
    const agent = row[2];
    if (!agent) continue;
    const agg = byAgent.get(agent) ?? emptyAgg();
    agg.totalActions += row[6] ?? 0;
    agg.calls += row[7] ?? 0;
    agg.emails += row[8] ?? 0;
    agg.messages += row[9] ?? 0;
    byAgent.set(agent, agg);
  }
  return byAgent;
}

function mergeAgg(into: Map<string, AgentAgg>, from: Map<string, AgentAgg>): void {
  for (const [agent, agg] of from) {
    const existing = into.get(agent) ?? emptyAgg();
    existing.totalActions += agg.totalActions;
    existing.calls += agg.calls;
    existing.emails += agg.emails;
    existing.messages += agg.messages;
    into.set(agent, existing);
  }
}

export function toDTO(byAgent: Map<string, AgentAgg>): ActionRowDTO[] {
  return [...byAgent.entries()]
    .map(([raw, agg]) => ({
      name: parseActionAgentName(raw),
      calls: agg.calls,
      emails: agg.emails,
      messages: agg.messages,
      // total is the report's own total_actions column (row index 6), summed —
      // never derived from calls+emails+messages, since total_actions can cover
      // action types beyond those 3 and the numbers must exactly match MovePro.
      total: agg.totalActions,
    }))
    .filter((r) => !isExcludedName(r.name))
    .sort((a, b) => b.total - a.total);
}

// ── Row fetch ────────────────────────────────────────────────────────────

export function dashcardUrl(jwt: string, dateFilter: string, salesAgent?: string): string {
  const parameters = salesAgent ? { date: dateFilter, sales_agent: salesAgent } : { date: dateFilter };
  return `${DASHCARD_URL}/${jwt}/dashcard/${DASHCARD_ID}/card/${CARD_ID}?parameters=${encodeURIComponent(JSON.stringify(parameters))}`;
}

/** Fetches rows for one query, via the shared client's JWT mint + one-retry-
 * on-401/400 logic. */
export async function fetchActionRows(dateFilter: string, salesAgent?: string): Promise<ActionRow[]> {
  const res = await fetchWithJwtRetry(
    REPORT_URL,
    JWT_CACHE_KEY,
    (jwt) => dashcardUrl(jwt, dateFilter, salesAgent),
    { accept: "application/json" },
  );
  if (!res.ok) {
    throw new Error(`MovePro dashcard fetch ${res.status}: ${await res.text()}`);
  }
  return extractRows(await res.json());
}

/** Verified dashcard response shape: { status: "completed", data: { rows: [...] } }. */
export function extractRows(body: unknown): ActionRow[] {
  const rows =
    (body as { data?: { rows?: unknown } })?.data?.rows ??
    (body as { rows?: unknown })?.rows ??
    (Array.isArray(body) ? body : null);
  if (!Array.isArray(rows)) {
    throw new Error(`MovePro dashcard fetch: unexpected response shape: ${JSON.stringify(body).slice(0, 500)}`);
  }
  return rows as ActionRow[];
}

const TRUNCATION_LIMIT = 2000;

/** Per-agent totals for one Sydney calendar day, applying the 2000-row
 * truncation guard: if the plain query hits the row cap, re-query per agent
 * in `knownAgents` — the union of sales_agent values already seen this month
 * (prior fetched days + today's response), passed in by the caller rather
 * than kept as a hardcoded roster, since there's no other source of "all
 * possible sales agents" in this codebase. If even a per-agent re-query still
 * hits the cap (one agent alone produced 2000+ rows that day — implausible
 * but not impossible), or `knownAgents` is empty (nothing yet known to
 * re-query against), the day can't be safely disaggregated: log it and
 * return null so the caller excludes it from totals rather than risk a
 * silent undercount. */
export async function fetchDayAggregate(
  dateStr: string,
  knownAgents: ReadonlySet<string>,
): Promise<Map<string, AgentAgg> | null> {
  const dateFilter = `${dateStr}~${dateStr}`;
  const rows = await fetchActionRows(dateFilter);

  if (rows.length !== TRUNCATION_LIMIT) {
    return sumRowsByAgent(rows);
  }

  if (knownAgents.size === 0) {
    console.error(
      `MovePro dashcard truncation guard: ${dateStr} hit the ${TRUNCATION_LIMIT}-row cap with no known agent ` +
        `roster to re-query yet — marking ${dateStr} suspect (excluded from totals) rather than risk an undercount.`,
    );
    return null;
  }

  const perAgent = await Promise.all(
    [...knownAgents].map(async (agent) => ({ agent, rows: await fetchActionRows(dateFilter, agent) })),
  );
  const stillTruncated = perAgent.find((r) => r.rows.length === TRUNCATION_LIMIT);
  if (stillTruncated) {
    console.error(
      `MovePro dashcard truncation guard: per-agent re-query for "${stillTruncated.agent}" on ${dateStr} still ` +
        `hit the ${TRUNCATION_LIMIT}-row cap — marking ${dateStr} suspect (excluded from totals) rather than sum it.`,
    );
    return null;
  }

  const merged = new Map<string, AgentAgg>();
  for (const { rows: agentRows } of perAgent) mergeAgg(merged, sumRowsByAgent(agentRows));
  return merged;
}

// ── Monthly assembly ─────────────────────────────────────────────────────

/** Runs `fn` over `items` with at most `limit` in flight at once, not
 * Promise.all's unbounded fan-out. Metabase serialises concurrent report
 * queries on its own backend — confirmed via /api/debug-movepro's
 * ?concurrency probe: 20 parallel dashcard calls each took 12-16s (vs ~5s
 * solo), so the original unbounded ~31-wide cold-start fan-out was timing
 * everything out by overloading Metabase, not by hitting any per-request
 * problem. */
export async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker(): Promise<void> {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]!);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

const DASHCARD_CONCURRENCY = 5;

/** Agents seen so far this process — feeds the truncation guard in
 * fetchDayAggregate. Resets on cold start (there's no durable source of "all
 * possible sales agents" to seed it from), same accepted caveat as before;
 * unrelated to the day-result cache below, which is now durable. */
const knownAgents = new Set<string>();

/** A completed Sydney calendar day's aggregate never changes once computed,
 * so it's cached in Next's Data Cache (durable on Vercel — survives cold
 * starts, unlike a module-level Map) rather than refetched every poll. Keyed
 * by the date string ONLY: the JWT embedded in the dashcard URL rotates
 * every ~24h and must never be part of the cache key, or every mint would
 * silently bust the whole month's cache. `revalidate: false` because a
 * completed day is immutable — there's nothing to revalidate. A suspect day
 * (fetchDayAggregate's truncation guard returning null) throws instead of
 * resolving, so Next never caches it — it's retried on the next poll rather
 * than permanently excluded. */
const getCachedDayEntries = unstable_cache(
  async (dateStr: string): Promise<[string, AgentAgg][]> => {
    const result = await fetchDayAggregate(dateStr, knownAgents);
    if (!result) {
      throw new Error(`MovePro dashcard: ${dateStr} could not be safely aggregated (see truncation-guard log above)`);
    }
    return [...result.entries()];
  },
  ["actions-day"],
  { revalidate: false },
);

async function getCachedDayAggregate(dateStr: string): Promise<Map<string, AgentAgg> | null> {
  try {
    return new Map(await getCachedDayEntries(dateStr));
  } catch (err) {
    console.error(`MovePro /actions: ${dateStr} could not be safely aggregated:`, err);
    return null;
  }
}

function sydneyDatesFromMonthStart(today: string): string[] {
  const zonedToday = toZonedTime(`${today}T00:00:00`, SYDNEY_TZ);
  const monthStart = format(zonedToday, "yyyy-MM-01", { timeZone: SYDNEY_TZ });
  const dates: string[] = [];
  let cursor = toZonedTime(`${monthStart}T00:00:00`, SYDNEY_TZ);
  const end = toZonedTime(`${today}T00:00:00`, SYDNEY_TZ);
  while (cursor <= end) {
    dates.push(format(cursor, "yyyy-MM-dd", { timeZone: SYDNEY_TZ }));
    cursor = addDays(cursor, 1);
  }
  return dates;
}

const RESPONSE_TTL_MS = 20000;
let responseCache: { at: number; data: ActionsResponseDTO } | null = null;

/** Assembled /api/actions payload: today's per-agent totals, and this
 * calendar month's (Sydney) per-agent totals built from a durably-cached
 * per-day sum. Coalesced behind a short in-memory cache so many polling tabs
 * don't each trigger a fresh month rebuild. Suspect days (truncation guard
 * couldn't safely disaggregate them) are excluded from the monthly total and
 * never cached, so they're retried on the next poll rather than permanently
 * undercounting the month. Day-level fetches are capped at
 * DASHCARD_CONCURRENCY in flight at once; a day that's already in the
 * durable cache resolves near-instantly (no real request), so the cap only
 * ever throttles genuine Metabase-bound calls, not cache hits. */
export async function getActionsSnapshot(): Promise<ActionsResponseDTO> {
  if (responseCache && Date.now() - responseCache.at < RESPONSE_TTL_MS) return responseCache.data;

  const today = sydneyToday();
  const monthDates = sydneyDatesFromMonthStart(today);
  const priorDates = monthDates.filter((d) => d !== today);
  const daysToFetch = [today, ...priorDates];

  const fetchOne = async (d: string): Promise<Map<string, AgentAgg> | null> => {
    // Today is never cached (it's still accumulating), so it's fetched fresh
    // via the same fetchDayAggregate that backs the durable cache for
    // completed days below.
    const result = d === today ? await fetchDayAggregate(d, knownAgents) : await getCachedDayAggregate(d);
    if (result) for (const k of result.keys()) knownAgents.add(k);
    return result;
  };

  const results = await mapWithConcurrency(daysToFetch, DASHCARD_CONCURRENCY, fetchOne);
  const dailyMap = results[0]!;

  const monthlyMap = new Map<string, AgentAgg>();
  for (const r of results) if (r) mergeAgg(monthlyMap, r);

  const data: ActionsResponseDTO = {
    updatedAt: new Date().toISOString(),
    daily: toDTO(dailyMap ?? new Map()),
    monthly: toDTO(monthlyMap),
  };
  responseCache = { at: Date.now(), data };
  return data;
}
