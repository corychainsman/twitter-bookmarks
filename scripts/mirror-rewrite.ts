import type { ExportArtifacts } from './catalog/export-artifacts'
import type { GridItem, ImageRendition, MediaItem } from './catalog/model'
import type { MirrorAssetRecord, MirrorManifest } from './mirror-lib'

export const DEFAULT_MEDIA_BASE_URL = 'https://tbmedia.corychainsman.com'

export type MirrorRewriteStats = {
  totalUrls: number
  rewrittenUrls: number
  thumbhashedGridItems: number
  previewGridItems: number
}

type MirrorLookup = {
  urlFor(sourceUrl: string | undefined): string | undefined
  recordFor(sourceUrl: string | undefined): MirrorAssetRecord | undefined
}

function imageRenditionsFor(
  record: MirrorAssetRecord | undefined,
  baseUrl: string,
): ImageRendition[] | undefined {
  if (!record?.variants?.length) {
    return undefined
  }

  return record.variants
    .map((variant) => ({
      url: `${baseUrl}/${variant.key}${variant.digest ? `?v=${variant.digest}` : ''}`,
      width: variant.width,
      ...(variant.height ? { height: variant.height } : {}),
      ...(variant.bytes ? { bytes: variant.bytes } : {}),
      ...(variant.digest ? { digest: variant.digest } : {}),
      contentType: variant.contentType ?? ('image/avif' as const),
    }))
    .sort((left, right) => left.width - right.width)
}

function createMirrorLookup(manifest: MirrorManifest, baseUrl: string): MirrorLookup {
  const normalizedBase = baseUrl.replace(/\/+$/, '')

  function recordFor(sourceUrl: string | undefined): MirrorAssetRecord | undefined {
    if (!sourceUrl) {
      return undefined
    }
    const record = manifest.assets[sourceUrl]
    return record?.status === 'ok' ? record : undefined
  }

  return {
    recordFor,
    urlFor(sourceUrl) {
      const record = recordFor(sourceUrl)
      return record
        ? `${normalizedBase}/${record.key}${record.digest ? `?v=${record.digest}` : ''}`
        : undefined
    },
  }
}

function rewriteMediaItem(
  media: MediaItem,
  lookup: MirrorLookup,
  baseUrl: string,
  stats: MirrorRewriteStats,
): void {
  const originalFullUrl = media.fullUrl
  const imageRecord =
    media.type === 'photo'
      ? lookup.recordFor(media.fullUrl) ?? lookup.recordFor(media.thumbUrl)
      : lookup.recordFor(media.posterUrl) ?? lookup.recordFor(media.thumbUrl)
  media.imageRenditions = imageRenditionsFor(imageRecord, baseUrl)

  for (const field of ['thumbUrl', 'fullUrl', 'posterUrl'] as const) {
    const sourceUrl = media[field]
    if (!sourceUrl) {
      continue
    }
    stats.totalUrls += 1
    const mirroredUrl = lookup.urlFor(sourceUrl)
    if (mirroredUrl) {
      media[field] = mirroredUrl
      stats.rewrittenUrls += 1
    }
  }

  if (media.fullUrl !== originalFullUrl) {
    media.originUrl = originalFullUrl
  }
}

function rewriteGridItem(
  item: GridItem,
  lookup: MirrorLookup,
  baseUrl: string,
  stats: MirrorRewriteStats,
): void {
  // The tile image is thumbUrl for photos and the poster for motion media; grab
  // its thumbhash before the URLs are rewritten away from the manifest keys.
  const tileRecord = lookup.recordFor(item.thumbUrl) ?? lookup.recordFor(item.posterUrl)
  item.imageRenditions = imageRenditionsFor(tileRecord, baseUrl)
  if (tileRecord?.thumbhash) {
    item.thumbhash = tileRecord.thumbhash
    stats.thumbhashedGridItems += 1
  }

  // Capture the autoplay preview clip from the video record (keyed by the
  // original fullUrl) before fullUrl is rewritten to the mirror base.
  const videoRecord = lookup.recordFor(item.fullUrl)
  if (videoRecord?.previewKey) {
    item.previewUrl = `${baseUrl}/${videoRecord.previewKey}`
    stats.previewGridItems += 1
  }

  for (const field of ['thumbUrl', 'fullUrl', 'posterUrl'] as const) {
    const sourceUrl = item[field]
    if (!sourceUrl) {
      continue
    }
    stats.totalUrls += 1
    const mirroredUrl = lookup.urlFor(sourceUrl)
    if (mirroredUrl) {
      item[field] = mirroredUrl
      stats.rewrittenUrls += 1
    }
  }
}

export function applyMirrorRewrite(
  artifacts: ExportArtifacts,
  manifest: MirrorManifest,
  baseUrl: string = DEFAULT_MEDIA_BASE_URL,
): MirrorRewriteStats {
  const normalizedBase = baseUrl.replace(/\/+$/, '')
  const lookup = createMirrorLookup(manifest, normalizedBase)
  const stats: MirrorRewriteStats = {
    totalUrls: 0,
    rewrittenUrls: 0,
    thumbhashedGridItems: 0,
    previewGridItems: 0,
  }

  for (const chunk of artifacts.docsChunks) {
    for (const doc of chunk.docs) {
      for (const media of doc.media) {
        rewriteMediaItem(media, lookup, normalizedBase, stats)
      }
    }
  }

  for (const item of [...artifacts.gridOne, ...artifacts.gridAll]) {
    rewriteGridItem(item, lookup, normalizedBase, stats)
  }

  artifacts.manifest.mediaBaseUrl = normalizedBase
  artifacts.manifest.mediaCatalogVersion = 2

  return stats
}
