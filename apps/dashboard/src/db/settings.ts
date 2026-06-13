import { eq } from "drizzle-orm";

import { getDb, schema } from "./client";

/** Read an app setting, or a fallback when unset. */
export async function getSetting(key: string, fallback = ""): Promise<string> {
  const db = await getDb();
  const [row] = await db.select().from(schema.appSettings).where(eq(schema.appSettings.key, key));
  return row?.value ?? fallback;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db
    .insert(schema.appSettings)
    .values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({ target: schema.appSettings.key, set: { value, updatedAt: new Date() } });
}

export async function isGameDay(): Promise<boolean> {
  return (await getSetting("game_day", "off")) === "on";
}
