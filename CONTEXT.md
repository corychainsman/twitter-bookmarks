# X Inspo Context

## Product Purpose

X Inspo is a greenfield, media-first discovery application. People search,
filter, sort, shuffle, and explore a continuously justified wall of images and
short video previews, then open an addressable lightbox for full media and
record metadata.

This frontend starts from its own contracts and interaction model. The retired
bookmark-browser runtime has been removed. The preserved catalog pipeline is a
data producer, not a source of frontend requirements. There is no
media-submission or image-upload flow.

## Core Concepts

- `MediaRecord`: one searchable result with an X author/profile URL, original
  post URL and timestamp, tags, and an ordered collection of media assets.
- `MediaAsset`: one image or video with stable identity, intrinsic dimensions,
  placeholders, wall renditions, lightbox renditions, and optional preview
  video/poster.
- `CommittedWallState`: the validated, URL-backed query and composition state:
  search text, facets, sort, view mode, shuffle seed, density, and optional
  similar-media target.
- `DiscoveryPage`: a cursor-addressable page from a frozen result snapshot. It
  can identify minimally relaxed filters when there are no exact matches.
- `WallTile`: the client composition of one or more media assets, including a
  deterministic scale hint and stable JustifiedInfiniteGrid group.
- View modes:
  - `asset`: one tile per media asset.
  - `record`: one deterministic representative asset per record.
  - `hybrid`: one record tile containing up to four assets plus an overflow
    count.
- Density: `auto` chooses a device-appropriate starting size; a numeric value
  is a user-selected continuous tile-size multiplier.
- Addressable lightbox: `/media/$mediaId` overlays the still-mounted wall, so a
  Motion shared-element transition can morph out of and back into the tile.
- Wall videos use compact preview MP4s; lightbox videos select the highest-
  bitrate direct MP4 exposed by X, serve its byte-for-byte mirrored original,
  and expand with `object-contain` to the available viewport.
- `ApiTransport`: the frontend-owned boundary for discovery, staged result
  counts, and direct media lookup. The current runtime injects a deterministic
  mock in test mode and an HTTP implementation elsewhere. Both implement the
  same interface and OpenAPI contract.
- `CatalogPipeline`: the operator-run scripts that pull X/Twitter bookmarks,
  mirror media, generate renditions and previews, export versioned catalog
  artifacts, incrementally caption/OCR media, generate static semantic
  embeddings, validate them, and build the application. Its output is
  `public/data`; raw source data stays under gitignored `.data`.

## System Flow

`src/main.tsx` composes React, TanStack Router, TanStack Query, the injected API
transport, shadcn providers, and the production service worker. TanStack Router
validates all committed wall state and owns `/` plus `/media/$mediaId`. TanStack
Query fetches cursor pages without discarding the current wall while a new
result set is loading.

Records pass through the deterministic composition engine and then into
react-infinitegrid's `JustifiedInfiniteGrid`, which alone owns wall placement,
measurement, and append requests. Rendered groups remain mounted because the
library's group recycling can expose transient holes during continuous scrolling;
detached recycling is not enabled. Known tile geometry and `data-grid-skip` media subtrees keep image
readiness from delaying layout. The wall does not use TanStack Virtual or
another virtualization layer. Motion pairs stable media layout IDs between the
justified wall and the lightbox. The lightbox adds pan, pinch/trackpad zoom, swipe
navigation, and a desktop metadata rail or mobile details drawer.

The unpositioned initial wall stays transparent beneath the shadcn skeleton
until JustifiedInfiniteGrid reports its first completed layout, preventing its
static-to-absolute placement pass from contributing layout shift. Mobile drawer
code loads on first use; lightbox code warms only during delayed idle time on
capable desktops.

In staging and production, a Cloudflare Worker serves built assets and adapts
its own versioned catalog through the asset binding into `/api/*`. It also enriches
`/media/:mediaId` HTML with sanitized Open Graph and Twitter metadata. A future
dedicated API can replace that adapter behind the same HTTP contract. The
application remains `noindex`; rich social previews do not imply crawlable
discovery pages. A custom Workbox service worker precaches the application
shell and keeps bounded recent-result and media caches for resilient revisits.
Hard entry caps are 40 results, 140
same-origin images, 12 cross-origin images, and eight same-origin videos;
storage estimates reduce those limits on constrained devices.
An update already waiting at navigation, or discovered during initial startup,
activates silently and performs one controlled reload so the page opens on the
new application version. Updates discovered later in an active session retain
the non-disruptive refresh prompt.

An hourly systemd user timer runs the production refresh orchestrator. It uses
the tracked `ops/refresh-state.json` bookmark ID as the durable GitHub
checkpoint, skips publication when X has nothing newer, performs a weekly full
folder reconciliation, and advances the checkpoint only after verified staging
and production deployments plus a successful GitHub push.

The serving refresh publishes immutable media to R2 but does not wait on the
throttle-prone Google Drive cold archive. A separate daily systemd timer resumes
that append-only backup until it is caught up.

See `docs/system-architecture.md` for the complete boundaries and behavior.

## Edit Map

- Composition root: `src/main.tsx` and `src/greenfield/GreenfieldApp.tsx`.
- Domain and port contracts: `src/greenfield/contracts/`.
- URL parsing, routes, and history policy: `src/greenfield/router/`.
- Query client, transport provider, query keys, and API adapters:
  `src/greenfield/platform/` and `src/greenfield/data/`.
- Seeded view-mode projection: `src/greenfield/modules/composition/`.
- Justified wall and responsive media: `src/greenfield/modules/wall/`.
- Search, filters, mode, sort, density, responsive chrome, and shell:
  `src/greenfield/modules/controls/` and `src/greenfield/shell/`.
- Preview playback and autoplay policy: `src/greenfield/modules/playback/`.
- Shared-element lightbox: `src/greenfield/modules/lightbox/`.
- Telemetry contracts and browser instrumentation:
  `src/greenfield/telemetry/`.
- Offline runtime: `src/greenfield/service-worker/`.
- shadcn primitives, their sole shared utility, and theme:
  `src/components/ui/`, `src/lib/utils.ts`, and `src/index.css`.
- HTTP contract and generated types: `contracts/openapi.yaml` and
  `src/greenfield/generated/api.ts`.
- Edge gateway and social shell: `worker/index.ts` and `wrangler.jsonc`.
- Catalog artifact contracts and export implementation:
  `scripts/catalog/`; refresh orchestration and media publication: `scripts/`.
- Hourly production refresh units and tracked checkpoint: `ops/systemd/` and
  `ops/refresh-state.json`; operator procedure: `docs/runbooks/data-refresh.md`.

## Invariants

- Treat X Inspo as greenfield. Do not infer product requirements from legacy
  application behavior or old deployment documentation.
- Preserve the `CatalogPipeline` interface and ordering. A refresh must sync
  bookmarks, mirror and publish media, export artifacts, regenerate embeddings,
  validate output, and build. Never commit raw `.data` inputs.
- Semantic search remains service-free: media understanding runs during the
  refresh, the browser lazily embeds free-form text in a Web Worker using the
  vendored quantized model, and the catalog Worker scans the static index and
  fuses semantic candidates with exact lexical matches. Data-saver clients keep
  the lexical path and do not download the query model.
- JustifiedInfiniteGrid is the only wall layout engine. Do not add
  TanStack Virtual or nest another virtualizer around it.
- Server result identity includes search, filters, sort, and similar-media
  target. Seed joins that identity only for random sort; otherwise seed, mode,
  and density remain client composition state and must not refetch records.
- Every committed result-affecting control change creates a browser history
  entry. Only transient drafts and defensive fallbacks may replace history.
- Shareable state must round-trip through readable, validated URL parameters.
- Opening a media route must preserve the mounted wall. Lightbox sibling and
  previous/next navigation replace the lightbox route; close returns through
  history when it was opened from the wall. These overlay route changes must
  preserve the wall's window scroll position for shared-element measurement.
- While another cursor page exists, buffer an incomplete trailing composition
  group instead of exposing it as an unstable justified row. Once pagination
  ends, merge the remainder into the preceding group for one balanced terminal
  layout.
- Preserve intrinsic media aspect ratios. Wall previews use aspect-aware slice
  layouts and `object-contain`, prioritizing complete, undistorted assets.
  JustifiedInfiniteGrid maintains each tile's composite ratio with cropping and
  stretching disabled, and the wall uses one uniform 4px inter-tile gutter.
  The lightbox also uses `object-contain`.
- Wall image and motion-poster catalogs include 240, 320, 480, 680, 1280, and
  2048px AVIF candidates bounded by source width. Video previews keep a
  responsive picture above the video until its first decoded frame is ready;
  lightbox renditions remain unchanged.
- Autoplay starts at 10% visibility and stops below 5%. Reduced-motion or
  data-saving preferences disable ambient autoplay entirely; playable desktop
  tiles retain a play affordance and may preview on hover.
- InfiniteGrid's symmetric before/after viewport threshold scales with the
  effective density, and video source admission uses the same margin, so media
  is mounted and begins loading several rows before it becomes visible.
- Reduced motion, keyboard access, focus containment, large touch targets, and
  simulated mobile coverage are release requirements.
- Production API changes start in `contracts/openapi.yaml`; regenerate client
  types with `bun run api:generate` and keep `ApiTransport` aligned.
- Staging is isolated at `dev.bookmarks.corychainsman.com`; production uses a
  separate Worker at `bookmarks.corychainsman.com` and is changed only after
  staging verification and explicit promotion.
- Before handoff, run `bun run test`, `bun run typecheck`, `bun run lint`, and
  `bun run build`.
