# Twitter Bookmarks Context

## Product Purpose

Twitter Bookmarks is a static, media-first browser for X bookmarks exported through Field Theory. It ships derived bookmark artifacts to GitHub Pages and lets users browse, search, sort, filter, and inspect media bookmarks without a backend.

## Core Concepts

- `TweetDoc`: normalized bookmark-level record used by the app. It contains tweet text, author metadata, folder names, counters, dates, URL, and normalized media.
- `GridItem`: media-level record rendered in the masonry grid. It points back to a tweet and one media index.
- `Manifest`: public data index under `public/data` that names exported artifact files and build metadata.
- `QueryState`: URL-backed search and display state, including text query, sort, direction, media mode, immersive state, zoom, random seed, and semantic similarity target.
- `BookmarksQuery`: query-engine projection of `QueryState`; it contains only ordering, media-selection, and semantic-ranking inputs that cross the query worker seam.
- Semantic embeddings: static CLIP-derived artifacts exported into `public/data` and loaded client-side for concept search, image search, and similar-media browsing.
- One/all media modes: one mode renders a representative media item per tweet; all mode renders every media item.
- Public derived artifacts: files under `public/data` generated from local Field Theory data and served by the static app.
- Media rendition catalog: explicit AVIF image or poster renditions published on each mirrored `MediaItem` and `GridItem`; grid, preloader, and lightbox consume it through the media-delivery Module.
- Refresh pipeline: ordered local workflow that syncs Field Theory data, mirrors media, uploads the mirror, exports public artifacts, validates them, and builds the static app.
- X credentials: the local cookie credential pair (`ct0` and `auth_token`) used by Field Theory/X bookmark sync, usually stored in 1Password and refreshed from the controlled auth browser when needed.

## System Flow

Field Theory sync writes raw local cache data into `.data/fieldtheory`. The refresh pipeline owns the ordering and preflight checks for media mirroring, verified remote rclone sync, export, validation, and build. Export scripts normalize cache data into derived static artifacts under `public/data` and attach the media rendition catalog from the mirror manifest. Vite builds the React app and copies those artifacts into `dist`. GitHub Pages serves the static app. In the browser, the data loader renders the default view from the small first-grid artifact, waits one paint, then hydrates full grid/order artifacts and streamed `TweetDoc` chunks. The media-delivery Module gives the grid, preloader, and lightbox one rendition-selection seam; the CDN and browser HTTP cache own media caching. Text search returns lexical `TweetDoc` matches immediately and refines them when the embedding worker produces a semantic vector. Desktop loads the virtualized masonry module; iOS uses a bounded static grid with centralized viewport admission and without downloading desktop virtualization. Feature modules for Theme Studio, the lightbox, tweet widgets, and semantic inference load only when requested.

## Edit Map

- App shell and the two-path static route switch: `src/app` and `src/main.tsx`.
- Bookmark data model, URL state, artifact loading, cache, query engine, and export contracts: `src/features/bookmarks`.
- Grid behavior and masonry sizing: `src/components/grid`.
- Media rendering, autoplay, tweet embeds, and lightbox behavior: `src/components/media` and `src/components/lightbox`.
- Toolbar controls and layout: `src/components/toolbar`.
- Theme Studio, theme model, runtime variables, and persistence: `src/app/ThemeStudio.tsx` and `src/features/theme`.
- Query and embedding worker protocols and implementations: `src/workers`.
- Field Theory sync, X credentials, refresh pipeline, export, embeddings, validation, and performance scripts: `scripts`.

## Invariants

- The shipped app has no server backend and must run as a static GitHub Pages deployment.
- Raw Field Theory cache data stays local and out of the public repo.
- `public/data` contains derived shipped artifacts; treat changes there as generated data changes.
- Query and display state must round-trip through URL parameters when it affects the shareable browsing state.
- Search and semantic similarity run client-side using static artifacts.
- Prefer existing feature, component, and test patterns before introducing new abstractions.
