import type { RenditionCandidate } from "../../contracts/domain"

const MIME_PRIORITY: Record<string, number> = {
  "image/avif": 0,
  "image/webp": 1,
  "image/jpeg": 2,
  "image/png": 3,
}

const FALLBACK_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
])

export interface RenditionSource {
  mimeType: string
  candidates: RenditionCandidate[]
  srcSet: string
}

export interface ResponsiveRenditions {
  fallback: RenditionSource | undefined
  sources: RenditionSource[]
  src: string | undefined
}

function validCandidate(candidate: RenditionCandidate): boolean {
  return candidate.url.length > 0
    && candidate.width > 0
    && candidate.height > 0
    && candidate.mimeType.startsWith("image/")
}

function sourceSet(candidates: RenditionCandidate[]): string {
  return candidates.map((candidate) => `${candidate.url} ${candidate.width}w`).join(", ")
}

export function buildResponsiveRenditions(
  candidates: RenditionCandidate[],
): ResponsiveRenditions {
  const groups = new Map<string, Map<number, RenditionCandidate>>()

  for (const candidate of candidates) {
    if (!validCandidate(candidate)) {
      continue
    }

    const byWidth = groups.get(candidate.mimeType) ?? new Map<number, RenditionCandidate>()
    if (!byWidth.has(candidate.width)) {
      byWidth.set(candidate.width, candidate)
    }
    groups.set(candidate.mimeType, byWidth)
  }

  const sources = [...groups.entries()]
    .map(([mimeType, byWidth]): RenditionSource => {
      const sortedCandidates = [...byWidth.values()].toSorted(
        (left, right) => left.width - right.width,
      )

      return {
        mimeType,
        candidates: sortedCandidates,
        srcSet: sourceSet(sortedCandidates),
      }
    })
    .toSorted((left, right) => {
      const leftPriority = MIME_PRIORITY[left.mimeType] ?? 10
      const rightPriority = MIME_PRIORITY[right.mimeType] ?? 10

      return leftPriority - rightPriority || left.mimeType.localeCompare(right.mimeType)
    })

  const fallback = sources.find((source) => FALLBACK_MIME_TYPES.has(source.mimeType))
    ?? sources.at(-1)
  const largestFallback = fallback?.candidates.at(-1)

  return {
    fallback,
    sources: sources.filter((source) => source !== fallback),
    src: largestFallback?.url,
  }
}
