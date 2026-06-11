# TODO — open questions & placeholders

Single source of truth for everything unconfirmed in this repo. When you
resolve an item: update the code/file it points at, then tick it off here in
the same PR. (Set up 11 Jun 2026; major brand update same day from the
company's real quote email + Google Business listing.)

## Branding

Palette is now REAL — navy `#182646` + highlight yellow `#fff389`, extracted
from the company's quote email (the live website blocks automated access).
Tokens: `packages/config/tailwind/theme.css`; synced inline copies:
`brandColors` in `packages/config/src/brand.ts`,
`apps/_template/src/app/global-error.tsx`, `apps/_template/src/app/icon.svg`.

- [x] ~~Brand colours~~ — done from quote email (navy/yellow). Optional
      refinement: a screenshot of the website to confirm web usage.
- [x] ~~Tagline~~ — "It takes a family to move a family." (their own email copy)
- [ ] **Logo files** (SVG/PNG) — the email's logo is on a Mailchimp CDN that
      403s us. Get the file from whoever runs the Mailchimp account, then
      replace the text lockup in `packages/ui/src/components/Logo.tsx` and the
      favicon at `apps/_template/src/app/icon.svg`
- [ ] **Brand web font** — email uses Arial; the website's font is unknown.
      Until confirmed we ship a system stack (`--font-sans` in `theme.css`)

## Company facts (`packages/config/src/brand.ts`)

- [x] ~~Phone~~ — 1300 609 117
- [x] ~~Email~~ — quote@nolimitsremovalists.com.au (their quotes inbox).
      Still: confirm preferred address for general enquiries.
- [x] ~~Legal entity name~~ — No Limits Removalists Pty Ltd (from their
      quote email's payment section)
- [x] ~~Depot address~~ — Unit 6/76 Hume Hwy, Lansvale NSW 2166 (Google listing)
- [ ] **ABN** (placeholder `00 000 000 000` — shows in footer)
- [ ] **Verify listing-sourced facts** before customer-facing use: founded
      2016, AFRA accredited, ~60 team members. (Fleet of 70 trucks and 5,000+
      five-star reviews are the company's own email claims; Google shows
      4.9★/5,130 reviews as of Jun 2026 — refresh counts before quoting.)
- [ ] **Social media links** (none recorded yet)

Deliberately NOT stored in this repo: the bank transfer details (BSB/account)
that appear in quote emails — payment-operations data doesn't belong in
web-tool config. Tools that need payments will integrate properly (e.g.
Movepro/Stripe), not hard-code an account number.

## Movepro — API access UNCONFIRMED

The adapter (`packages/movepro`) is mock-only by design. The mock's quote
SHAPE now mirrors real quotes (truck size, movers, hourly rate + GST, callout,
2-hour minimum, $200 refundable deposit) but its NUMBERS are placeholders.
Questions to put to Movepro (movepro.com) / our account manager:

- [ ] Is there a public/partner **REST API**? Auth method (API key, OAuth)?
- [ ] Are there **webhooks** (new booking, lead status change)?
- [ ] Can we **push leads** in from our own forms? Required fields?
- [ ] Can we **read quotes/bookings/schedule** out (for dashboards)?
- [ ] Rate limits, sandbox/test environment, docs URL?
- [ ] Real rate card (hourly rates by crew/truck, callout rules) if we're to
      show indicative pricing anywhere

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
