import { addDays } from "date-fns";
import { format, toZonedTime } from "date-fns-tz";

import { SYDNEY_TZ, sydneyToday } from "./sydney";

/**
 * /actions data source: MovePro's Metabase-embedded activity report (calls,
 * emails, messages per sales agent). Unrelated to packages/movepro (the quote
 * calculator's mock/live adapter for the marketing site, MOVEPRO_MODE/
 * MOVEPRO_API_KEY/MOVEPRO_BASE_URL) — this talks to a different MovePro API
 * (api.movepro.com.au + movepro.metabaseapp.com) using its own token,
 * MOVEPRO_TOKEN. Report/dashcard/card ids (17, 269, 628) are fixed — they
 * identify this specific saved report in MovePro, not something to configure.
 */

const REPORT_URL = "https://api.movepro.com.au/nolimitsremovalists/api/v1/reports/17";
const DASHCARD_URL = "https://movepro.metabaseapp.com/api/embed/dashboard";
const DASHCARD_ID = 269;
const CARD_ID = 628;

// A hung/unresponsive external request has no default Node timeout — without
// one, a single stuck fetch silently burns the entire route's maxDuration and
// the caller gets an opaque platform 504 with nothing logged. This bounds
// each request so a real failure surfaces fast, as a readable error.
const FETCH_TIMEOUT_MS = 8000;

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

function toDTO(byAgent: Map<string, AgentAgg>): ActionRowDTO[] {
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
    .sort((a, b) => b.total - a.total);
}

// ── JWT minting ──────────────────────────────────────────────────────────

let jwtCache: { token: string; at: number } | null = null;
const JWT_TTL_MS = 24 * 60 * 60 * 1000;

/** Recursively search a parsed JSON value for a Metabase embed JWT — either a
 * bare JWT string or one embedded in a "…/dashboard/<jwt>…" URL. Defensive
 * because the exact field name in MovePro's report-mint response is unknown
 * until the first real call in production (no token available to test with
 * here); logs the raw shape on failure so that can be diagnosed from there. */
function findJwtIn(value: unknown, depth = 0): string | null {
  if (depth > 6) return null;
  if (typeof value === "string") {
    const urlMatch = value.match(/\/dashboard\/([A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+)/);
    if (urlMatch) return urlMatch[1]!;
    if (/^[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+$/.test(value)) return value;
    return null;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findJwtIn(item, depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (value && typeof value === "object") {
    for (const v of Object.values(value)) {
      const found = findJwtIn(v, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

async function mintEmbedJwt(): Promise<string> {
  const token = process.env.MOVEPRO_TOKEN;
  if (!token) throw new Error("MOVEPRO_TOKEN is not set");

  const res = await fetch(REPORT_URL, {
    headers: { authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`MovePro report mint ${res.status}: ${await res.text()}`);
  }
  const body: unknown = await res.json();
  const jwt = findJwtIn(body);
  if (!jwt) {
    throw new Error(
      `MovePro report mint: no embed JWT found in response shape: ${JSON.stringify(body).slice(0, 500)}`,
    );
  }
  jwtCache = { token: jwt, at: Date.now() };
  return jwt;
}

async function getEmbedJwt(forceFresh = false): Promise<string> {
  if (!forceFresh && jwtCache && Date.now() - jwtCache.at < JWT_TTL_MS) return jwtCache.token;
  return mintEmbedJwt();
}

// ── Row fetch ────────────────────────────────────────────────────────────

function dashcardUrl(jwt: string, dateFilter: string, salesAgent?: string): string {
  const parameters = salesAgent ? { date: dateFilter, sales_agent: salesAgent } : { date: dateFilter };
  return `${DASHCARD_URL}/${jwt}/dashcard/${DASHCARD_ID}/card/${CARD_ID}?parameters=${encodeURIComponent(JSON.stringify(parameters))}`;
}

/** Fetches rows for one query, re-minting the JWT once and retrying on a
 * 401/400 (an expired or invalid embed JWT). */
export async function fetchActionRows(dateFilter: string, salesAgent?: string): Promise<ActionRow[]> {
  const jwt = await getEmbedJwt();
  const res = await fetch(dashcardUrl(jwt, dateFilter, salesAgent), {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (res.status === 401 || res.status === 400) {
    const freshJwt = await getEmbedJwt(true);
    const retryRes = await fetch(dashcardUrl(freshJwt, dateFilter, salesAgent), {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!retryRes.ok) {
      throw new Error(`MovePro dashcard fetch ${retryRes.status} (after JWT re-mint): ${await retryRes.text()}`);
    }
    return extractRows(await retryRes.json());
  }
  if (!res.ok) {
    throw new Error(`MovePro dashcard fetch ${res.status}: ${await res.text()}`);
  }
  return extractRows(await res.json());
}

function extractRows(body: unknown): ActionRow[] {
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

/** Completed days never change — cached forever for the life of this server
 * instance. Only today is re-fetched on every poll. */
const dayCache = new Map<string, Map<string, AgentAgg>>();

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

function agentKeys(maps: Iterable<Map<string, AgentAgg>>): Set<string> {
  const keys = new Set<string>();
  for (const m of maps) for (const k of m.keys()) keys.add(k);
  return keys;
}

/** Assembled /api/actions payload: today's per-agent totals, and this
 * calendar month's (Sydney) per-agent totals built from a day-cached sum.
 * Coalesced behind a short in-memory cache so many polling tabs don't each
 * trigger a fresh ~30-request month rebuild. Suspect days (truncation guard
 * couldn't safely disaggregate them) are excluded from the monthly total and
 * left uncached, so they're retried on the next poll rather than permanently
 * undercounting the month. */
export async function getActionsSnapshot(): Promise<ActionsResponseDTO> {
  if (responseCache && Date.now() - responseCache.at < RESPONSE_TTL_MS) return responseCache.data;

  const today = sydneyToday();

  // Known roster so far: every agent seen in already-cached prior days. Today's
  // own fetch below may grow this further for the prior-days fetch that follows.
  const known = agentKeys(dayCache.values());
  const dailyMap = await fetchDayAggregate(today, known);
  if (dailyMap) for (const k of dailyMap.keys()) known.add(k);

  const monthDates = sydneyDatesFromMonthStart(today);
  const priorDates = monthDates.filter((d) => d !== today);
  const uncached = priorDates.filter((d) => !dayCache.has(d));
  const fetched = await Promise.all(uncached.map((d) => fetchDayAggregate(d, known)));
  fetched.forEach((agg, i) => {
    if (agg) dayCache.set(uncached[i]!, agg);
  });

  const monthlyMap = new Map<string, AgentAgg>();
  for (const d of priorDates) {
    const agg = dayCache.get(d);
    if (agg) mergeAgg(monthlyMap, agg);
  }
  if (dailyMap) mergeAgg(monthlyMap, dailyMap);

  const data: ActionsResponseDTO = {
    updatedAt: new Date().toISOString(),
    daily: toDTO(dailyMap ?? new Map()),
    monthly: toDTO(monthlyMap),
  };
  responseCache = { at: Date.now(), data };
  return data;
}
