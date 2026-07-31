import { fetchWithJwtRetry, isExcludedName } from "./movepro-client";
import { parseActionAgentName } from "./movepro-actions";

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
 * board's non-rep exclusion list (movepro-client's isExcludedName), except
 * "Unassigned" is exempted here — it's a meaningful bucket of outstanding
 * contact on an unseen-communications queue, not noise, unlike on the
 * activity leaderboard where it's excluded. */
export function toUnseenDTO(rows: UnseenRow[]): UnseenRowDTO[] {
  return rows
    .filter((r) => r[0])
    .map((r) => ({
      name: parseActionAgentName(r[0]),
      totalUnseen: r[1] ?? 0,
      emailSms: r[2] ?? 0,
      callsCallbacks: r[3] ?? 0,
    }))
    .filter((r) => r.name.toLowerCase() === "unassigned" || !isExcludedName(r.name))
    .sort((a, b) => b.totalUnseen - a.totalUnseen);
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
