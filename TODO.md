# TODO — open questions & placeholders

Single source of truth for everything unconfirmed in this repo. When you
resolve an item: update the code/file it points at, then tick it off here in
the same PR. (Set up on 11 Jun 2026; placeholder choices explained below.)

## Branding — placeholder, swap when real values arrive

The live site (nolimitsremovalists.com.au) blocks automated access (HTTP 403),
so the brand could not be extracted automatically. Current palette is a
professional placeholder: deep navy ("brand") + orange ("accent").

To fix all of it: paste the real hex codes / font names — or a screenshot of
the website — into a Claude session and ask it to update the tokens.

- [ ] **Brand colours** → `packages/config/tailwind/theme.css` (and the two
      mirrored hex values in `packages/config/src/brand.ts` + the inline ones in
      `apps/_template/src/app/global-error.tsx` and `icon.svg`)
- [ ] **Brand font** → `--font-sans` / `--font-display` in `theme.css` (load
      via `next/font` in the app layout if it's a webfont)
- [ ] **Logo files** (SVG ideally) → replace text lockup in
      `packages/ui/src/components/Logo.tsx` and favicon at
      `apps/_template/src/app/icon.svg`
- [ ] **Tagline** → `company.tagline` in `packages/config/src/brand.ts`
      (current one is invented)

## Company facts — placeholders in `packages/config/src/brand.ts`

- [ ] **Phone number** (placeholder `(02) 5555 0000` — shows in header/footer!)
- [ ] **Contact email** (guessed `info@nolimitsremovalists.com.au`)
- [ ] **ABN** (placeholder `00 000 000 000` — shows in footer)
- [ ] **Legal entity name** (guessed "No Limits Removalists Pty Ltd")
- [ ] **Depot suburb** (currently just "Sydney")
- [ ] **Verify marketing facts** before customer-facing use: founded 2016,
      AFRA accredited, 24 trucks, 60+ team members (sourced from public
      listings, not confirmed by the company)
- [ ] **Social media links** (none recorded yet)

## Movepro — API access UNCONFIRMED

The adapter (`packages/movepro`) is mock-only by design. Questions to put to
Movepro (movepro.com) / our account manager:

- [ ] Is there a public/partner **REST API**? Auth method (API key, OAuth)?
- [ ] Are there **webhooks** (new booking, lead status change)?
- [ ] Can we **push leads** in from our own forms? Required fields?
- [ ] Can we **read quotes/bookings/schedule** out (for dashboards)?
- [ ] Rate limits, sandbox/test environment, docs URL?

When answered: implement `packages/movepro/src/live.ts`, then set
`MOVEPRO_MODE=live` + `MOVEPRO_API_KEY` in Vercel env vars per app.

## Infrastructure

- [ ] **Hosting domain**: we do NOT own/control `nolimitsremovalists.com.au`
      (the website and its DNS are managed externally — confirmed 11 Jun 2026),
      so our tools can't live on its subdomains for now. Apps ship on
      `<project>.vercel.app` URLs. When a proper domain is wanted, either get
      DNS access from whoever manages the main site, or register a separate
      domain for tools and add it in Vercel → Settings → Domains.
- [ ] **Vercel account/team**: create (or share access to) the team that owns
      these deployments
- [ ] **GitHub repo access** for whoever else needs it
- [ ] **Analytics choice** (Vercel Analytics? GA4? none yet) — add to template
      once decided
- [ ] **Error reporting** (Sentry? none yet) — `error.tsx` has the hook point

## First project

- [ ] The company hasn't picked the first project yet. When they do: follow
      `docs/NEW_PROJECT.md`.
