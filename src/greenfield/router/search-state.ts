import type {
  CommittedWallState,
  Density,
  FacetSelection,
  SortMode,
  ViewMode,
} from "../contracts/domain"

export const DEFAULT_COMPOSITION_SEED = "gallery"
export const DEFAULT_SORT: SortMode = "curated"
export const DEFAULT_VIEW_MODE: ViewMode = "asset"
export const DEFAULT_DENSITY: Density = "auto"

const sortModes = new Set<SortMode>(["curated", "random", "newest", "oldest"])
const viewModes = new Set<ViewMode>(["asset", "record", "hybrid"])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : ""
}

function normalizeFilters(value: unknown): FacetSelection[] {
  if (!Array.isArray(value)) return []

  const valuesById = new Map<string, Set<string>>()
  for (const candidate of value) {
    if (!isRecord(candidate)) continue

    const id = normalizeText(candidate.id)
    if (!id || !Array.isArray(candidate.values)) continue

    const values = valuesById.get(id) ?? new Set<string>()
    for (const rawValue of candidate.values) {
      const normalizedValue = normalizeText(rawValue)
      if (normalizedValue) values.add(normalizedValue)
    }
    if (values.size > 0) valuesById.set(id, values)
  }

  return [...valuesById]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([id, values]) => ({
      id,
      values: [...values].sort((left, right) => left.localeCompare(right)),
    }))
}

function normalizeSort(value: unknown): SortMode {
  return typeof value === "string" && sortModes.has(value as SortMode)
    ? (value as SortMode)
    : DEFAULT_SORT
}

function normalizeMode(value: unknown): ViewMode {
  return typeof value === "string" && viewModes.has(value as ViewMode)
    ? (value as ViewMode)
    : DEFAULT_VIEW_MODE
}

function normalizeDensity(value: unknown): Density {
  if (value === "auto" || value === undefined || value === null || value === "") {
    return DEFAULT_DENSITY
  }

  const candidate = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(candidate) || candidate < 0.6 || candidate > 1.75) {
    return DEFAULT_DENSITY
  }

  return Math.round(candidate * 1_000) / 1_000
}

function normalizeSeed(value: unknown): string {
  const seed = normalizeText(value)
  return seed ? seed.slice(0, 96) : DEFAULT_COMPOSITION_SEED
}

/**
 * The single validator used by TanStack Router and by URL helpers. It is
 * intentionally tolerant of malformed links and always returns renderable
 * application state.
 */
export function validateWallSearch(rawSearch: unknown): CommittedWallState {
  const search = isRecord(rawSearch) ? rawSearch : {}
  const similar = normalizeText(search.similar)

  return {
    q: normalizeText(search.q),
    filters: normalizeFilters(search.filters),
    sort: normalizeSort(search.sort),
    mode: normalizeMode(search.mode),
    seed: normalizeSeed(search.seed),
    density: normalizeDensity(search.density),
    ...(similar ? { similar } : {}),
  }
}

function encode(value: string): string {
  return encodeURIComponent(value).replaceAll("%20", "+")
}

function decodeFilter(rawFilter: string): { id: string; value: string } | undefined {
  const separator = rawFilter.indexOf(":")
  if (separator <= 0 || separator === rawFilter.length - 1) return undefined

  const id = rawFilter.slice(0, separator).trim()
  const value = rawFilter.slice(separator + 1).trim()
  return id && value ? { id, value } : undefined
}

/**
 * Parse the wire representation before route validation. Filters intentionally
 * use repeated, readable `filters=facet:value` entries instead of encoded JSON.
 */
export function parseWallSearch(searchString: string): Record<string, unknown> {
  const params = new URLSearchParams(
    searchString.startsWith("?") ? searchString.slice(1) : searchString,
  )
  const valuesById = new Map<string, string[]>()

  for (const rawFilter of params.getAll("filters")) {
    const filter = decodeFilter(rawFilter)
    if (!filter) continue
    const values = valuesById.get(filter.id) ?? []
    values.push(filter.value)
    valuesById.set(filter.id, values)
  }

  const filters = [...valuesById].map(([id, values]) => ({ id, values }))
  const raw: Record<string, unknown> = {
    q: params.get("q") ?? undefined,
    filters,
    sort: params.get("sort") ?? undefined,
    mode: params.get("mode") ?? undefined,
    seed: params.get("seed") ?? undefined,
    density: params.get("density") ?? undefined,
    similar: params.get("similar") ?? undefined,
  }

  return raw
}

/** Return a canonical, readable query string including its leading `?`. */
export function stringifyWallSearch(rawSearch: unknown): string {
  const search = validateWallSearch(rawSearch)
  const entries: string[] = []

  if (search.q) entries.push(`q=${encode(search.q)}`)
  for (const filter of search.filters) {
    for (const value of filter.values) {
      entries.push(`filters=${encode(filter.id)}:${encode(value)}`)
    }
  }
  entries.push(`sort=${encode(search.sort)}`)
  entries.push(`mode=${encode(search.mode)}`)
  entries.push(`seed=${encode(search.seed)}`)
  entries.push(`density=${encode(String(search.density))}`)
  if (search.similar) entries.push(`similar=${encode(search.similar)}`)

  return entries.length > 0 ? `?${entries.join("&")}` : ""
}

export function decodeWallSearch(searchString: string): CommittedWallState {
  return validateWallSearch(parseWallSearch(searchString))
}

export function createCompositionSeed(): string {
  const bytes = new Uint32Array(2)
  globalThis.crypto.getRandomValues(bytes)
  return [...bytes].map((value) => value.toString(36)).join("")
}
