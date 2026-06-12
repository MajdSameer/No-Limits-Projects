# Quote-to-MovePro pipeline — design

**Date:** 2026-06-12 · **Status:** Approved (design review with Majd, this session)
**Goal:** Maximise sales by fixing the two diagnosed pricing failures — quotes
inconsistent between reps, and quotes too slow to reach customers — with an
instant, accurate website quote that lands in MovePro as a ready-to-close lead.

## Problem

Price is the recurring sales issue, in two specific ways (confirmed):

1. **Inconsistent between reps** — the rate card lives in a spreadsheet and is
   applied unevenly; the price a customer gets depends on who answers.
2. **Too slow** — by the time a rep calls back with a number, the customer has
   often booked a competitor.

Sales reps work inside MovePro all day. MovePro access today is day-to-day
logins only: **no confirmed API, no account-manager contact** (discovery task
below). The repo already anticipates this: `packages/movepro` is a mock-only
adapter with domain types (`Lead`, `QuoteRequest`, …) and an empty `live.ts`.

## Decisions made in design review

- Website scope: **instant quote + lead capture; the rep closes by phone.**
  Online deposit payment is explicitly out of scope, but nothing in the flow
  may preclude adding it later.
- Rate truth: the company spreadsheet becomes a **codified, versioned rate
  engine** — the single source of price for the website and (eventually) reps.
- Lead delivery: **best-available transport** with graceful degradation,
  because MovePro's ingestion capabilities are unconfirmed.
- Reps are reached **through MovePro itself** (that's where they live);
  notifications are secondary.

## Architecture

Four units, each independently testable:

### 1. `packages/pricing` — the rate engine (new workspace package)

- `rates.ts`: the transcribed rate card. Per truck size: hourly rate by crew
  count; callout fee by distance band; 2-hour minimum; GST treatment; $200
  refundable deposit constant. The table carries `version` (e.g. `2026-06-A`)
  and `effectiveFrom`. **Transcribing the real spreadsheet is a launch
  blocker for real-price mode**; until then the package exports clearly
  flagged placeholder rates (`placeholder: true`).
- `zones.ts`: Sydney-metro zone table + named corridors (Sydney↔Newcastle,
  ↔Wollongong, ↔Canberra, ↔Melbourne, ↔Brisbane, …) mapping suburb pairs to
  distance bands. Unmapped pairs return the widest matching band plus a
  `distanceUnverified` flag (the lead is marked "rep confirms distance").
- `quote.ts`: pure function `buildQuote(input): QuoteBreakdown` —
  `{ truck, crew, hourlyRate, estimatedHours: [min,max], callout, totalRange
  exGst/incGst, deposit, rateVersion, flags }`. No I/O, no dates from clock —
  caller passes "now" — fully deterministic and unit-testable.
- Tests: exhaustive unit tests per band/size + **golden tests pinned to real
  numbers from past company quote emails** once the spreadsheet lands.
- Rate updates = edit `rates.ts` in a PR (CODEOWNERS: pricing owner). Site and
  all tools update together; old quotes keep their recorded `rateVersion`.

### 2. `apps/quote` — the quote funnel (new app, scaffolded from `_template`)

This is the company's **first production project** (TODO.md). The template's
QuoteCard pattern, grown up:

- Flow: size → from/to suburbs → move date → **instant price breakdown**
  (range, crew/truck, what's included, deposit) → name + phone (email
  optional) → submitted.
- Every accepted quote gets a human reference (`NLR-YYMMDD-NNN`) shown to the
  customer and attached to the lead — customer, rep and MovePro all reference
  the same number and `rateVersion`.
- Post-submit screen sets the expectation: price is locked, a rep calls back
  (business-hours promise worded by the company).
- No "Demo pricing" badge when the engine is in real-rates mode.
- Accessibility/mobile per repo invariants; the existing motion system applies.

### 3. `packages/movepro` — lead dispatch (extend existing adapter)

New `submitLead(lead: LeadInput, quote: QuoteBreakdown): Promise<DispatchResult>`
behind the existing `createMoveproClient()` factory. Transport chain, selected
by env config, tried in order:

1. **`api`** — implemented in `live.ts` the day MovePro confirms an API.
2. **`email`** — a lead email that is both human-readable and trivially
   parseable (labelled key/value block), sent via a mail provider (Resend;
   new dependency, env-documented) to `MOVEPRO_LEAD_EMAIL` — MovePro's
   lead-import address if discovery finds one, else the sales inbox
   (60-second manual entry, still one source of truth for the price).
3. **`log`** — dev/test no-op.

**Persistence-first invariant:** the lead is written to our own datastore
(Vercel Postgres) with status (`received → dispatched | dispatch-failed`)
*before* any transport runs; failed dispatches are retried (max 3, backoff)
and surfaced in the dashboard. A lead can never be lost.

### 4. `/admin/leads` — safety-net dashboard (inside `apps/quote`)

Password-protected (env-var basic auth) plain table: timestamp, reference,
customer, route, quoted range, rate version, dispatch status, retry button,
CSV export. Audit trail + worst-case workflow. Not a product.

## Data flow

```
visitor → apps/quote funnel
  → packages/pricing buildQuote()        (instant, in-request)
  → show price + capture contact
  → POST: persist lead (Postgres)        (never lost)
  → movepro.submitLead()                 (api → email → fail-marked)
  → MovePro file with quote attached     (rep closes)
  → /admin/leads shows status            (audit/retry)
```

## Error handling

- Pricing: unmapped suburb pair → widest band + `distanceUnverified` flag,
  never an error page; engine failures fall back to "we'll call you with a
  price" capture (lead still saved, flagged `unpriced`).
- Dispatch: transport failure → status `dispatch-failed`, retried, visible in
  dashboard; customer experience unaffected (their quote already rendered).
- Spam/abuse: honeypot field + per-IP rate limit on submit.

## Testing

- `packages/pricing`: unit + golden tests (the contract for "correct pricing").
- `packages/movepro`: transport selection, email formatting snapshot,
  persistence-first ordering, retry logic — all against fakes.
- `apps/quote`: Playwright flow test (size→price→submit→confirmation) in mock
  mode; `pnpm check` green as always.

## Rollout

1. **Phase 1 (build now):** pricing engine (placeholder rates) + funnel +
   email transport + dashboard. Swap in real rates when the spreadsheet lands;
   flip `MOVEPRO_LEAD_EMAIL` to the best address discovery finds.
2. **Phase 2:** API transport in `live.ts` when MovePro confirms; mirror the
   rate card into MovePro's own settings so its documents agree with the site.
3. **Later (explicitly out of scope):** online deposit via Stripe; rep-facing
   quote calculator; inventory/volume capture.

## Dependencies on the company (not code)

- [ ] **The rate spreadsheet** → transcribed into `rates.ts` (launch blocker
      for real prices).
- [ ] **MovePro discovery (~30 min):** Settings → Integrations / API / Lead
      sources / email lead import; send MovePro support the question list in
      TODO.md. Outcome = transport config.
- [ ] Business-hours callback promise wording.
- [ ] Confirm the quotes inbox is watched (fallback transport target).

## Success criteria

- Price on screen in < 5 s from landing; identical for identical inputs.
- 100% of submitted leads persisted; ≥95% auto-dispatched without manual touch.
- Zero variance between website price and rep-quoted price for the same job.
- Lead volume and dispatch health visible in `/admin/leads`.

## Risks

- **Spreadsheet stale/wrong** → golden tests against real quote emails,
  version stamps, named rate owner.
- **MovePro has no ingestion at all** → email-to-sales-inbox keeps the flow
  alive (price still consistent and instant); dashboard guarantees nothing
  is lost.
- **Distance banding accuracy** → zone table + `distanceUnverified` flag puts
  a human check exactly where automation is weakest.
