# CLAUDE.md — No Limits Projects

Monorepo of web tools for No Limits Removalists (Sydney moving company).
pnpm workspaces · Next.js App Router · TypeScript strict · Tailwind v4 · Vercel.

## Commands

```bash
pnpm install
pnpm dev                      # runs apps/_template locally
pnpm check                    # lint + typecheck + build EVERYTHING — must pass before commit
pnpm new-app <kebab-name>     # scaffold a new app from apps/_template
pnpm --filter @nlr/<app> dev  # run one app
```

## Map

- `apps/_template` — canonical app starter. Never build features here; copy it.
  Template improvements (better 404, new meta) DO go here.
- `packages/config` — brand tokens (`tailwind/theme.css`), company constants
  (`src/brand.ts`), shared ESLint/TS configs. Single source of truth for brand.
- `packages/ui` — shared components. Accessible + mobile-first by contract.
- `packages/movepro` — Movepro CRM adapter. **Mock-only: API access
  unconfirmed.** Apps call `createMoveproClient()`, never concrete classes.
- `docs/CONVENTIONS.md` — the rules. `docs/NEW_PROJECT.md` — idea→live checklist.

## Invariants (don't break these)

1. `main` is always deployable; `pnpm check` green before any commit lands.
2. No hard-coded brand hex values or company facts in apps — import from
   `@nlr/config`. (Known exceptions, kept in sync by hand: `global-error.tsx`
   inline styles, `icon.svg`.)
3. Secrets only in Vercel env vars / local `.env`; every var documented in the
   app's committed `.env.example`.
4. Accessibility & mobile usability are non-negotiable (touch targets ≥ 44px,
   labelled forms, visible focus, works at 360px wide).
5. Workspace packages export TS source directly; apps must list them in
   `transpilePackages` (template already does).

## Placeholders

`TODO.md` tracks every placeholder (brand palette, phone/ABN, Movepro access).
When you resolve one, update `TODO.md` in the same change. Brand palette is a
placeholder (navy/orange) because the live site 403s automated access — if the
user provides real colours or a screenshot, update
`packages/config/tailwind/theme.css` + the synced spots listed in TODO.md.
We do NOT control the company domain (`nolimitsremovalists.com.au`) or its
DNS — apps deploy to `*.vercel.app` URLs; never assume company subdomains.
