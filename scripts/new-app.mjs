#!/usr/bin/env node
/**
 * Creates a new app from apps/_template.
 *
 *   pnpm new-app <name>        e.g. pnpm new-app quote-calculator
 *
 * Copies the template, renames the package to @nlr/<name>, and prints the
 * remaining manual steps. Full checklist: docs/NEW_PROJECT.md
 */
import { cpSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const name = process.argv[2];

if (!name || !/^[a-z][a-z0-9-]*[a-z0-9]$/.test(name)) {
  console.error("Usage: pnpm new-app <name>");
  console.error("  <name> must be kebab-case: lowercase letters, digits, hyphens (e.g. quote-calculator)");
  process.exit(1);
}

const src = path.join(repoRoot, "apps", "_template");
const dest = path.join(repoRoot, "apps", name);

if (existsSync(dest)) {
  console.error(`apps/${name} already exists — pick a different name or remove it first.`);
  process.exit(1);
}

cpSync(src, dest, {
  recursive: true,
  filter: (p) => !p.includes("node_modules") && !p.includes(`${path.sep}.next`),
});

const pkgPath = path.join(dest, "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
pkg.name = `@nlr/${name}`;
pkg.description = `TODO: one-line description of ${name}`;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");

const readmePath = path.join(dest, "README.md");
if (existsSync(readmePath)) {
  const readme = readFileSync(readmePath, "utf8");
  writeFileSync(readmePath, readme.replaceAll("_template", name).replaceAll("@nlr/template", `@nlr/${name}`));
}

console.log(`Created apps/${name}\n`);
console.log("Next steps:");
console.log("  1. pnpm install                          # link the new workspace package");
console.log(`  2. pnpm --filter @nlr/${name} dev        # run it locally`);
console.log(`  3. Edit apps/${name}/src/app/layout.tsx  # set the app's title + description`);
console.log(`  4. Edit apps/${name}/README.md           # describe what this app is for`);
console.log("\nFull idea-to-live checklist: docs/NEW_PROJECT.md");
