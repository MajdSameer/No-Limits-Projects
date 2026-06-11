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

## Placeholders & brand facts

`TODO.md` tracks every remaining placeholder (ABN, logo file, web font,
Movepro access). When you resolve one, update `TODO.md` in the same change.
Brand palette is REAL (quote email + website screenshot, Jun 2026): navy
`#182646` (brand-900) + CTA gold `#ffd42e` (accent-400) + pale highlight
`#fff389` (accent-200) — navy surfaces carry white text, yellow/gold always
carries dark text, buttons are pill-shaped. Tokens live in
`packages/config/tailwind/theme.css`; the synced inline copies are listed in
TODO.md. Company contact details in `brand.ts` are real — don't invent new
ones. Never commit the company's bank details (they appear in quote emails).
We do NOT control the company domain (`nolimitsremovalists.com.au`) or its
DNS — apps deploy to `*.vercel.app` URLs; never assume company subdomains.
