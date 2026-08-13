import { readFile } from 'node:fs/promises'

export const SEMANTIC_ENRICHMENT_VERSION = 1

export type MediaSemanticEnrichment = {
  sourceUrl: string
  updatedAt: string
  captions?: string[]
  ocrText?: string
  transcript?: string
}

export type SemanticEnrichmentFile = {
  version: typeof SEMANTIC_ENRICHMENT_VERSION
  media: Record<string, MediaSemanticEnrichment>
}

function useful(value: string | undefined): value is string {
  return Boolean(value?.trim())
}

export function enrichmentText(entry: MediaSemanticEnrichment): string[] {
  return [...new Set([
    ...(entry.captions ?? []),
    entry.ocrText,
    entry.transcript,
  ].filter(useful).map((value) => value.trim()))]
}

export async function readSemanticEnrichment(
  filePath: string,
): Promise<SemanticEnrichmentFile> {
  try {
    const parsed = JSON.parse(await readFile(filePath, 'utf8')) as SemanticEnrichmentFile
    if (parsed.version !== SEMANTIC_ENRICHMENT_VERSION || !parsed.media) {
      throw new Error(`Unsupported semantic enrichment version in ${filePath}`)
    }
    return parsed
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { version: SEMANTIC_ENRICHMENT_VERSION, media: {} }
    }
    throw error
  }
}

export function enrichmentTextByGridId(
  enrichment: SemanticEnrichmentFile,
): ReadonlyMap<string, readonly string[]> {
  return new Map(
    Object.entries(enrichment.media).map(([gridId, entry]) => [gridId, enrichmentText(entry)]),
  )
}

