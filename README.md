# X Inspo

X Inspo is a media-first discovery wall for an exported X/Twitter bookmark
catalog. It provides a continuously justified image and video wall, URL-backed
search and filters, responsive density controls, and addressable lightboxes.

- Production: [bookmarks.corychainsman.com](https://bookmarks.corychainsman.com/)
- Staging: [dev.bookmarks.corychainsman.com](https://dev.bookmarks.corychainsman.com/)
- Architecture: [docs/system-architecture.md](./docs/system-architecture.md)

## Stack

- React 19, TypeScript, Vite, and Bun
- react-infinitegrid `JustifiedInfiniteGrid`
- TanStack Router and TanStack Query
- shadcn/ui, Tailwind CSS, Motion, and use-gesture
- Cloudflare Workers and static assets
- Workbox service worker

## Local development

```bash
bun install
bun run dev
```

The local application is available at `http://localhost:5173`.

Release checks:

```bash
bun run api:generate
bun run test
bun run typecheck
bun run lint
bun run build
bun run test:e2e
```

## Catalog refresh

The repository intentionally retains the operator-run pipeline for pulling new
Twitter bookmarks and publishing their media. Raw bookmark and media inputs are
stored under gitignored `.data`; validated deployment artifacts are written to
`public/data`.

The normal refresh is:

```bash
bun run refresh
```

Its ordered implementation covers:

1. Authenticate and sync bookmarks through Field Theory.
2. Mirror original media locally.
3. Generate image renditions and video preview/playback files.
4. Publish and verify media on Cloudflare R2, with a Drive backup.
5. Export the versioned catalog and embedding index.
6. Validate catalog/media integrity and build the application.

Read [the data-refresh runbook](./docs/runbooks/data-refresh.md) before running
the pipeline. It documents the required X session, 1Password environment,
rclone remotes, failure handling, and safe resume/full-refresh commands.

Useful individual commands:

```bash
bun run auth:x:ensure
bun run sync:ft
bun run data:mirror
bun run data:backfill-image-variants
bun run data:video-previews
bun run mirror:sync
bun run data:export
bun run data:embeddings
bun run data:validate
```

## Deployment

Staging and production use separate Cloudflare Workers and explicit configs:

```bash
bun run deploy:cf:staging
bun run deploy:cf:production
```

Follow [the deployment runbook](./docs/runbooks/deployment.md); production is
promoted only after staging verification.

## Repository structure

```text
contracts/              OpenAPI source of truth
src/greenfield/         Browser application
src/components/ui/      Used shadcn primitives
scripts/catalog/        Catalog contracts and export implementation
scripts/                Sync, mirror, publication, and refresh pipeline
public/data/            Versioned, deployable catalog artifacts
worker/                 Cloudflare API adapter and social HTML
tests/e2e/              Desktop and simulated-mobile verification
```
