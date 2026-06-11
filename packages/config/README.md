# @nlr/config

Shared configuration for the whole monorepo. If a value describes the company
or the brand, it lives here — nowhere else.

| Export | What it is |
| --- | --- |
| `@nlr/config/brand` | Company constants (`company`), brand hex values (`brandColors`), locale helpers (`formatCurrency`, `formatDate`) |
| `@nlr/config/tailwind/theme.css` | Brand design tokens (colours, fonts) as a Tailwind v4 `@theme` |
| `@nlr/config/typescript/{base,library,nextjs}` | Strict TypeScript configs to `extends` from |
| `@nlr/config/eslint/{base,react,next}` | Flat ESLint configs — `base` for plain TS, `react` adds hooks rules, `next` adds Next.js rules |

## Changing the brand

1. Colours/fonts → edit `tailwind/theme.css` (tokens only — components never hard-code hex values).
2. Phone, email, ABN, tagline → edit `src/brand.ts`.
3. Keep `brandColors` in `src/brand.ts` in sync with the two hex values it mirrors from `theme.css`.
4. Tick off the matching entry in `/TODO.md`.

Every app and package picks the change up automatically — no other edits needed.
