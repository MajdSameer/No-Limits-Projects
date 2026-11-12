/**
 * Ingest the EXTRA SERVICES booker's numbers (one person — Clara) pushed by the
 * Follow-Up sheet's Apps Script (see api/ingest/extra-services and
 * scripts/sheets/extra-services.gs). TODAY comes from the Leaderboard tab's
 * hand-kept entry block (job# + the sales rep each job is for); the MONTH total
 * from the "Extra Services Booked" tab. Like the inspectors, it's volatile floor
 * data, stored as one JSON blob in app_settings — no schema change — and the
 * daily count resets when the snapshot's asOfDate stops matching today.
 */
import { slug } from "../lib/slug";
import { sydneyToday } from "../lib/sydney";
import { schema, type Db } from "./client";

export const EXTRA_SERVICES_KEY = "extra_services_live";

export interface ExtraServicesIn {
  name?: string | null;
  jobs?: { code?: string | null; forRep?: string | null }[] | null;
  monthCount?: number | null;
  /** Today's target (the "/ 8" on the sheet card). */
  target?: number | null;
}

export interface ExtraServicesSnapshot {
  asOfDate: string;
  id: string;
  name: string;
  jobs: { code: string; forRep: string | null }[];
  monthCount: number;
  target: number | null;
}

function cleanStr(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

/** Overwrite the snapshot with this push. A job is dropped only if its code cell is blank. */
export async function ingestExtraServices(
  db: Db,
  body: ExtraServicesIn,
  asOfDate: string = sydneyToday(),
): Promise<{ asOfDate: string; name: string; jobs: number; monthCount: number }> {
  const name = cleanStr(body.name) ?? "Clara";
  const jobs: ExtraServicesSnapshot["jobs"] = [];
  for (const j of body.jobs ?? []) {
    const code = cleanStr(j?.code);
    if (code) jobs.push({ code, forRep: cleanStr(j?.forRep) });
  }
  const m = Number(body.monthCount);
  const t = Number(body.target);
  const snap: ExtraServicesSnapshot = {
    asOfDate,
    id: slug(name) || "clara",
    name,
    jobs,
    monthCount: Number.isFinite(m) && m > 0 ? Math.trunc(m) : 0,
    target: Number.isFinite(t) && t > 0 ? Math.trunc(t) : null,
  };
  const value = JSON.stringify(snap);
  await db
    .insert(schema.appSettings)
    .values({ key: EXTRA_SERVICES_KEY, value, updatedAt: new Date() })
    .onConflictDoUpdate({ target: schema.appSettings.key, set: { value, updatedAt: new Date() } });
  return { asOfDate, name, jobs: jobs.length, monthCount: snap.monthCount };
}
