import { fetchWithJwtRetry, isExcludedName } from "./movepro-client";
import { canonicalAgentName, parseActionAgentName } from "./movepro-actions";

/**
 * /actions VIEW 2 data source: MovePro's Metabase-embedded "unseen
 * communications" report (report 9) — a question embed (not a dashboard,
 * unlike report 17), returning one current-snapshot row per rep. No
 * aggregation across days/orders needed: sort and display as-is.
 */

const REPORT_URL = "https://api.movepro.com.au/nolimitsremovalists/api/v1/reports/9";
const QUERY_URL = "https://movepro.metabaseapp.com/api/embed/card";
const JWT_CACHE_KEY = "unseen";

export interface UnseenRowDTO {
  name: string;
  totalUnseen: number;
  emailSms: number;
  callsCallbacks: number;
}

export interface UnseenResponseDTO {
  updatedAt: string;
  rows: UnseenRowDTO[];
}

/** Row shape from the report: [user, total_unseen, unseen_email_sms, unseen_calls_callbacks]. */
export type UnseenRow = [string, number | null, number | null, number | null];

export function cardQueryUrl(jwt: string): string {
  return `${QUERY_URL}/${jwt}/query`;
}

/** Verified card-query response shape: { data: { cols, rows } }. */
export function extractUnseenRows(body: unknown): UnseenRow[] {
  const rows = (body as { data?: { rows?: unknown } })?.data?.rows;
  if (!Array.isArray(rows)) {
    throw new Error(`MovePro unseen query: unexpected response shape: ${JSON.stringify(body).slice(0, 500)}`);
  }
  return rows as UnseenRow[];
}

/** Same display-name normalisation as the activity board — "Unassigned" has
 * no NoLimits suffix and is a single word, so parseActionAgentName already
 * returns it unchanged; no special-casing needed. Shares the activity
 * board's non-rep exclusion list (movepro-client's isExcludedName) with no
 * exemptions — "Unassigned" was kept here initially since it read as a
 * meaningful bucket, but it's excluded like everything else in that list now. */
export function toUnseenDTO(rows: UnseenRow[]): UnseenRowDTO[] {
  // Merge by canonical name, exactly like the activity boards (toDTO): several
  // MovePro accounts can parse to one person (six "Hadeel"s) and were each shown
  // — and, being keyed by name in the UI, rendered as duplicate React keys.
  const merged = new Map<string, UnseenRowDTO>();
  for (const r of rows) {
    if (!r[0]) continue;
    const name = canonicalAgentName(parseActionAgentName(r[0]));
    if (isExcludedName(name)) continue;
    const row = merged.get(name) ?? { name, totalUnseen: 0, emailSms: 0, callsCallbacks: 0 };
    row.totalUnseen += r[1] ?? 0;
    row.emailSms += r[2] ?? 0;
    row.callsCallbacks += r[3] ?? 0;
    merged.set(name, row);
  }
  return [...merged.values()].sort((a, b) => b.totalUnseen - a.totalUnseen);
}

async function fetchUnseenRows(): Promise<UnseenRow[]> {
  const res = await fetchWithJwtRetry(REPORT_URL, JWT_CACHE_KEY, cardQueryUrl, { accept: "application/json" });
  if (!res.ok) {
    throw new Error(`MovePro unseen query ${res.status}: ${await res.text()}`);
  }
  return extractUnseenRows(await res.json());
}

const RESPONSE_TTL_MS = 25000;
let responseCache: { at: number; data: UnseenResponseDTO } | null = null;

/** Assembled /api/unseen payload. No day-by-day assembly needed (unlike
 * getActionsSnapshot) — report 9 already returns one current row per rep, so
 * this is a single query behind a short in-memory cache so polling tabs
 * don't each trigger a fresh one. */
export async function getUnseenSnapshot(): Promise<UnseenResponseDTO> {
  if (responseCache && Date.now() - responseCache.at < RESPONSE_TTL_MS) return responseCache.data;
  const rows = await fetchUnseenRows();
  const data: UnseenResponseDTO = { updatedAt: new Date().toISOString(), rows: toUnseenDTO(rows) };
  responseCache = { at: Date.now(), data };
  return data;
}

/** Keeps the unseen board on the SAME people as the Today / This month boards: only
 * the roster (active reps, minus excluded names), with a zero row for a rostered rep
 * who has nothing unseen. Mirrors alignRoster in movepro-actions. */
export function alignUnseenRoster(rows: UnseenRowDTO[], roster: string[]): UnseenRowDTO[] {
  const want = new Map<string, string>();
  for (const r of roster) {
    const name = canonicalAgentName(r);
    if (name && !isExcludedName(name)) want.set(name.toLowerCase(), name);
  }
  const out = rows.filter((r) => want.has(r.name.toLowerCase()));
  const have = new Set(out.map((r) => r.name.toLowerCase()));
  for (const [key, name] of want) {
    if (!have.has(key)) out.push({ name, totalUnseen: 0, emailSms: 0, callsCallbacks: 0 });
  }
  return out.sort((a, b) => b.totalUnseen - a.totalUnseen || a.name.localeCompare(b.name));
}
