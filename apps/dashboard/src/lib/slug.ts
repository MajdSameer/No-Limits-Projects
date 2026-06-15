/** Rep id slug from a display name, e.g. "Issac" -> "issac". Matches staff.id. */
export function slug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
