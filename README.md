# No Limits Projects

Monorepo for every web tool we build for **No Limits Removalists** — quote
calculators, booking tools, internal dashboards, landing pages. One foundation,
many small apps, each independently deployable to Vercel.

> New here (human or Claude)? This README + [`TODO.md`](TODO.md) +
> [`docs/`](docs/) are enough context to start working. Keep them true.

## Layout

```
apps/
  _template/        ← canonical starting point for every new app (deployable as-is)
packages/
  config/           ← brand design tokens, company constants, ESLint/TS/Tailwind config
  ui/               ← shared branded components (header, footer, forms, buttons)
  movepro/          ← typed Movepro CRM adapter — MOCK ONLY until API access confirmed
docs/
  NEW_PROJECT.md    ← idea → live checklist
  CONVENTIONS.md    ← the rules everything follows
scripts/new-app.mjs ← copies the template into apps/<name>
TODO.md             ← every open question and placeholder, in one place
```

**Stack:** Next.js (App Router) · TypeScript (strict) · Tailwind CSS v4 ·
pnpm workspaces · Vercel.

## Quick start

```bash
corepack enable     # once per machine — provides pnpm (Node >= 22 required)
pnpm install
pnpm dev            # runs apps/_template on http://localhost:3000
pnpm check          # lint + typecheck + build everything (must pass before merging)
```

## Create a new project

```bash
pnpm new-app quote-calculator
```

…then follow [docs/NEW_PROJECT.md](docs/NEW_PROJECT.md) — it's the full
idea-to-live checklist (~5 minutes to a running app).

## Deploy an app to Vercel

Each app is its own Vercel project pointing at this repo:

1. Vercel → **Add New… → Project** → import `No-Limits-Projects`.
2. **Root Directory** → `apps/<your-app>` (this is the key monorepo setting).
3. Framework preset auto-detects Next.js; leave build/install commands default
   (Vercel detects pnpm workspaces and installs from the repo root).
4. Add the env vars from the app's `.env.example` under **Settings → Environment
   Variables**. Secrets live only here — never in git.
5. Deploy. `main` deploys to production; every PR gets a preview URL.

## The rules (short version)

- `main` is **always deployable** — `pnpm check` must pass (CI enforces it).
- Every app starts from `apps/_template`. Improvements that every app should
  have go into the template or the shared packages, not into one app.
- Brand colours/fonts live in `packages/config` design tokens. Company facts
  (phone, ABN, tagline) live in `packages/config/src/brand.ts`. Never hard-code
  either in an app.
- Movepro integration goes through `@nlr/movepro` only. It's mocked until API
  access is confirmed — see [TODO.md](TODO.md).
- Accessibility and mobile usability are non-negotiable: our customers are
  mostly on phones.

Full versions: [docs/CONVENTIONS.md](docs/CONVENTIONS.md).
