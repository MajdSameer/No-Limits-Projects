/** Short collision-safe ids for rows (UUID v4 entropy, compact form). */
export function newId(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 20);
}
