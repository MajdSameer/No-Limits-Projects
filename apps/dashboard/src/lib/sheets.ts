/**
 * Read-only access to the company's source-of-truth Google Sheets, used to
 * sync the floor roster into the database (see db/sync-from-sheet.ts).
 *
 * Auth: a Google **user** OAuth refresh token, supplied via env as one JSON
 * blob. A service account would be tidier, but the company Google org enforces
 * `iam.managed.disableServiceAccountApiKeyCreation`, so service-account keys
 * can't be issued (see TODO.md). Credentials are never committed — local dev
 * reads them from `.env`, deployments from Vercel env vars.
 */
import { OAuth2Client } from "google-auth-library";

/** A rep decoded from the "Leaderboard" tab. */
export interface SheetRep {
  /** slug id, e.g. "andy" — matches `staff.id`. */
  id: string;
  name: string;
  /** Lead intake weight (Leaderboard col A), kept as a string for `numeric`. */
  intakeWeight: string;
  /** Daily booking goal (Leaderboard col C). */
  dailyTarget: number;
}

interface AuthorizedUser {
  client_id: string;
  client_secret: string;
  refresh_token: string;
}

function loadAuthorizedUser(): AuthorizedUser {
  const raw = process.env.GOOGLE_SHEETS_TOKEN_JSON;
  if (!raw) {
    throw new Error(
      "GOOGLE_SHEETS_TOKEN_JSON is not set — it must hold the authorized-user " +
        "OAuth JSON (client_id, client_secret, refresh_token). See .env.example.",
    );
  }
  let parsed: Partial<AuthorizedUser>;
  try {
    parsed = JSON.parse(raw) as Partial<AuthorizedUser>;
  } catch {
    throw new Error("GOOGLE_SHEETS_TOKEN_JSON is not valid JSON.");
  }
  if (!parsed.client_id || !parsed.client_secret || !parsed.refresh_token) {
    throw new Error(
      "GOOGLE_SHEETS_TOKEN_JSON is missing client_id, client_secret or refresh_token.",
    );
  }
  return parsed as AuthorizedUser;
}

async function readRange(spreadsheetId: string, range: string): Promise<unknown[][]> {
  const { client_id, client_secret, refresh_token } = loadAuthorizedUser();
  const auth = new OAuth2Client({ clientId: client_id, clientSecret: client_secret });
  auth.setCredentials({ refresh_token });

  const { token } = await auth.getAccessToken();
  if (!token) {
    throw new Error(
      "Could not obtain a Google access token. The OAuth app is in Testing mode, " +
        "so the refresh token expires ~7 days after it was minted — re-auth if so (TODO.md).",
    );
  }

  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}` +
    `/values/${encodeURIComponent(range)}?valueRenderOption=UNFORMATTED_VALUE`;
  const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
  if (!res.ok) {
    throw new Error(`Google Sheets API ${res.status}: ${await res.text()}`);
  }
  const body = (await res.json()) as { values?: unknown[][] };
  return body.values ?? [];
}

function slug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Reps from the "Leaderboard" tab: col A = lead intake weight, col B = name,
 * col C = daily goal. Rows without a numeric weight and a name are skipped —
 * that filters out spacer rows, the header and the live-clock block lower in
 * the sheet, so the read range can stay loose.
 */
export async function readLeaderboardReps(): Promise<SheetRep[]> {
  const spreadsheetId = process.env.NLR_LEADERBOARD_SPREADSHEET_ID;
  if (!spreadsheetId) {
    throw new Error("NLR_LEADERBOARD_SPREADSHEET_ID is not set. See .env.example.");
  }
  const range = process.env.NLR_LEADERBOARD_RANGE ?? "Leaderboard!A5:C40";
  const rows = await readRange(spreadsheetId, range);

  const reps: SheetRep[] = [];
  for (const row of rows) {
    const name = String(row[1] ?? "").trim();
    const rawWeight = String(row[0] ?? "").trim();
    // A real rep row has a name AND a positive intake weight. This skips the
    // header ("Name"), spacer rows and the live-clock/bookings blocks lower in
    // the sheet, whose col A is blank or non-numeric (Number("") would be 0).
    if (!name || rawWeight === "") continue;
    const weight = Number(rawWeight);
    if (!Number.isFinite(weight) || weight <= 0) continue;
    reps.push({
      id: slug(name),
      name,
      intakeWeight: String(weight),
      dailyTarget: Math.round(Number(row[2]) || 0),
    });
  }
  return reps;
}
