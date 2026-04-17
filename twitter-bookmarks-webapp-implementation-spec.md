# Twitter Bookmarks Media Browser — Implementation Spec

## Purpose

Build a static React web app for browsing and searching Twitter/X bookmarks in a masonry grid, with the first pass focused on bookmarks that contain media:

- photos
- videos
- animated GIFs

The app is intended for a **public GitHub repository** and deployment to **GitHub Pages**.

This spec is written for an **AI agent building the system in one pass**. The checkpoints below are **validation gates for existing functionality**, not PR phases or human workflow steps.

---

## Core decisions

| Area | Decision |
|---|---|
| Package manager / runner | **Bun** |
| Frontend build tool | **Vite** |
| UI | **shadcn/ui on Radix**, not Base |
| Hosting | **GitHub Pages via GitHub Actions** |
| Data ingest | **fieldtheory-cli** using the default GraphQL bookmark sync path |
| Search | **Client-side full-text search** over normalized exported data |
| Query execution | **Web Worker** |
| Grid | **Virtualized masonry grid** using an open-source React library |
| Lightbox | **Open-source React lightbox** with carousel + video support |
| Scope of published data | **Derived static assets only**; raw fieldtheory cache stays local and gitignored |

---

## Product requirements

### Top toolbar

The toolbar at the top of the screen must support:

- full-text search over:
  - tweet text
  - deep article/title/body text when present
  - quoted tweet text
- sorting by:
  - bookmark order (`sortIndex`-based)
  - tweet posted date
  - random order
- random sort seed behavior:
  - seed changes every refresh when random mode is active and seed is not pinned
  - seed changes when user re-enters random mode
  - user can pin/keep the seed
  - pinned seed must be stored in URL params
  - rerandomize must generate a new seed
  - if pinned, rerandomize must also update the URL seed param
- item count display:
  - total number of items currently shown in the grid
- media display mode:
  - **one item per tweet**
  - **all media items per tweet**
- one-item-per-tweet selection rule:
  - if enabled, optionally prefer a **video or animated GIF** when the tweet has one
- zoom in / zoom out:
  - changes the visual size / column width of the masonry items

### URL-driven state

All search/filter/sort state must round-trip through URL parameters.

Requirements:

- on page load:
  - read URL params
  - validate them
  - populate toolbar state from them
- on state change:
  - update URL immediately
- when a value returns to default:
  - remove the corresponding URL param
- URL must be shareable and recreate the same state
- use `replaceState`-style behavior for rapid changes like typing, not history spam

### Grid behavior

- masonry grid
- use an existing open-source React masonry library
- do **not** build a custom masonry implementation from scratch
- handle large datasets smoothly
- support virtualization
- support media prefetching / prewarming strategy
- support quick revisits and session continuity

### Media playback

In the grid:

- videos / animated GIFs should autoplay when appropriate
- they should be visible as moving media directly in the masonry grid
- autoplay must be muted / inline-safe
- media should pause when it leaves the relevant viewport band

### Lightbox

Clicking a media item must open a lightbox that shows:

- the selected media item
- a carousel of the other media items from the same tweet
- tweet text
- tweet posted date
- like count
- reply count
- repost / retweet count
- author display name
- author handle
- a way to open the original tweet in a new tab

For playable media:

- user must be able to play/pause video media in the lightbox

---

## Non-goals for v1

- non-media bookmarks
- server backend
- authenticated end users
- write-back to Twitter/X
- editing bookmark folders from the app
- committing raw fieldtheory cache into the public repo
- mirroring the full raw media archive into the public repo by default

---

## High-level architecture

```text
Local machine
  └─ fieldtheory sync into repo-local data dir
       └─ export script normalizes + indexes data
            └─ writes derived assets into public/data/
                 └─ Vite build copies static data into dist/
                      └─ GitHub Pages serves static site
                           └─ client loads data + query worker + grid UI
```

Key rule:

- **fetch and export happen locally**
- **GitHub Pages only serves the derived static output**
- **the one-liner must do everything except git commit and git push**

---

## Repository layout

```text
/
  .github/
    workflows/
      deploy.yml
  .data/
    fieldtheory/                 # raw FT cache, gitignored
  public/
    data/
      manifest.json
      tweets/
        docs-0001.json
        docs-0002.json
      grid/
        one.json
        all.json
      order/
        bookmarked.json
        posted.json
      search/
        index.json
        store.json
  scripts/
    export-fieldtheory.ts
    validate-export.ts
  src/
    app/
      AppShell.tsx
      router.tsx
    components/
      toolbar/
      grid/
      media/
      lightbox/
      ui/
    features/
      bookmarks/
        model.ts
        selectors.ts
        url-state.ts
        random-seed.ts
      search/
        index-loader.ts
        query-client.ts
      media/
        autoplay.ts
        representative-media.ts
    hooks/
    lib/
      format.ts
      storage.ts
      idb.ts
    routes/
      __root.tsx
      index.tsx
    workers/
      query.worker.ts
    main.tsx
    index.css
  .gitignore
  bun.lock
  components.json
  package.json
  tsconfig.json
  vite.config.ts
```

---

## Tooling choices

### 1. Bun + Vite

Use:

- **Bun** for package management and script execution
- **Vite** for the frontend build

Reason:

- Bun gives fast local installs and script running
- Vite is the safer and more standard frontend choice for React + Tailwind + shadcn + GitHub Pages
- GitHub Pages only needs a static build artifact

### 2. shadcn/ui on Radix

This project must use:

- **shadcn/ui**
- **Radix-backed components**
- **not Base UI**

### 3. Router

Use a router with strong URL search param support.

Preferred:

- **TanStack Router**

Reason:

- URL search params are first-class in this app
- typed search param handling is valuable
- easier to keep defaults, validation, and removal rules coherent

### 4. Masonry library

Recommended default:

- **Virtuoso Masonry**

Alternatives worth keeping in reserve:

- **masonic**
- **react-virtualized Masonry**

Selection criteria:

- virtualization
- variable-height items
- responsive columns
- stable performance for 10k+ dataset scale
- compatible with window scrolling and autoplay visibility logic

### 5. Lightbox

Recommended:

- **Yet Another React Lightbox**
- include video/carousel-capable plugins as needed

Selection criteria:

- mixed image/video support
- carousel support
- zoom
- caption/metadata area
- controllable video playback in lightbox

### 6. Full-text search

Recommended:

- **MiniSearch**

Alternative:

- **FlexSearch**

Decision rule:

- default to MiniSearch unless profiling shows it is insufficient for the actual exported dataset size

---

## Dataset scale assumptions

Current size:

- ~10,000 bookmarks

Projected growth:

- ~3,000 per year

System target:

- should feel smooth now
- should remain comfortable at **25,000+ bookmarks**
- queries and render pipelines must avoid whole-dataset rerender and repeated expensive scans

Important implication:

- **search/filter/sort must not be done in React render code**
- heavy query work belongs in a **Web Worker**
- orderings and media projections should be **precomputed at export time**

---

## fieldtheory requirements

### Hard requirements

The fieldtheory sync must:

- use the deepest/fullest bookmark pull path available
- use the default GraphQL bookmark sync path
- include gap/backfill behavior for enriched records
- include bookmark folders
- store all raw data in the **working directory**, not the home directory
- use a **very high max pages count**
- be safe for large bookmark archives

### Canonical data directory rule

Always set:

```bash
FT_DATA_DIR="$PWD/.data/fieldtheory"
```

### Canonical one-liner

The one command the user should run locally:

```bash
bun run refresh
```

That command must do all of the following:

1. sync latest data from Twitter/X via fieldtheory
2. include gaps/article/quoted tweet enrichment
3. include bookmark folders
4. export the normalized dataset
5. generate search artifacts
6. validate output
7. build the static app

It must **not**:

- commit
- push
- deploy directly

### Required package scripts

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",

    "sync:ft": "FT_DATA_DIR=\"$PWD/.data/fieldtheory\" ft sync --gaps --folders --max-pages 10000 --max-minutes 240 --delay-ms 600",
    "sync:ft:resume": "FT_DATA_DIR=\"$PWD/.data/fieldtheory\" ft sync --continue --gaps --folders --max-pages 10000 --max-minutes 240 --delay-ms 600",
    "sync:ft:full": "FT_DATA_DIR=\"$PWD/.data/fieldtheory\" ft sync --rebuild --gaps --folders --max-pages 10000 --max-minutes 240 --delay-ms 600",

    "data:export": "bun run scripts/export-fieldtheory.ts",
    "data:validate": "bun run scripts/validate-export.ts",

    "refresh": "bun run sync:ft && bun run data:export && bun run data:validate && bun run build",
    "refresh:resume": "bun run sync:ft:resume && bun run data:export && bun run data:validate && bun run build",
    "refresh:full": "bun run sync:ft:full && bun run data:export && bun run data:validate && bun run build"
  }
}
```

### Important fieldtheory note

The agent should treat **main timeline sync** and **folder sync** separately when reviewing fieldtheory behavior.

Implementation rule:

- assume the normal bookmark sync is large-archive capable with a very high `--max-pages`
- explicitly verify whether folder walking honors that same max-pages value
- if folder walking does not inherit the CLI max-pages setting cleanly, patch or pin fieldtheory so folder sync also uses a high page cap

This matters because the requirement is not just “bookmarks mostly synced”; it is “deepest/fullest pull possible, including bookmark folders.”

---

## Export pipeline

### Overview

The export script reads the raw fieldtheory cache and writes a static, browser-friendly derived dataset to `public/data/`.

### Export responsibilities

`scripts/export-fieldtheory.ts` must:

1. read the raw bookmark records
2. filter to tweets that contain media for v1
3. normalize tweet fields into a stable schema
4. extract and normalize media objects
5. compute representative media selections
6. precompute sort orders
7. build the full-text search index
8. chunk docs if needed
9. write a manifest describing the build

### Published outputs

```text
public/data/
  manifest.json
  tweets/
    docs-0001.json
    docs-0002.json
  grid/
    one.json
    all.json
  order/
    bookmarked.json
    posted.json
  search/
    index.json
    store.json
```

### Manifest shape

```ts
type Manifest = {
  buildId: string
  builtAt: string
  tweetCount: number
  gridItemCountOne: number
  gridItemCountAll: number
  chunkSize: number
  files: {
    docs: string[]
    gridOne: string
    gridAll: string
    orderBookmarked: string
    orderPosted: string
    searchIndex: string
    searchStore: string
  }
}
```

### Normalized tweet doc shape

```ts
type TweetDoc = {
  id: string
  sortIndex: string | null
  postedAt: string | null
  url: string
  text: string
  articleTitle?: string
  articleText?: string
  quotedText?: string
  authorName?: string
  authorHandle?: string
  folderNames: string[]
  likes?: number
  replies?: number
  reposts?: number
  media: MediaItem[]
  representativeMediaIndex: number
  representativeMotionMediaIndex: number
}
```

### Normalized media item shape

```ts
type MediaItem = {
  type: "photo" | "video" | "animated_gif"
  thumbUrl: string
  fullUrl: string
  posterUrl?: string
  width?: number
  height?: number
  aspectRatio?: number
  durationMs?: number
  variants?: Array<{
    url: string
    bitrate?: number
    contentType?: string
  }>
}
```

### Grid item shape

```ts
type GridItem = {
  gridId: string
  tweetId: string
  mediaIndex: number
  mediaType: "photo" | "video" | "animated_gif"
  thumbUrl: string
  fullUrl: string
  posterUrl?: string
  width?: number
  height?: number
  aspectRatio?: number
}
```

### Precomputed projections

The export step must generate:

- `grid/one.json`
  - exactly one item per tweet
- `grid/all.json`
  - one item per media object
- `order/bookmarked.json`
  - ordered ids by bookmark order (`sortIndex`)
- `order/posted.json`
  - ordered ids by tweet posted date

### Representative media rules

For `mode=one`:

- `representativeMediaIndex`
  - choose a stable default representative item
- `representativeMotionMediaIndex`
  - choose a video or animated GIF when available
  - otherwise fall back to the default representative item

This must be computed at export time, not live in render logic.

---

## Search design

### Searchable fields

The app must support full-text search across:

- tweet text
- quoted tweet text
- article title
- article text/body
- author display name
- author handle
- folder names

### Recommended field boosts

Use a weighted index with something close to:

- `text`: 5
- `quotedText`: 4
- `articleTitle`: 4
- `articleText`: 2
- `authorName`: 1.5
- `authorHandle`: 1.5
- `folderNames`: 1.25

### Search architecture

- load search artifacts lazily
- execute search in a **Web Worker**
- return matching ids to the main thread
- the UI should not rebuild the full text index on page load in the main thread

### Query pipeline

At runtime the worker should apply, in order:

1. base dataset choice
   - `mode=one`
   - `mode=all`
2. text search
3. any future filters
4. sort selection
5. direction reversal if needed
6. final ordered result id list

### Large dataset rule

The worker should operate on:

- compact arrays
- maps keyed by id
- precomputed orders

Avoid:

- deep cloning full docs per query
- sorting full object arrays repeatedly
- performing text search in the React tree

---

## URL parameter contract

The URL is the source of truth for shareable state.

### Required params

- `q`
- `sort=bookmarked|posted|random`
- `dir=asc|desc`
- `mode=one|all`
- `preferMotion=1`
- `zoom=<number>`
- `keepSeed=1`
- `seed=<string>`

### Rules

- on page load:
  - parse and validate URL params
  - hydrate toolbar controls from them
- on toolbar change:
  - update URL immediately
- when a value equals the default:
  - remove it from the URL
- invalid params:
  - sanitize back to defaults
- typing/search:
  - use URL replacement semantics rather than pushing a new history entry on every keystroke

### Defaults

Recommended defaults:

- `q`: empty
- `sort`: `bookmarked`
- `dir`: `desc`
- `mode`: `one`
- `preferMotion`: `false`
- `zoom`: app-defined default column width scalar
- `keepSeed`: `false`
- `seed`: absent unless pinned

---

## Random sort design

Random sort must be deterministic for a given seed and non-deterministic across refresh/re-entry when unpinned.

### Rules

When user enters random mode:

- if `keepSeed=false`:
  - generate a fresh ephemeral seed
- if `keepSeed=true` and a seed exists:
  - reuse it
- if `keepSeed=true` and seed is missing:
  - generate one and write it to URL

When user refreshes the page:

- if seed is unpinned:
  - generate a fresh seed
- if seed is pinned:
  - keep it

When user clicks rerandomize:

- always generate a new seed
- if pinned:
  - update `seed` in URL
- if unpinned:
  - keep it ephemeral

### Implementation rule

Do **not** use `Math.random()` directly during list sorting.

Instead:

- hash `(seed + stableItemId)` into a numeric rank
- sort by that rank

This ensures:

- deterministic ordering for a given seed
- stable reproducibility for shared URLs
- no broken comparator behavior

---

## Query worker contract

### Input state

```ts
type QueryState = {
  q: string
  sort: "bookmarked" | "posted" | "random"
  dir: "asc" | "desc"
  mode: "one" | "all"
  preferMotion: boolean
  zoom: number
  keepSeed: boolean
  seed?: string
}
```

### Output result

```ts
type QueryResult = {
  total: number
  orderedGridIds: string[]
  appliedSeed?: string
}
```

### Worker responsibilities

- load or hydrate search index/store
- load precomputed orders
- apply search
- apply sort
- apply random seeded ranking when needed
- return final ordered ids and item count
- avoid blocking the main thread

---

## Grid design

### Library choice

Default recommendation:

- **Virtuoso Masonry**

Fallback options:

- **masonic**
- **react-virtualized Masonry**

### Requirements

- virtualization
- variable-height items
- responsive columns
- large dataset support
- compatibility with autoplay visibility logic
- compatibility with window scrolling

### Grid sizing / zoom

The zoom control should really control:

- **effective target item width / column width**, not arbitrary CSS scaling

Suggested implementation:

- maintain a numeric zoom scalar
- convert it into a target column width
- derive column count from viewport width and target width

This makes the masonry layout predictable and responsive.

### Result count

The toolbar must always show:

- total current grid items after search/filter/sort/mode selection

Note:

- in `mode=one`, count equals number of tweets shown
- in `mode=all`, count equals number of media items shown

---

## Media autoplay design

### Grid playback rules

For video / animated GIF items in the masonry grid:

- autoplay when item is in the active viewport band
- mute audio
- loop playback
- use `playsInline`
- pause when item leaves the active band
- prefer `preload="metadata"`

### Visibility logic

Use `IntersectionObserver` or an equivalent viewport-aware strategy:

- active band: visible region plus small prewarm margin
- play when entering active band
- pause when leaving active band

### Failure handling

Because browser autoplay can fail depending on policy/environment:

- gracefully handle rejected `play()` calls
- show a poster/fallback state if autoplay cannot start

### Performance rule

Do not allow too many simultaneous playing videos.

Implementation suggestion:

- cap concurrent autoplayed motion items
- prioritize items nearest the viewport center

---

## Lightbox design

### Required behavior

When a user clicks a tile:

- open a lightbox
- start on the clicked media item
- show other media from the same tweet in a carousel

### Lightbox content

The lightbox must display:

- media carousel
- tweet text
- tweet posted date
- likes
- replies
- reposts / retweets
- author display name
- author handle
- link to original tweet in a new tab

### Playable media

For video / animated GIF slides:

- support play/pause
- support normal lightbox controls
- maintain good inline performance

### Metadata mapping rule

The lightbox operates at the **tweet level**:

- the clicked tile identifies the tweet and selected media index
- the lightbox loads sibling media from that same tweet doc

---

## Storage strategy

Use three layers of storage.

### 1. In-memory state

Use for:

- active query state
- visible result ids
- lightweight maps and selectors

### 2. sessionStorage

Use for small per-tab ephemeral state only:

- current scroll snapshot
- currently open lightbox item
- ephemeral unpinned random seed if needed

Do **not** use sessionStorage for:

- large datasets
- full search index blobs
- media caches

### 3. IndexedDB

Use for heavier client-side caching where useful:

- normalized docs cache
- search index cache
- manifest/version marker
- lightweight poster/thumb metadata if needed

### Rule

The app must work without IndexedDB warming, but may use it to accelerate repeat loads.

---

## Data loading strategy

### Initial load

On app load:

1. load `manifest.json`
2. load required base datasets
3. lazy-load search artifacts when search/query needs them
4. initialize worker
5. hydrate from URL state

### Chunking

If tweet docs become large:

- keep docs chunked
- keep grid/order/search artifacts separate
- avoid a single giant monolithic JSON if that becomes unwieldy

### Recommended rule

The UI should not need full tweet docs to render the first visible grid items if lighter grid datasets already provide enough information.

That means:

- `grid/*.json` should contain enough item-level render info for grid rendering
- full tweet docs can be consulted on-demand for lightbox detail, or loaded up front if size remains acceptable

---

## Performance constraints

The system must be designed so that the following actions remain responsive on large datasets:

- typing in search box
- toggling one/all mode
- toggling prefer-motion mode
- changing sort mode
- entering random sort
- rerandomizing random seed
- scrolling long distances in the masonry grid
- opening the lightbox

### Performance rules

- no search on main thread if avoidable
- no full object-array resorting when precomputed order can be used
- no full React rerender of all visible+nonvisible items
- no layout thrash from media size discovery at scroll time if it can be precomputed
- representative media selection computed at export time

---

## Validation checkpoints

These are **checkpoints to validate existing functionality** after the agent builds the whole system.

They are not PRs and not intended as separate human implementation phases.

### Checkpoint 1 — Project shell is correct

Validate that:

- Bun is the package manager / runner
- Vite builds successfully
- shadcn/ui is initialized on **Radix**, not Base
- Tailwind works
- app runs locally
- GitHub Pages base path is configured correctly for the repo

### Checkpoint 2 — One-liner local refresh works

Validate that:

- `bun run refresh` succeeds locally
- fieldtheory data is stored under `./.data/fieldtheory`
- bookmark sync includes gaps and folders
- export runs
- validation runs
- static build completes
- command performs everything except commit/push

### Checkpoint 3 — Derived data is correct

Validate that:

- `public/data/manifest.json` exists and is internally consistent
- only media tweets are included for v1
- `grid/one.json` and `grid/all.json` are correct
- representative media indices are correct
- bookmarked/post-date order files are correct
- search artifacts exist and are loadable

### Checkpoint 4 — URL state is the source of truth

Validate that:

- page hydrates from URL params correctly
- changing toolbar state updates the URL immediately
- resetting a control to default removes its URL param
- invalid params are sanitized
- shared URLs recreate the same state

### Checkpoint 5 — Search works deeply

Validate that search matches against:

- tweet text
- quoted tweet text
- article title
- article text
- author fields
- folder names

Also validate:

- search results update quickly on a large dataset
- search work happens off the main thread

### Checkpoint 6 — Sort and random behavior are correct

Validate that:

- bookmarked order sort works
- posted date sort works
- random sort changes on refresh when seed is not pinned
- random sort persists when seed is pinned
- rerandomize changes the seed and resort order
- pinned rerandomize updates the seed in URL

### Checkpoint 7 — Grid behavior is correct

Validate that:

- masonry layout works
- virtualization is active
- zoom changes column/item sizing appropriately
- result count is correct
- one/all modes switch correctly
- prefer-motion selection works in one-per-tweet mode

### Checkpoint 8 — Media playback is correct

Validate that:

- video/GIF tiles autoplay when expected
- autoplay is muted and inline-safe
- playback pauses when items leave the active viewport band
- the app handles autoplay failures gracefully
- scrolling remains smooth with motion items present

### Checkpoint 9 — Lightbox is correct

Validate that:

- clicking a tile opens the selected media
- sibling media from the same tweet appear in the carousel
- metadata is correct
- original-tweet link opens correctly
- playable media can be played/paused in the lightbox

### Checkpoint 10 — Static deployment is correct

Validate that:

- GitHub Actions builds successfully using Bun
- `dist/` is uploaded and deployed to Pages
- deployed site reads static data correctly
- no raw fieldtheory cache is published
- public repo contains only derived assets

### Checkpoint 11 — Large dataset behavior is acceptable

Validate with the real dataset that:

- 10k bookmarks is comfortable
- search remains responsive
- long scrolling remains responsive
- mode/sort changes remain responsive
- lightbox opens without obvious lag
- memory behavior is acceptable

---

## Required `.gitignore` behavior

Must ignore:

```gitignore
.data/
dist/
node_modules/
```

Must **not** ignore:

- `public/data/**` because that is the derived dataset that should be committed for static hosting

---

## Deployment model

### Local responsibilities

The local machine is responsible for:

- running fieldtheory
- generating the derived dataset
- building the app for validation
- reviewing diffs

### GitHub Actions responsibilities

GitHub Actions is responsible for:

- installing dependencies with Bun
- building the app
- uploading `dist/`
- deploying GitHub Pages

### Deployment rule

Do not run fieldtheory sync in GitHub Actions as the default operating model.

Reason:

- the local one-liner is the source of truth for fresh data generation
- the public repo should receive already-derived data assets
- Actions should only build and publish the static site

---

## Exact implementation directives for the agent

1. **Use Bun + Vite.**
2. **Use shadcn/ui on Radix, not Base.**
3. **Implement `bun run refresh` as the canonical one-liner.**
4. **Store fieldtheory data under `./.data/fieldtheory` via `FT_DATA_DIR`.**
5. **Use a very high fieldtheory page cap.**
6. **Verify folder sync depth behavior and patch if needed so folders are fully included.**
7. **Publish only derived static assets into `public/data/`.**
8. **Use a worker for search/filter/sort query execution.**
9. **Use a virtualized masonry grid library, not a custom masonry implementation.**
10. **Support autoplaying video/GIF tiles in-grid with graceful fallback behavior.**
11. **Use a lightbox with mixed media carousel and tweet metadata.**
12. **Make URL params the source of truth for shareable state.**
13. **Remove URL params when values return to defaults.**
14. **Implement deterministic seeded random sorting.**
15. **Design for 10k bookmarks now and continued growth without re-architecture.**

---

## Optional future extensions after v1

- non-media bookmark mode
- folder filtering UI
- author filtering UI
- media type filters
- saved views/presets
- local poster/thumb generation step
- optional media mirroring strategy with explicit storage budget controls
- deeper analytics over bookmark corpus

