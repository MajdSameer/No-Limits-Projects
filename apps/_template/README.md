# _template

The starting point for every new No Limits app. **Don't build features in this
folder** — copy it:

```bash
pnpm new-app my-project-name
```

Then follow [docs/NEW_PROJECT.md](../../docs/NEW_PROJECT.md).

## What's wired up

- Branded `Header`/`Footer`, skip link, design tokens, system font stack
- Error boundary (`error.tsx`), root-layout error fallback (`global-error.tsx`),
  branded 404 (`not-found.tsx`)
- SEO metadata + `robots.ts` + placeholder favicon (`icon.svg`)
- Mobile-first responsive layout, `lang="en-AU"`
- Movepro adapter demo on the homepage (delete it in real apps)
- `.env.example` documenting every env var the app reads

## Run it

```bash
pnpm install            # from the repo root
pnpm dev                # serves this template on http://localhost:3000
```

## Keep the template healthy

This app builds in CI like any other. If you improve something every future
app should have (better error page, new meta tags), improve it **here**.
