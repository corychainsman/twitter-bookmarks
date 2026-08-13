import type {
  CommittedWallState,
  DiscoveryPage,
  FacetSelection,
  MediaAsset,
  MediaRecord,
  RenditionCandidate,
} from "../contracts/domain"
import type { ApiTransport } from "../contracts/interfaces"
import { discoveryRequestIdentity } from "./query-keys"

const TAGS = [
  "architecture",
  "design",
  "landscape",
  "motion",
  "portrait",
  "technology",
] as const
const SOURCES = ["Archive", "Field Notes", "Studio"] as const
const ASPECTS = [
  [4, 5],
  [3, 2],
  [1, 1],
  [16, 9],
  [2, 3],
] as const
const VIDEO_URL =
  "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4"
const SNAPSHOT_EXPIRES_AT = "2099-01-01T00:00:00.000Z"
const MOCK_NOW = Date.now()
const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1_000

function hashString(input: string): number {
  let hash = 2_166_136_261
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 16_777_619)
  }
  return hash >>> 0
}

function padded(value: number): string {
  return value.toString().padStart(3, "0")
}

function placeholderFor(id: string): string {
  const hue = hashString(id) % 360
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 24"><rect width="32" height="24" fill="hsl(${hue} 24% 17%)"/></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

function picsumCandidate(
  id: string,
  width: number,
  aspectWidth: number,
  aspectHeight: number,
): RenditionCandidate {
  const height = Math.round((width * aspectHeight) / aspectWidth)
  return {
    url: `https://picsum.photos/seed/${encodeURIComponent(id)}/${width}/${height}`,
    width,
    height,
    mimeType: "image/jpeg",
  }
}

function createAsset(recordNumber: number, assetNumber: number): MediaAsset {
  const recordId = `record-${padded(recordNumber)}`
  const id = `${recordId}-media-${assetNumber}`
  const aspect = ASPECTS[(recordNumber + assetNumber) % ASPECTS.length]
  if (!aspect) throw new Error("Mock aspect catalog cannot be empty")

  const [aspectWidth, aspectHeight] = aspect
  const width = 640 + (hashString(`width-${id}`) % 21) * 160
  const height = Math.round((width * aspectHeight) / aspectWidth)
  const kind = (recordNumber * 3 + assetNumber) % 11 === 0 ? "video" : "image"
  const wall = [320, 640, 960].map((candidateWidth) =>
    picsumCandidate(id, candidateWidth, aspectWidth, aspectHeight),
  )
  const lightbox = [1_280, 1_920].map((candidateWidth) =>
    picsumCandidate(id, candidateWidth, aspectWidth, aspectHeight),
  )

  return {
    id,
    recordId,
    kind,
    title: `Study ${padded(recordNumber)}.${assetNumber}`,
    description: `A deterministic ${kind} fixture for the greenfield media wall.`,
    width,
    height,
    placeholder: placeholderFor(id),
    wall,
    lightbox,
    ...(kind === "video"
      ? {
          poster: wall.at(-1),
          previewVideoUrl: VIDEO_URL,
        }
      : {}),
  }
}

export function createMockRecords(count = 96): MediaRecord[] {
  return Array.from({ length: count }, (_, recordIndex) => {
    const recordNumber = recordIndex + 1
    const assetCount = 1 + (hashString(`assets-${recordNumber}`) % 5)
    const assets = Array.from({ length: assetCount }, (_, assetIndex) =>
      createAsset(recordNumber, assetIndex + 1),
    )
    const primaryTag = TAGS[recordIndex % TAGS.length]
    const secondaryTag = TAGS[(recordIndex * 3 + 2) % TAGS.length]
    if (!primaryTag || !secondaryTag) throw new Error("Mock tag catalog cannot be empty")

    return {
      id: `record-${padded(recordNumber)}`,
      title: `${primaryTag[0]?.toUpperCase()}${primaryTag.slice(1)} study ${padded(recordNumber)}`,
      description: `An editorial collection exploring ${primaryTag} and ${secondaryTag}.`,
      sourceLabel: SOURCES[recordIndex % SOURCES.length] ?? SOURCES[0],
      authorUrl: `https://x.com/fixture_${recordNumber}`,
      sourceUrl: `https://x.com/fixture_${recordNumber}/status/${recordNumber}`,
      postedAt: new Date(MOCK_NOW - recordIndex * DAY_IN_MILLISECONDS).toISOString(),
      tags: [...new Set([primaryTag, secondaryTag])],
      assets,
      eligibleRepresentativeAssetIds: assets.map((asset) => asset.id),
    }
  })
}

function matchesFacet(record: MediaRecord, filter: FacetSelection): boolean {
  switch (filter.id) {
    case "kind":
      return record.assets.some((asset) => filter.values.includes(asset.kind))
    case "source":
      return filter.values.includes(record.sourceLabel)
    case "tag":
      return record.tags.some((tag) => filter.values.includes(tag))
    case "width":
      return filter.values.some((range) => {
        const [minimum, maximum] = range.split(":").map(Number)
        if (!Number.isFinite(minimum) || !Number.isFinite(maximum)) return false
        return record.assets.some(
          (asset) => asset.width >= minimum! && asset.width <= maximum!,
        )
      })
    case "date":
      return filter.values.some((value) => {
        const postedAt = Date.parse(record.postedAt)
        if (!Number.isFinite(postedAt)) return false
        if (value === "week") return postedAt >= MOCK_NOW - 7 * DAY_IN_MILLISECONDS
        if (value === "month") return postedAt >= MOCK_NOW - 30 * DAY_IN_MILLISECONDS
        if (value === "year") return postedAt >= MOCK_NOW - 365 * DAY_IN_MILLISECONDS
        if (!value.startsWith("custom:")) return false

        const [, from, to] = value.split(":")
        const fromTime = from ? Date.parse(`${from}T00:00:00.000Z`) : Number.NEGATIVE_INFINITY
        const toTime = to ? Date.parse(`${to}T23:59:59.999Z`) : Number.POSITIVE_INFINITY
        return Number.isFinite(fromTime) || Number.isFinite(toTime)
          ? postedAt >= fromTime && postedAt <= toTime
          : false
      })
    default:
      return false
  }
}

function searchRecords(
  records: MediaRecord[],
  state: CommittedWallState,
  filters = state.filters,
): MediaRecord[] {
  const terms = state.q.toLocaleLowerCase().split(/\s+/).filter(Boolean)
  const filtered = records.filter((record) => {
    const haystack = [
      record.title,
      record.description,
      record.sourceLabel,
      ...record.tags,
    ]
      .join(" ")
      .toLocaleLowerCase()
    const matchesQuery = terms.every((term) => haystack.includes(term))
    return matchesQuery && filters.every((filter) => matchesFacet(record, filter))
  })

  if (state.similar) {
    return filtered.toSorted(
      (left, right) =>
        hashString(`${state.similar}:${left.id}`) - hashString(`${state.similar}:${right.id}`),
    )
  }
  if (state.sort === "newest") {
    return filtered.toSorted((left, right) => right.postedAt.localeCompare(left.postedAt))
  }
  if (state.sort === "oldest") {
    return filtered.toSorted((left, right) => left.postedAt.localeCompare(right.postedAt))
  }
  if (state.sort === "random") {
    return filtered.toSorted(
      (left, right) =>
        hashString(`${state.seed}:${left.id}`) - hashString(`${state.seed}:${right.id}`),
    )
  }
  return filtered
}

function chooseRelaxedResults(
  records: MediaRecord[],
  state: CommittedWallState,
): { records: MediaRecord[]; relaxedFilters: FacetSelection[] } {
  for (let omittedIndex = 0; omittedIndex < state.filters.length; omittedIndex += 1) {
    const relaxedFilter = state.filters[omittedIndex]
    if (!relaxedFilter) continue
    const filters = state.filters.filter((_, index) => index !== omittedIndex)
    const candidates = searchRecords(records, state, filters)
    if (candidates.length > 0) return { records: candidates, relaxedFilters: [relaxedFilter] }
  }
  return { records: [], relaxedFilters: [] }
}

function querySignature(state: CommittedWallState): string {
  return hashString(JSON.stringify(discoveryRequestIdentity(state))).toString(36)
}

function cursorFor(signature: string, offset: number): string {
  return `mock_${signature}_${offset.toString(36)}`
}

function cursorOffset(cursor: string | undefined, expectedSignature: string): number {
  if (!cursor) return 0
  const match = /^mock_([a-z0-9]+)_([a-z0-9]+)$/i.exec(cursor)
  if (!match || match[1] !== expectedSignature) {
    throw new Error("The discovery cursor does not belong to this frozen result set")
  }

  const offset = Number.parseInt(match[2] ?? "", 36)
  if (!Number.isSafeInteger(offset) || offset < 0) throw new Error("Invalid discovery cursor")
  return offset
}

async function simulatedDelay(milliseconds: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) throw new DOMException("The request was aborted", "AbortError")
  if (milliseconds <= 0) return

  await new Promise<void>((resolve, reject) => {
    const timeout = globalThis.setTimeout(() => {
      signal?.removeEventListener("abort", onAbort)
      resolve()
    }, milliseconds)
    const onAbort = () => {
      globalThis.clearTimeout(timeout)
      signal?.removeEventListener("abort", onAbort)
      reject(new DOMException("The request was aborted", "AbortError"))
    }
    signal?.addEventListener("abort", onAbort, { once: true })
  })
}

export interface MockApiTransportOptions {
  latencyMs?: number
  pageSize?: number
  records?: MediaRecord[]
}

export function createMockApiTransport(options: MockApiTransportOptions = {}): ApiTransport {
  const latencyMs = options.latencyMs ?? 180
  const pageSize = Math.max(1, Math.floor(options.pageSize ?? 18))
  const records = options.records ?? createMockRecords()
  const mediaById = new Map(
    records.flatMap((record) => record.assets.map((asset) => [asset.id, asset] as const)),
  )

  return {
    async discover(state, cursor, signal): Promise<DiscoveryPage> {
      await simulatedDelay(latencyMs, signal)
      const signature = querySignature(state)
      const offset = cursorOffset(cursor, signature)
      const exactRecords = searchRecords(records, state)
      const fallback = exactRecords.length === 0 ? chooseRelaxedResults(records, state) : undefined
      const resultRecords = fallback?.records ?? exactRecords
      const pageRecords = resultRecords.slice(offset, offset + pageSize)

      return {
        records: pageRecords,
        ...(offset > 0
          ? { previousCursor: cursorFor(signature, Math.max(0, offset - pageSize)) }
          : {}),
        ...(offset + pageSize < resultRecords.length
          ? { nextCursor: cursorFor(signature, offset + pageSize) }
          : {}),
        snapshotExpiresAt: SNAPSHOT_EXPIRES_AT,
        exact: exactRecords.length > 0 || state.filters.length === 0,
        relaxedFilters: fallback?.relaxedFilters ?? [],
      }
    },

    async count(state, signal) {
      await simulatedDelay(Math.min(latencyMs, 90), signal)
      return { count: searchRecords(records, state).length }
    },

    async media(mediaId, signal) {
      await simulatedDelay(Math.min(latencyMs, 90), signal)
      const media = mediaById.get(mediaId)
      if (!media) throw new Error(`Unknown media asset: ${mediaId}`)
      const record = records.find((candidate) => candidate.id === media.recordId)
      if (!record) throw new Error(`Unknown media record: ${media.recordId}`)
      return { media, record }
    },

    async suggestSources(query, signal) {
      await simulatedDelay(Math.min(latencyMs, 90), signal)
      const normalizedQuery = query.trim().toLocaleLowerCase()
      const counts = new Map<string, number>()

      for (const record of records) {
        if (!record.sourceLabel.toLocaleLowerCase().includes(normalizedQuery)) continue
        counts.set(record.sourceLabel, (counts.get(record.sourceLabel) ?? 0) + 1)
      }

      return [...counts.entries()]
        .map(([id, count]) => ({ id, label: id, count }))
        .toSorted((left, right) => right.count - left.count || left.label.localeCompare(right.label))
        .slice(0, 20)
    },
  }
}

export const mockApiTransport = createMockApiTransport()
