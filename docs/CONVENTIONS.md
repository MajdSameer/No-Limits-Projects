# Conventions

The rules every project in this repo follows. They exist so that any
collaborator — human or Claude, with zero prior context — can open any app and
know exactly how it works.

## Environment variables

- Every app has a committed `.env.example` documenting **every** var it reads,
  with safe example values. Add the var there in the same PR that introduces it.
- Real values: local development uses `.env` (gitignored); deployed apps use
  **Vercel env vars only**. Secrets are never committed, ever.
- `NEXT_PUBLIC_*` is sent to the browser — never put secrets in one.

## Git

- `main` is **always deployable**. CI runs `pnpm check` (lint + typecheck +
  build) on every push and PR; don't merge red.
- Commit messages: imperative mood with a type prefix —
  `feat: add quote calculator form`, `fix: correct GST rounding`,
  `docs: update Vercel steps`, `chore: bump deps`.
- Branch names: `feature/<slug>`, `fix/<slug>` (Claude Code sessions use their
  generated `claude/...` branches).
- Keep commits focused; explain *why* in the body when it isn't obvious.

## Apps

- Every app starts from `apps/_template` via `pnpm new-app <name>` — never from
  scratch. The template carries branding, error boundaries, a 404 page, SEO
  metadata and responsive layout; starting fresh silently loses those.
- App names: kebab-case folder (`quote-calculator`), package `@nlr/<name>`.
- If you build something every future app should have, put it in the template
  or a shared package, not your app.

## Shared packages

- `@nlr/config` — design tokens (`tailwind/theme.css`), company constants
  (`brand.ts`), ESLint/TS configs. The single source of truth for brand and
  company facts.
- `@nlr/ui` — shared components. Apps may have local components; promote them
  to `@nlr/ui` once a second app wants them.
- `@nlr/movepro` — ALL Movepro interaction goes through this adapter. App code
  never talks to the CRM directly and never imports a concrete client class —
  only `createMoveproClient()`.

## Accessibility & mobile (non-negotiable)

The company's customers are mostly on phones. Every page, every time:

- Design mobile-first; verify at 360px width before calling anything done.
- Touch targets ≥ 44px (the `@nlr/ui` components already comply).
- Real `<label>`s on every form control — use `TextField`/`SelectField`/
  `TextAreaField` from `@nlr/ui`, which wire `aria-describedby`/`aria-invalid`.
- Visible focus states; never remove outlines without replacing them.
- One `<h1>` per page, headings in order, `<main id="main">` present (the
  skip link in the layout points at it).
- Text contrast ≥ 4.5:1 — stick to the token palette and you're fine.
- Phone numbers are always `tel:` links.

## Code style

- TypeScript strict mode; no `any` unless there's a comment justifying it.
- Server Components by default; add `"use client"` only where interaction
  needs it.
- Styling via Tailwind utilities + brand tokens. No hard-coded hex values, no
  separate CSS files per component.
- Formatting/linting: `pnpm lint` from the root. Fix warnings, don't silence
  them.

## Documentation upkeep

- Resolved a placeholder or an open question? Update `TODO.md` in the same PR.
- New app? Give it a real `README.md` (the copied template one is a stub).
- Changed a convention? Change this file — stale rules are worse than none.
