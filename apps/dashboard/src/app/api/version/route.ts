import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Public by design (no secrets — just Vercel's own deployment id). Wall
 * displays (/live etc.) sit open in a browser tab for days; only a real page
 * reload picks up newly-deployed JS, but nothing was ever forcing one, so a
 * merged fix could sit deployed for a long time without reaching the actual
 * screen. LiveRefresher polls this and reloads the tab when it changes.
 */
export async function GET() {
  return NextResponse.json(
    { deploymentId: process.env.VERCEL_DEPLOYMENT_ID ?? process.env.VERCEL_GIT_COMMIT_SHA ?? null },
    { headers: { "cache-control": "no-store" } },
  );
}
