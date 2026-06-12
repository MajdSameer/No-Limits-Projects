# Quote-to-MovePro pipeline — design

**Date:** 2026-06-12 · **Status:** Approved design; pricing model decoded from
the company's live sheet (same day)
**Goal:** Maximise sales by fixing the two diagnosed pricing failures — quotes
inconsistent between reps, and quotes too slow to reach customers — with an
instant, accurate website quote that lands in MovePro as a ready-to-close lead.

## Problem

Price is the recurring sales issue, in two specific ways (confirmed):

1. **Inconsistent between reps** — pricing lives in a Google Sheet
   ("Pricing", ID `1hjaKdiXpSW68tFDTPBTjWvjB4mzWV441SGloXMYz-nU`) with **one
   hand-copied calculator tab per rep** (~22 tabs). Same formulas today;
   nothing stops drift, mistyped km, or a stale tab tomorrow.
2. **Too slow** — by the time a rep calls back with a number, the customer has
   often booked a competitor.

Sales reps work inside MovePro all day. MovePro access today is day-to-day
logins only: **no confirmed API, no account-manager contact** (discovery task
below). The repo already anticipates this: `packages/movepro` is a mock-only
adapter with domain types (`Lead`, `QuoteRequest`, …) and an empty `live.ts`.

## Decisions made in design review

- Website scope: **instant quote + lead capture; the rep closes by phone.**
  Online deposit payment is out of scope; nothing may preclude adding it later.
- Rate truth: the Pricing sheet is **codified into a versioned rate engine** —
  the single source of price for the website and (eventually) reps.
- Lead delivery: **best-available transport** with graceful degradation.
- Reps are reached **through MovePro itself**; notifications secondary.
- **Website quotes use the "Leads" rate channel** (most competitive tier) —
  the engine takes the channel as an input, so this is config, not law.
- **All sheet rates are ex-GST**; customer-facing output shows ex-GST and
  inc-GST (10%) together.

## The pricing model (decoded from the sheet, verified against its examples)

Three products; the trip distance and base network decide which apply.

**Base network.** Local/Sole-Use bases: Sydney, Brisbane, Melbourne,
Adelaide, Perth, Canberra (+ "Remote" for local jobs near no base).
Shareload bases (14): those six + Hobart, Darwin, Hervey Bay, Gladstone,
Yeppoon, Mackay, Townsville, Cairns.

**Size mapping.** Bedrooms → cubic metres → truck: 1 br = 22 m³ (Small
18–22), 2 br = 32 m³ (Medium 23–50), 3 br = 45 m³ (Medium), 4–5 br = 65 m³
(Big 51–65).

**1. Local** — trip km ≤ 140 (sheet: `>140 → "QUOTE FIXED"`):

- Rate **per half-hour** = `rate[base, truck, channel]` (e.g. Sydney/Leads
  $65) `+ $3` if trip > 50 km `+ $5` (instead) if > 100 km
  `+ $30 × (men − 2)` for crews beyond 2.
- Callout (hours) = max(min-callout, Sydney-Leads special 0.5 h / Sydney
  other channels 1 h) `+ 0.5 h per started 50 km` beyond the included 50 km.
- "Remote" base: flat $120/half-hour all channels.

**2. Sole Use (whole truck)** — trip km ≥ 140:

- km = route(pickup → dropoff), **routed via the nearest base city if the
  direct route doesn't already touch it** (sheet steps 2–4).
- Price = `(BasePrice[base, truck] + km × perKm[base, truck, channel])`
  `× (1 + min(0.2, max(0, (km − 1100) / 1200 × 0.2)))` — the long-haul
  escalator: 0% below 1,100 km rising linearly to +20% at 2,300 km —
  rounded to the nearest $10.

**3. Shareload (pay per cubic)** — pickup base ≠ dropoff base:

- Deviation km = route(pickup → base₁ → dropoff → base₂, shortest order)
  − route(base₁ → base₂) (sheet steps 4–6).
- Price = `round₁₀(corridorRate[base₁, base₂] × cubics + deviationCharge)`
  `× channelMultiplier`, where deviation ≤ 25 km is free then **$6/km**, and
  the multiplier is Leads ×1.0, Social ×1.1, Organic ×1.25.
- Variant shown to reps: per-cubic MROUNDed to $5. Delivery window from the
  corridor matrix (a **Premium** day matrix also exists — future upsell).

Verified against the sheet's own worked examples, e.g. Townsville→Brisbane
32 m³ Social = $8,096 ✓; Brisbane→Adelaide 15 m³ Leads = $4,280 ✓;
Melbourne→Adelaide 10 m³ = $1,600 ✓; Hobart→Townsville 10 m³ = $6,450 ✓.

## Architecture

Five units, each independently testable:

### 1. `packages/pricing` — the rate engine (new workspace package)

- `rates.ts`: the transcribed tables — Data-Fixed (base prices + per-km by
  channel; shareload corridor matrix), Data-Local (per-half-hour rates,
  callout rules), delivery-time matrices (standard + premium), bedroom→cubic
  map, thresholds (140 km, 25 km free deviation, $6/km, escalator constants,
  rounding rules). Table carries `version` + `effectiveFrom` + `source`
  (sheet ID). **No placeholders — the real numbers land with the first
  commit.**
- `quote.ts`: pure `buildQuote(input)` → product selection (local / sole-use /
  shareload candidates) and `QuoteBreakdown` per candidate: product, truck,
  crew, km figures, per-cubic rate, totals **exGst + incGst**, deposit
  ($200, refundable), delivery window, `rateVersion`, `channel`, flags.
  Deterministic; caller supplies distances and "now".
- Input validation per the sheet's intent (crew 2–4, cubics 1–65, km > 0) —
  the sheet's own tabs contain garbage entries ("108 men"); the engine
  refuses them.
- Tests: unit tests per product/branch + **golden tests pinned to the
  sheet's worked examples above**.
- Rate updates = edit `rates.ts` in a PR. Old quotes keep their
  `rateVersion`. Long term, the rep sheet retires (or is generated from the
  engine); short term it stays — *the website and the sheet agree because
  both encode the same tables.*

### 2. `packages/pricing/distance` — the distance provider

The sheet's "create a map trip" steps, automated:

- Driving km via a routing API (Google Routes API; `ROUTING_API_KEY` env,
  documented in `.env.example`) with an in-memory + KV cache keyed on
  place pairs (base↔base legs are precomputed constants in `rates.ts`).
- Nearest-base resolution (geocode suburb → nearest base by driving km).
- Sole-use base-touch rule: if `route(pickup→base→dropoff)` exceeds
  `route(pickup→dropoff)` by less than a configurable threshold (default
  10 km) the direct route "touches" the base — use direct km; else use the
  via-base km (matches the rep procedure).
- Shareload deviation km exactly per sheet steps 4–6.
- Routing unavailable/unknown suburb → quote still renders from the widest
  plausible band with `distanceUnverified: true`; lead flagged "rep
  confirms distance".

### 3. `apps/quote` — the quote funnel (new app from `_template`; first production project)

- Flow: pickup & dropoff suburbs → bedrooms (→ cubics, editable) → move
  date → crew (local only) → **instant prices**. When both sole-use and
  shareload apply, show both: "Your own truck — $X, 1–2 days" vs "Shareload
  — $Y, 4–12 days" (good/better framing, delivery window from the matrix).
- Ex-GST and inc-GST shown together; $200 refundable deposit stated.
- Quote reference `NLR-YYMMDD-NNN` + `rateVersion` recorded; post-submit
  screen sets the callback expectation.
- No "Demo pricing" badge: these are real rates from day one.

### 4. `packages/movepro` — lead dispatch (extend existing adapter)

`submitLead(lead, quotes[]): Promise<DispatchResult>` behind
`createMoveproClient()`. Transport chain by env config:

1. **`api`** — implemented in `live.ts` when MovePro confirms an API.
2. **`email`** — human-readable + parseable lead email (Resend; env
   documented) to `MOVEPRO_LEAD_EMAIL` (MovePro lead-import address if
   discovery finds one, else the sales inbox — 60-second manual entry).
3. **`log`** — dev/test no-op.

**Persistence-first invariant:** lead written to Vercel Postgres
(`received → dispatched | dispatch-failed`) before any transport; retries
(max 3, backoff); surfaced in the dashboard. The lead email carries the
full breakdown (product, km, rate version, channel) so the rep's MovePro
file contains everything needed to close.

### 5. `/admin/leads` — safety-net dashboard (inside `apps/quote`)

Password-protected table: timestamp, reference, customer, route, products
quoted, prices, rate version, dispatch status, retry, CSV export.

## Data flow

```
visitor → apps/quote funnel
  → distance provider (routed km, bases, deviation)     ~300 ms, cached
  → pricing buildQuote()  → 1–2 product offers          instant
  → capture name + phone
  → persist lead (Postgres)                              never lost
  → movepro.submitLead()  (api → email → fail-marked)
  → MovePro file with full quote context                 rep closes
  → /admin/leads shows status                            audit/retry
```

## Error handling

- Unknown suburb / routing down → widest-band quote + `distanceUnverified`,
  never an error page; engine failure → "we'll call you with a price"
  capture, lead flagged `unpriced`.
- Validation errors → friendly inline messages (crew, cubics, same-suburb).
- Dispatch failure → `dispatch-failed`, retried, visible in dashboard;
  customer experience unaffected.
- Spam: honeypot + per-IP rate limit.

## Testing

- `packages/pricing`: unit tests per formula branch (thresholds 140 km /
  50 km / 100 km / 25 km / 1,100 km, escalator cap, rounding, channel
  multipliers) + golden tests = the sheet's worked examples.
- distance provider: against a fake routing client (base-touch threshold,
  deviation arithmetic).
- `packages/movepro`: transport selection, email snapshot,
  persistence-first ordering, retry.
- `apps/quote`: Playwright flow (suburbs → offers → submit → confirmation).

## Rollout

1. **Phase 1:** engine with real rates + funnel + email transport +
   dashboard. Routing API key is the only new external dependency.
2. **Phase 2:** API transport when MovePro confirms; mirror rates into
   MovePro settings so its documents agree.
3. **Later:** online deposit (Stripe); premium-delivery upsell; rep-facing
   calculator that replaces the sheet's 22 tabs.

## Dependencies on the company

- [x] ~~Rate spreadsheet~~ — delivered and decoded (this spec).
- [ ] **MovePro discovery (~30 min):** Settings → Integrations / API / Lead
      sources / email lead import; send support the TODO.md question list.
- [ ] **Routing API**: approve creating a Google Cloud key for the Routes
      API (free tier covers expected volume; usage-capped key).
- [ ] Callback-promise wording; confirm the quotes inbox is watched.

## Success criteria

- Price on screen in < 5 s; identical inputs → identical price, always.
- 100% of submitted leads persisted; ≥95% auto-dispatched.
- Zero variance between website price and the sheet for the same inputs
  (golden tests prove it).
- Lead volume and dispatch health visible in `/admin/leads`.

## Risks

- **Sheet evolves while we build** → engine pins `rateVersion` +
  `effectiveFrom`; rate owner named; diff against sheet before launch.
- **Routing API dependency** → cached corridors, precomputed base legs,
  `distanceUnverified` degradation path.
- **MovePro has no ingestion** → email-to-inbox keeps flow alive; dashboard
  guarantees nothing lost.
- **Rep tabs drift from engine** → near-term: golden tests catch divergence
  at rate-change time; long-term: retire the tabs (phase 3).
