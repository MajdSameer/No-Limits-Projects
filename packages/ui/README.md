# @nlr/ui

Shared branded components for every No Limits app. Mobile-first and accessible
by default — keep it that way:

- Touch targets ≥ 44px (`min-h-11`) on interactive elements
- Visible `focus-visible` outlines everywhere
- Form fields wired with `label`/`aria-describedby`/`aria-invalid` (use
  `TextField` & friends rather than raw `<input>`)
- Colours come from the brand tokens in `@nlr/config` — never hard-code hex

## Components

`Header`, `Footer`, `Logo`, `SkipLink`, `Container`, `Section`, `Card`,
`Button`/`ButtonLink`, `TextField`/`TextAreaField`/`SelectField`, plus the
`cx` class-name helper.

## Notes for consumers

- Apps must list `@nlr/ui` in `transpilePackages` (the template already does)
  and add `@source "../../../../packages/ui/src";` to their `globals.css` so
  Tailwind sees these classes.
- `Header`/`Logo`/`Footer` use plain `<a>` tags so the package stays
  framework-light. For app-internal links where prefetching matters, use
  `next/link` directly in app code.
