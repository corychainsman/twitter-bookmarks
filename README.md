# Twitter Bookmarks

Media-first browser for X bookmarks exported through Field Theory.

Live app: [bookmarks.corychainsman.com](https://bookmarks.corychainsman.com/)
(also published to [GitHub Pages](https://corychainsman.github.io/twitter-bookmarks/)).

LLM and contributor architecture guide:
[docs/system-architecture.md](./docs/system-architecture.md).

## What It Ships

- Real exported bookmark media data committed into `public/data`
- Self-hosted media: all tweet photos/videos are archived and served from
  Cloudflare R2 at `tbmedia.corychainsman.com` (no twimg.com dependency),
  with a truthful AVIF ladder capped from 320/680/1280/2048w, content-addressed
  paths, explicit rendition metadata, 1-year immutable cache headers,
  Smart Tiered Cache, and zero-request inline ThumbHash placeholders
- Progressive data loading: grid renders from `manifest.json` + order files while
  ~400KB of tweet captions stream in behind a promise (captions, one-mode sort, and
  semantic search only need tweet docs; full page render doesn't block on them)
- Desktop virtualized masonry plus an iOS-specific bounded static grid; native
  responsive-image loading owns image scheduling
- Fast client-side search, folder filtering, sort controls, and URL-backed state
- Static CLIP embedding index for concept search across tweet text, images, and video poster frames
- Text search, image search, and “Similar” browsing with no backend
- `One` / `All` media modes
- `Immersive` media-only mode
- Theme Studio at [`/themes`](https://bookmarks.corychainsman.com/themes) with live cross-tab updates and theme import/export
- Static deployment to a Cloudflare Worker custom domain and GitHub Pages

## Stack

- React 19
- TypeScript
- Vite
- Bun
- shadcn/ui primitives
- Lucide icons
- `react-virtualized` Masonry for the desktop media grid

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
bun run data:mirror    # download new media + generate current renditions
bun run data:backfill-image-variants
bun run data:video-previews
bun run mirror:sync    # upload archive to R2 + Google Drive backup
bun run data:export
bun run data:embeddings
bun run data:validate
bun run build
```

Convenience commands:

```bash
bun run refresh
bun run refresh:resume
bun run refresh:full
bun run refresh:embeddings
```

Notes:

- `sync:ft` depends on a real local Field Theory/X session.
- `data:mirror` archives originals to `.data/media/assets/` (gitignored) and
  tracks status in `.data/media/mirror-manifest.json`; `data:export` rewrites
  media URLs to the mirror for confirmed assets. See
  [docs/runbooks/media-mirror.md](./docs/runbooks/media-mirror.md).
- `mirror:sync` pulls R2 credentials from 1Password (`op environment read`),
  so the 1Password app's CLI integration must be unlocked.
- The exported app dataset is media-only; non-media bookmarks are not included in the shipped browsing surface.
- `data:embeddings` precomputes a compact static CLIP vector index into `public/data/embeddings/index.json`.
- Semantic search runs entirely in the browser: the static host serves the vector index, and Transformers.js loads the same CLIP model client-side to embed typed text or uploaded query images.
- Video and animated GIF entries are embedded from their exported poster/preview image, so similarity captures the representative visual frame rather than temporal motion.

## Scripts

- `bun run dev`: start the local app
- `bun run test`: run Vitest
- `bun run lint`: run ESLint
- `bun run typecheck`: run TypeScript project checks
- `bun run build`: build the static app
- `bun run preview`: preview the production build locally
- `bun run sync:ft`: sync bookmark data from Field Theory
- `bun run data:mirror`: download/mirror tweet media into the local archive
- `bun run mirror:sync`: sync the media archive to Cloudflare R2 + Google Drive
- `bun run data:export`: build static artifacts into `public/data`
- `bun run data:embeddings`: build static semantic embedding artifacts into `public/data`
- `bun run data:validate`: validate exported artifacts

## GitHub Pages

Deployments are handled by [`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml).

- Push to `main`
- GitHub Actions builds with `GITHUB_PAGES=true`
- The site is published at [corychainsman.github.io/twitter-bookmarks](https://corychainsman.github.io/twitter-bookmarks/)

## Cloudflare Worker custom-domain deployment

The same static build is also served from
[bookmarks.corychainsman.com](https://bookmarks.corychainsman.com/) as a Cloudflare
Worker with static assets ([`wrangler.jsonc`](./wrangler.jsonc)), on the same zone
and edge as the R2 media host. This is the primary user-facing URL; GitHub Pages
remains a second static deployment. The custom domain gets Early Hints (enabled
on the zone) and Smart Tiered Cache for the shell, not just the media.

- `bun run deploy:cf` — builds with the default (root) base path and runs
  `wrangler deploy`. Requires `CLOUDFLARE_API_TOKEN` (Workers Scripts:Edit,
  Workers Routes:Edit) and `CLOUDFLARE_ACCOUNT_ID` in the environment.
- Unlike GitHub Pages, this deploy is manual — there's no CI workflow for it yet.

## Repository Structure

```text
src/app/                  App shell, router, theme studio
src/components/           Toolbar, grid, lightbox, media, UI primitives
src/features/bookmarks/   Query state, loaders, export contracts, caching
src/features/theme/       Theme model, runtime variables, persistence
src/workers/              Query worker
scripts/                  Field Theory sync, media mirror, and export pipeline
public/data/              Shipped static bookmark artifacts
.data/media/              Local media archive + mirror manifest (gitignored)
```
