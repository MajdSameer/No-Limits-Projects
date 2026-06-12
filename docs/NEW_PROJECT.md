# New project: idea → live

The checklist for taking a project from "the company wants X" to a live,
bug-free URL. Steps 1–2 take about five minutes.

## 1. Create the app from the template

```bash
git checkout main && git pull
git checkout -b feature/<app-name>
pnpm new-app <app-name>        # kebab-case, e.g. quote-calculator
pnpm install
pnpm --filter @nlr/<app-name> dev
```

You now have a branded, deployable app at `http://localhost:3000`.

## 2. Make it yours

- [ ] `src/app/layout.tsx` — set the real `title` and `description`
- [ ] `src/app/page.tsx` — delete the demo homepage (also remove
      `QuoteCard.tsx`, `actions.ts`, `quote-options.ts` unless your app uses
      the quote-form pattern — it's reference code for the Movepro adapter)
- [ ] `package.json` — write a one-line `description`
- [ ] `README.md` — what is this app, who asked for it, what does "done" mean?
- [ ] `.env.example` — add/remove vars to match what the app actually reads

## 3. Build

Work in small commits on your feature branch. While building:

- Use `@nlr/ui` components and brand tokens (see
  [CONVENTIONS.md](CONVENTIONS.md) — especially the accessibility rules).
- Movepro data goes through `createMoveproClient()` from `@nlr/movepro`.
  It's mock data until API access is confirmed — show `client.mode` somewhere
  visible in internal tools so nobody mistakes mock for real.
- Keep `pnpm check` green as you go, not just at the end.

## 4. Quality gates (before deploying)

- [ ] `pnpm check` passes from the repo root
- [ ] Manual pass on a phone-sized viewport (~360px): nothing overflows,
      everything tappable
- [ ] Keyboard-only pass: tab through every interactive element, focus always
      visible, skip link works
- [ ] Forms: try to submit garbage — errors are announced and readable
- [ ] Visit a junk URL → branded 404 renders
- [ ] Lighthouse (mobile) in Chrome DevTools: accessibility ≥ 95, no obvious
      performance disasters

## 5. Deploy to Vercel

1. Vercel → **Add New… → Project** → import this repo.
2. **Root Directory** → `apps/<app-name>`. Everything else stays default.
3. Add env vars from `.env.example` (set `NEXT_PUBLIC_SITE_URL` to the real URL
   per environment).
4. Deploy → check the preview URL on your actual phone.
5. Merge the PR into `main` → production deploys automatically.
6. Domain: apps ship on their Vercel URL (`<project>.vercel.app`) — we don't
   control the company domain's DNS, so its subdomains aren't available
   (see TODO.md). When a domain is sorted: Vercel project → Settings → Domains.

## 6. Hand over

- [ ] Send the live URL to the company with a 2–3 sentence "what it does and
      what it doesn't do yet"
- [ ] Note any follow-ups or open questions in `TODO.md`
- [ ] If the app taught the template something (better pattern, missing
      component), backport it to `apps/_template` or `packages/ui`
