# @nlr/movepro

Typed adapter for [Movepro](https://movepro.com), the company's CRM (bookings,
AI quotes, lead pipeline, scheduling, payments). Our tools complement Movepro —
they push leads in and read state out; they don't duplicate it.

**Status: mock-only.** Movepro API/webhook availability is unconfirmed — the
open questions are tracked in [/TODO.md](../../TODO.md).

## Usage

```ts
import { createMoveproClient } from "@nlr/movepro";

const movepro = createMoveproClient(); // mock unless MOVEPRO_MODE=live

const estimate = await movepro.requestQuote({
  from: { suburb: "Parramatta", state: "NSW", postcode: "2150" },
  to: { suburb: "Newcastle", state: "NSW", postcode: "2300" },
  size: "3-bedroom",
});
```

Rules for app code:

- Depend on the `MoveproClient` interface via `createMoveproClient()` — never
  import `MockMoveproClient` or `LiveMoveproClient` directly.
- Use the domain types from this package (`Lead`, `Booking`, `QuoteEstimate`…)
  rather than defining your own shapes.
- Surface `client.mode` in dev UIs so nobody mistakes mock data for real data.

## Going live later

| Env var | Meaning |
| --- | --- |
| `MOVEPRO_MODE` | `mock` (default) or `live` |
| `MOVEPRO_API_KEY` | Required in live mode. Vercel env vars only — never committed. |
| `MOVEPRO_BASE_URL` | Live API base URL |

When access is confirmed, implement the methods in `src/live.ts` (mapping
Movepro payloads into our domain types), then flip the env vars per app.
App code shouldn't change at all — that's the point of the adapter.
