# Twitter Bookmarks

Media-first browser for X bookmarks exported through Field Theory.

Live demo: [corychainsman.github.io/twitter-bookmarks](https://corychainsman.github.io/twitter-bookmarks/)

## What It Ships

- Real exported bookmark media data committed into `public/data`
- Fast client-side search, folder filtering, sort controls, and URL-backed state
- `One` / `All` media modes
- `Immersive` media-only mode
- Theme Studio at [`/themes`](https://corychainsman.github.io/twitter-bookmarks/themes) with live cross-tab updates and theme import/export
- Static deployment to GitHub Pages

## Stack

- React 19
- TypeScript
- Vite
- Bun
- shadcn/ui primitives
- Lucide icons
- `@virtuoso.dev/masonry` for the media grid

## Local Development

```bash
bun install
bun run dev
```

App:

- Main app: [http://localhost:5173/](http://localhost:5173/)
- Theme Studio: [http://localhost:5173/themes](http://localhost:5173/themes)

## Data Flow

The app is built to consume static JSON artifacts under `public/data`.

Typical refresh flow:

```bash
bun run sync:ft
bun run data:export
bun run data:validate
bun run build
```

Convenience commands:

```bash
bun run refresh
bun run refresh:resume
bun run refresh:full
```

Notes:

- `sync:ft` depends on a real local Field Theory/X session.
- The exported app dataset is media-only; non-media bookmarks are not included in the shipped browsing surface.

## Scripts

- `bun run dev`: start the local app
- `bun run test`: run Vitest
- `bun run lint`: run ESLint
- `bun run typecheck`: run TypeScript project checks
- `bun run build`: build the static app
- `bun run preview`: preview the production build locally
- `bun run sync:ft`: sync bookmark data from Field Theory
- `bun run data:export`: build static artifacts into `public/data`
- `bun run data:validate`: validate exported artifacts

## GitHub Pages

Deployments are handled by [`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml).

- Push to `main`
- GitHub Actions builds with `GITHUB_PAGES=true`
- The site is published at [corychainsman.github.io/twitter-bookmarks](https://corychainsman.github.io/twitter-bookmarks/)

## Repository Structure

```text
src/app/                  App shell, router, theme studio
src/components/           Toolbar, grid, lightbox, media, UI primitives
src/features/bookmarks/   Query state, loaders, export contracts, caching
src/features/theme/       Theme model, runtime variables, persistence
src/workers/              Query worker
scripts/                  Field Theory sync and export pipeline
public/data/              Shipped static bookmark artifacts
```
