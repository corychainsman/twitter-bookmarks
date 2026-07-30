interface CatalogManifest {
  buildId: string
  builtAt: string
  chunkSize: number
  files: {
    docs: string[]
    gridAll: string
    orderBookmarked: string
    orderPosted: string
    searchStore: string
  }
}

interface CatalogRendition {
  url: string
  width: number
  height: number
  contentType: string
}

interface CatalogGridItem {
  gridId: string
  tweetId: string
  mediaIndex: number
  mediaType: "photo" | "video" | "animated_gif"
  thumbUrl: string
  fullUrl: string
  posterUrl?: string
  previewUrl?: string
  width: number
  height: number
  imageRenditions?: CatalogRendition[]
  thumbhash?: string
}

interface CatalogSearchEntry {
  id: string
  text: string
  quotedText?: string
  articleTitle?: string
  articleText?: string
  authorName: string
  authorHandle: string
  folderNames: string
}

interface CatalogDocument extends Omit<CatalogSearchEntry, "folderNames"> {
  url: string
  postedAt: string
  folderNames: string[]
}

interface FacetSelection {
  id: string
  values: string[]
}

interface RenditionCandidate {
  url: string
  width: number
  height: number
  mimeType: string
}

interface MediaAsset {
  id: string
  recordId: string
  kind: "image" | "video"
  title: string
  description: string
  width: number
  height: number
  placeholder: string
  wall: RenditionCandidate[]
  lightbox: RenditionCandidate[]
  poster?: RenditionCandidate
  previewVideoUrl?: string
}

interface MediaRecord {
  id: string
  title: string
  description: string
  sourceLabel: string
  authorUrl: string
  sourceUrl: string
  postedAt: string
  tags: string[]
  assets: MediaAsset[]
  eligibleRepresentativeAssetIds: string[]
}

interface CatalogIndex {
  origin: string
  manifest: CatalogManifest
  gridItems: CatalogGridItem[]
  mediaById: Map<string, CatalogGridItem>
  mediaByRecord: Map<string, CatalogGridItem[]>
  searchById: Map<string, CatalogSearchEntry>
  bookmarkedOrder: string[]
  postedOrder: string[]
  bookmarkedRank: Map<string, number>
  sourceCounts: Map<string, { label: string; count: number }>
}

interface DiscoveryRequest {
  q: string
  filters: FacetSelection[]
  sort: "curated" | "random" | "newest" | "oldest"
  seed: string
  similar?: string
}

export interface CatalogSocialMetadata {
  title: string
  description: string
  imageUrl: string
  videoUrl?: string
}

const PAGE_SIZE = 24
const SNAPSHOT_LIFETIME_MS = 7 * 24 * 60 * 60 * 1_000
const catalogPromises = new Map<string, Promise<CatalogIndex>>()
const documentChunkPromises = new Map<string, Promise<Map<string, CatalogDocument>>>()

function normalizedOrigin(origin: string): string {
  const url = new URL(origin)
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("DATA_ORIGIN must be an HTTP URL")
  }
  url.pathname = `${url.pathname.replace(/\/$/, "")}/`
  url.search = ""
  url.hash = ""
  return url.toString()
}

function artifactUrl(origin: string, path: string): string {
  return new URL(path.replace(/^\//, ""), normalizedOrigin(origin)).toString()
}

function versionedArtifactUrl(origin: string, path: string, buildId: string): string {
  const url = new URL(artifactUrl(origin, path))
  url.searchParams.set("catalog", buildId)
  return url.toString()
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(new Request(url, {
    headers: { accept: "application/json" },
  }))
  if (!response.ok) throw new Error(`Catalog request failed (${response.status}): ${url}`)
  return response.json() as Promise<T>
}

function mediaId(item: CatalogGridItem): string {
  return item.gridId || `${item.tweetId}:${item.mediaIndex}`
}

function sourceLabel(entry: CatalogSearchEntry): string {
  return entry.authorHandle ? `@${entry.authorHandle.replace(/^@/, "")}` : entry.authorName
}

function xAuthorUrl(entry: CatalogSearchEntry): string {
  return `https://x.com/${encodeURIComponent(entry.authorHandle.replace(/^@/, ""))}`
}

async function createCatalog(origin: string): Promise<CatalogIndex> {
  const normalized = normalizedOrigin(origin)
  const manifest = await fetchJson<CatalogManifest>(versionedArtifactUrl(
    normalized,
    "manifest.json",
    Date.now().toString(36),
  ))
  const [gridItems, searchEntries, bookmarkedOrder, postedOrder] = await Promise.all([
    fetchJson<CatalogGridItem[]>(versionedArtifactUrl(normalized, manifest.files.gridAll, manifest.buildId)),
    fetchJson<CatalogSearchEntry[]>(versionedArtifactUrl(normalized, manifest.files.searchStore, manifest.buildId)),
    fetchJson<string[]>(versionedArtifactUrl(normalized, manifest.files.orderBookmarked, manifest.buildId)),
    fetchJson<string[]>(versionedArtifactUrl(normalized, manifest.files.orderPosted, manifest.buildId)),
  ])
  const mediaByRecord = new Map<string, CatalogGridItem[]>()
  const mediaById = new Map<string, CatalogGridItem>()

  for (const item of gridItems) {
    mediaById.set(mediaId(item), item)
    const recordMedia = mediaByRecord.get(item.tweetId) ?? []
    recordMedia.push(item)
    mediaByRecord.set(item.tweetId, recordMedia)
  }
  for (const items of mediaByRecord.values()) {
    items.sort((left, right) => left.mediaIndex - right.mediaIndex)
  }

  const searchById = new Map(searchEntries.map((entry) => [entry.id, entry]))
  const sourceCounts = new Map<string, { label: string; count: number }>()
  for (const entry of searchEntries) {
    const id = sourceLabel(entry)
    const current = sourceCounts.get(id)
    sourceCounts.set(id, { label: id, count: (current?.count ?? 0) + 1 })
  }

  return {
    origin: normalized,
    manifest,
    gridItems,
    mediaById,
    mediaByRecord,
    searchById,
    bookmarkedOrder,
    postedOrder,
    bookmarkedRank: new Map(bookmarkedOrder.map((id, index) => [id, index])),
    sourceCounts,
  }
}

async function loadCatalog(origin: string): Promise<CatalogIndex> {
  const normalized = normalizedOrigin(origin)
  const current = catalogPromises.get(normalized)
  if (current) return current

  const promise = createCatalog(normalized).catch((error) => {
    catalogPromises.delete(normalized)
    throw error
  })
  catalogPromises.set(normalized, promise)
  return promise
}

async function loadDocumentChunk(catalog: CatalogIndex, chunkIndex: number) {
  const path = catalog.manifest.files.docs[chunkIndex]
  if (!path) return new Map<string, CatalogDocument>()
  const key = `${catalog.origin}\u001f${catalog.manifest.buildId}\u001f${chunkIndex}`
  const current = documentChunkPromises.get(key)
  if (current) return current

  const promise = fetchJson<CatalogDocument[]>(versionedArtifactUrl(
    catalog.origin,
    path,
    catalog.manifest.buildId,
  ))
    .then((documents) => new Map(documents.map((document) => [document.id, document])))
    .catch((error) => {
      documentChunkPromises.delete(key)
      throw error
    })
  documentChunkPromises.set(key, promise)
  return promise
}

async function loadDocuments(catalog: CatalogIndex, ids: string[]) {
  const chunkIndexes = [...new Set(ids.flatMap((id) => {
    const rank = catalog.bookmarkedRank.get(id)
    return rank === undefined ? [] : [Math.floor(rank / catalog.manifest.chunkSize)]
  }))]
  const chunks = await Promise.all(chunkIndexes.map((index) => loadDocumentChunk(catalog, index)))
  const documents = new Map<string, CatalogDocument>()
  for (const chunk of chunks) {
    for (const id of ids) {
      const document = chunk.get(id)
      if (document) documents.set(id, document)
    }
  }
  return documents
}

async function loadAllDocuments(catalog: CatalogIndex) {
  const chunks = await Promise.all(
    catalog.manifest.files.docs.map((_, index) => loadDocumentChunk(catalog, index)),
  )
  return new Map(chunks.flatMap((chunk) => [...chunk.entries()]))
}

function parseFilters(values: string[]): FacetSelection[] {
  const grouped = new Map<string, string[]>()
  for (const token of values) {
    const separator = token.indexOf(":")
    if (separator <= 0) continue
    const id = token.slice(0, separator)
    const value = token.slice(separator + 1)
    if (!value) continue
    const entries = grouped.get(id) ?? []
    entries.push(value)
    grouped.set(id, entries)
  }
  return [...grouped.entries()].map(([id, entries]) => ({ id, values: entries }))
}

function parseDiscoveryRequest(url: URL): DiscoveryRequest {
  const sort = url.searchParams.get("sort")
  const seed = (url.searchParams.get("seed") ?? "gallery").trim().slice(0, 96) || "gallery"
  return {
    q: (url.searchParams.get("q") ?? "").trim().replace(/\s+/g, " "),
    filters: parseFilters(url.searchParams.getAll("filter")),
    sort: sort === "random" || sort === "newest" || sort === "oldest" ? sort : "curated",
    seed,
    ...(url.searchParams.get("similar")
      ? { similar: url.searchParams.get("similar") ?? undefined }
      : {}),
  }
}

function entryHaystack(entry: CatalogSearchEntry): string {
  return [
    entry.text,
    entry.quotedText,
    entry.articleTitle,
    entry.articleText,
    entry.authorName,
    entry.authorHandle,
    entry.folderNames,
  ].filter(Boolean).join(" ").toLocaleLowerCase()
}

function matchesNonDateFilter(
  catalog: CatalogIndex,
  recordId: string,
  filter: FacetSelection,
): boolean {
  const entry = catalog.searchById.get(recordId)
  const media = catalog.mediaByRecord.get(recordId) ?? []

  switch (filter.id) {
    case "kind":
      return media.some((item) => filter.values.includes(
        item.mediaType === "photo" ? "image" : "video",
      ))
    case "source":
      return Boolean(entry && filter.values.includes(sourceLabel(entry)))
    case "width":
      return filter.values.some((value) => {
        const [minimum, maximum] = value.split(":").map(Number)
        return Number.isFinite(minimum) && Number.isFinite(maximum)
          && media.some((item) => item.width >= minimum! && item.width <= maximum!)
      })
    default:
      return filter.id === "date"
  }
}

function matchesDate(document: CatalogDocument | undefined, values: string[]): boolean {
  if (!document) return false
  const postedAt = Date.parse(document.postedAt)
  if (!Number.isFinite(postedAt)) return false
  const now = Date.now()

  return values.some((value) => {
    if (value === "week") return postedAt >= now - 7 * 86_400_000
    if (value === "month") return postedAt >= now - 30 * 86_400_000
    if (value === "year") return postedAt >= now - 365 * 86_400_000
    if (!value.startsWith("custom:")) return false
    const [, from, to] = value.split(":")
    const minimum = from ? Date.parse(`${from}T00:00:00.000Z`) : Number.NEGATIVE_INFINITY
    const maximum = to ? Date.parse(`${to}T23:59:59.999Z`) : Number.POSITIVE_INFINITY
    return postedAt >= minimum && postedAt <= maximum
  })
}

async function matchingIds(
  catalog: CatalogIndex,
  request: DiscoveryRequest,
  filters = request.filters,
): Promise<string[]> {
  const terms = request.q.toLocaleLowerCase().split(/\s+/).filter(Boolean)
  const dateFilters = filters.filter((filter) => filter.id === "date")
  const documents = dateFilters.length > 0 ? await loadAllDocuments(catalog) : undefined
  const order = request.sort === "newest"
    ? catalog.postedOrder
    : request.sort === "oldest"
      ? [...catalog.postedOrder].reverse()
      : catalog.bookmarkedOrder
  const filtered = order.filter((id) => {
    const entry = catalog.searchById.get(id)
    if (!entry || !catalog.mediaByRecord.has(id)) return false
    if (!terms.every((term) => entryHaystack(entry).includes(term))) return false
    return filters.every((filter) => filter.id === "date"
      ? matchesDate(documents?.get(id), filter.values)
      : matchesNonDateFilter(catalog, id, filter))
  })

  if (!request.similar) {
    return request.sort === "random"
      ? filtered.toSorted(
          (left, right) => hash(`${request.seed}:${left}`) - hash(`${request.seed}:${right}`),
        )
      : filtered
  }
  return filtered.toSorted(
    (left, right) => hash(`${request.similar}:${left}`) - hash(`${request.similar}:${right}`),
  )
}

function hash(value: string): number {
  let result = 2_166_136_261
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index)
    result = Math.imul(result, 16_777_619)
  }
  return result >>> 0
}

function cursorSignature(request: DiscoveryRequest): string {
  return hash(JSON.stringify(request)).toString(36)
}

function encodeCursor(catalog: CatalogIndex, request: DiscoveryRequest, offset: number): string {
  return `catalog_${hash(catalog.manifest.buildId).toString(36)}_${cursorSignature(request)}_${offset.toString(36)}`
}

function decodeCursor(catalog: CatalogIndex, request: DiscoveryRequest, cursor?: string): number {
  if (!cursor) return 0
  const match = /^catalog_([a-z0-9]+)_([a-z0-9]+)_([a-z0-9]+)$/i.exec(cursor)
  if (
    !match
    || match[1] !== hash(catalog.manifest.buildId).toString(36)
    || match[2] !== cursorSignature(request)
  ) {
    throw new Error("cursor_expired")
  }
  const offset = Number.parseInt(match[3] ?? "", 36)
  if (!Number.isSafeInteger(offset) || offset < 0) throw new Error("invalid_cursor")
  return offset
}

function rendition(candidate: CatalogRendition): RenditionCandidate {
  return {
    url: candidate.url,
    width: candidate.width,
    height: candidate.height,
    mimeType: candidate.contentType,
  }
}

function displayPostText(value: string): string {
  return value.replace(/https?:\/\/t\.co\/\S+/g, "").trim()
}

function itemAsset(item: CatalogGridItem, entry: CatalogSearchEntry): MediaAsset {
  const id = mediaId(item)
  const kind = item.mediaType === "photo" ? "image" : "video"
  const wall = (item.imageRenditions ?? []).map(rendition)
  if (wall.length === 0) {
    wall.push({
      url: item.posterUrl ?? item.thumbUrl,
      width: item.width,
      height: item.height,
      mimeType: "image/jpeg",
    })
  }
  const lightbox = [...wall]
  if (item.fullUrl && !lightbox.some((candidate) => candidate.url === item.fullUrl)) {
    lightbox.push({
      url: item.fullUrl,
      width: item.width,
      height: item.height,
      mimeType: kind === "video" ? "video/mp4" : "image/jpeg",
    })
  }
  const title = `${entry.authorName || entry.authorHandle} — media ${item.mediaIndex + 1}`

  return {
    id,
    recordId: item.tweetId,
    kind,
    title,
    description: displayPostText(entry.text || entry.articleTitle || entry.quotedText || ""),
    width: item.width,
    height: item.height,
    placeholder: item.thumbhash ?? "",
    wall,
    lightbox,
    ...(kind === "video" ? { poster: wall.at(-1) } : {}),
    ...(item.previewUrl ? { previewVideoUrl: item.previewUrl } : {}),
  }
}

function recordTitle(entry: CatalogSearchEntry): string {
  const text = displayPostText(entry.articleTitle || entry.text || entry.quotedText || "")
  if (text) return text.length > 120 ? `${text.slice(0, 117)}…` : text
  return `${entry.authorName || entry.authorHandle} on X`
}

function createRecord(
  catalog: CatalogIndex,
  id: string,
  document?: CatalogDocument,
): MediaRecord | undefined {
  const entry = catalog.searchById.get(id)
  const items = catalog.mediaByRecord.get(id)
  if (!entry || !items?.length) return undefined
  const assets = items.map((item) => itemAsset(item, entry))
  const postedAt = document ? new Date(document.postedAt).toISOString() : catalog.manifest.builtAt
  const tags = document?.folderNames ?? entry.folderNames.split(/\s*,\s*/).filter(Boolean)

  return {
    id,
    title: recordTitle(entry),
    description: [entry.text, entry.quotedText, entry.articleTitle, entry.articleText]
      .filter((value): value is string => Boolean(value))
      .map(displayPostText).filter(Boolean).join("\n\n"),
    sourceLabel: sourceLabel(entry),
    authorUrl: xAuthorUrl(entry),
    sourceUrl: document?.url ?? `https://x.com/i/status/${encodeURIComponent(id)}`,
    postedAt,
    tags,
    assets,
    eligibleRepresentativeAssetIds: assets.map((asset) => asset.id),
  }
}

function json(data: unknown, status = 200, cacheControl = "no-store"): Response {
  return Response.json(data, {
    status,
    headers: {
      "cache-control": cacheControl,
      "content-type": "application/json; charset=utf-8",
      "x-content-type-options": "nosniff",
    },
  })
}

function apiError(status: number, code: string, message: string): Response {
  return json({ code, message, requestId: crypto.randomUUID() }, status)
}

async function discovery(catalog: CatalogIndex, url: URL): Promise<Response> {
  const request = parseDiscoveryRequest(url)
  let offset: number
  try {
    offset = decodeCursor(catalog, request, url.searchParams.get("cursor") ?? undefined)
  } catch (error) {
    const code = error instanceof Error ? error.message : "invalid_cursor"
    return apiError(code === "cursor_expired" ? 410 : 400, code, "The discovery cursor is no longer valid.")
  }

  const exactIds = await matchingIds(catalog, request)
  let ids = exactIds
  let relaxedFilters: FacetSelection[] = []
  if (ids.length === 0 && request.filters.length > 0) {
    for (let index = 0; index < request.filters.length; index += 1) {
      const candidateFilters = request.filters.filter((_, filterIndex) => filterIndex !== index)
      const candidates = await matchingIds(catalog, request, candidateFilters)
      if (candidates.length > 0) {
        ids = candidates
        relaxedFilters = request.filters[index] ? [request.filters[index]!] : []
        break
      }
    }
  }

  const pageIds = ids.slice(offset, offset + PAGE_SIZE)
  const documents = await loadDocuments(catalog, pageIds)
  const records = pageIds.flatMap((id) => {
    const record = createRecord(catalog, id, documents.get(id))
    return record ? [record] : []
  })
  const snapshotExpiresAt = new Date(Date.now() + SNAPSHOT_LIFETIME_MS).toISOString()

  return json({
    records,
    ...(offset > 0
      ? { previousCursor: encodeCursor(catalog, request, Math.max(0, offset - PAGE_SIZE)) }
      : {}),
    ...(offset + PAGE_SIZE < ids.length
      ? { nextCursor: encodeCursor(catalog, request, offset + PAGE_SIZE) }
      : {}),
    snapshotExpiresAt,
    exact: exactIds.length > 0 || request.filters.length === 0,
    relaxedFilters,
  }, 200, "private, max-age=15")
}

async function count(catalog: CatalogIndex, url: URL): Promise<Response> {
  const ids = await matchingIds(catalog, parseDiscoveryRequest(url))
  return json({ count: ids.length }, 200, "private, max-age=15")
}

function decodeMediaId(value: string): string | undefined {
  try {
    const decoded = decodeURIComponent(value)
    return decoded && !decoded.includes("/") && decoded.length <= 256 ? decoded : undefined
  } catch {
    return undefined
  }
}

async function mediaResponse(catalog: CatalogIndex, encodedId: string): Promise<Response> {
  const id = decodeMediaId(encodedId)
  const item = id ? catalog.mediaById.get(id) : undefined
  const entry = item ? catalog.searchById.get(item.tweetId) : undefined
  if (!item || !entry) return apiError(404, "not_found", "Media was not found.")
  const documents = await loadDocuments(catalog, [item.tweetId])
  const record = createRecord(catalog, item.tweetId, documents.get(item.tweetId))
  if (!record) return apiError(404, "not_found", "Media record was not found.")
  return json({ media: itemAsset(item, entry), record }, 200, "public, max-age=60, stale-while-revalidate=300")
}

function sourceSuggestions(catalog: CatalogIndex, url: URL): Response {
  const query = (url.searchParams.get("q") ?? "").trim().toLocaleLowerCase()
  const values = [...catalog.sourceCounts.entries()]
    .filter(([id, value]) => `${id} ${value.label}`.toLocaleLowerCase().includes(query))
    .map(([id, value]) => ({ id, label: value.label, count: value.count }))
    .toSorted((left, right) => right.count - left.count || left.label.localeCompare(right.label))
    .slice(0, 20)
  return json({ values }, 200, "public, max-age=300")
}

export async function getCatalogSocialMetadata(
  origin: string,
  mediaIdValue: string,
): Promise<CatalogSocialMetadata | undefined> {
  const catalog = await loadCatalog(origin)
  const item = catalog.mediaById.get(mediaIdValue)
  const entry = item ? catalog.searchById.get(item.tweetId) : undefined
  if (!item || !entry) return undefined
  const asset = itemAsset(item, entry)
  return {
    title: asset.title,
    description: asset.description || recordTitle(entry),
    imageUrl: asset.poster?.url ?? asset.wall.at(-1)?.url ?? item.thumbUrl,
    ...(asset.kind === "video" && item.fullUrl ? { videoUrl: item.fullUrl } : {}),
  }
}

export async function handleCatalogApi(request: Request, origin: string): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response(null, { status: 405, headers: { allow: "GET, HEAD" } })
  }
  const url = new URL(request.url)
  const path = url.pathname.replace(/^\/api/, "") || "/"

  try {
    const catalog = await loadCatalog(origin)
    let response: Response

    if (path === "/discovery") response = await discovery(catalog, url)
    else if (path === "/discovery/count") response = await count(catalog, url)
    else if (path === "/facets/source/values") response = sourceSuggestions(catalog, url)
    else if (path === "/suggestions") response = json({ suggestions: [] }, 200, "public, max-age=300")
    else if (path === "/configuration") {
      response = json({
        sorts: [
          { id: "curated", label: "Curated", default: true },
          { id: "random", label: "Random" },
          { id: "newest", label: "Newest" },
          { id: "oldest", label: "Oldest" },
        ],
      }, 200, "public, max-age=300")
    } else {
      const socialMatch = path.match(/^\/media\/([^/]+)\/social$/)
      const mediaMatch = path.match(/^\/media\/([^/]+)$/)
      if (socialMatch) {
        const id = decodeMediaId(socialMatch[1] ?? "")
        const metadata = id ? await getCatalogSocialMetadata(origin, id) : undefined
        response = metadata
          ? json(metadata, 200, "public, max-age=60, stale-while-revalidate=300")
          : apiError(404, "not_found", "Media was not found.")
      } else {
        response = mediaMatch
          ? await mediaResponse(catalog, mediaMatch[1] ?? "")
          : apiError(404, "not_found", "API route was not found.")
      }
    }

    return request.method === "HEAD"
      ? new Response(null, { status: response.status, headers: response.headers })
      : response
  } catch {
    return apiError(502, "upstream_unavailable", "The production catalog is unavailable.")
  }
}
