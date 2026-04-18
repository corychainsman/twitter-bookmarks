import MiniSearch from 'minisearch'

import type {
  GridItem,
  Manifest,
  MediaItem,
  MediaType,
  RawBookmarkRecord,
  RawMediaObject,
  TweetDoc,
} from '@/features/bookmarks/model'

export type SearchArtifacts = {
  searchIndex: unknown
  searchStore: SearchStoreEntry[]
}

export type CoreArtifacts = {
  manifest: Manifest
  docsChunks: Array<{
    fileName: string
    docs: TweetDoc[]
  }>
  gridOne: GridItem[]
  gridAll: GridItem[]
  orderBookmarked: string[]
  orderPosted: string[]
}

export type ExportArtifacts = CoreArtifacts & SearchArtifacts

export type BuildExportArtifactsOptions = {
  buildId: string
  builtAt: string
  chunkSize?: number
}

export type SearchStoreEntry = {
  id: string
  text: string
  quotedText: string
  articleTitle: string
  articleText: string
  authorName: string
  authorHandle: string
  folderNames: string
}

const DEFAULT_CHUNK_SIZE = 500
export const BOOKMARK_SEARCH_FIELDS = [
  'text',
  'quotedText',
  'articleTitle',
  'articleText',
  'authorName',
  'authorHandle',
  'folderNames',
] as const

export const BOOKMARK_SEARCH_BOOSTS = {
  text: 5,
  quotedText: 4,
  articleTitle: 4,
  articleText: 2,
  authorName: 1.5,
  authorHandle: 1.5,
  folderNames: 1.25,
} as const

function compareOptionalBigInts(left?: string | null, right?: string | null): number {
  if (left && right && /^\d+$/.test(left) && /^\d+$/.test(right)) {
    const leftValue = BigInt(left)
    const rightValue = BigInt(right)
    if (leftValue === rightValue) {
      return 0
    }
    return leftValue > rightValue ? 1 : -1
  }

  return String(left ?? '').localeCompare(String(right ?? ''))
}

function compareOptionalDates(left?: string | null, right?: string | null): number {
  const leftTime = left ? Date.parse(left) : Number.NaN
  const rightTime = right ? Date.parse(right) : Number.NaN

  if (Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime !== rightTime) {
    return leftTime > rightTime ? 1 : -1
  }

  if (Number.isFinite(leftTime) !== Number.isFinite(rightTime)) {
    return Number.isFinite(leftTime) ? 1 : -1
  }

  return String(left ?? '').localeCompare(String(right ?? ''))
}

function normalizeMediaType(value?: string): MediaType | null {
  if (value === 'photo' || value === 'video' || value === 'animated_gif') {
    return value
  }

  return null
}

function normalizeVariants(mediaObject: RawMediaObject): MediaItem['variants'] {
  const candidates = mediaObject.variants ?? mediaObject.videoVariants ?? []
  const variants = candidates
    .filter((variant): variant is NonNullable<typeof variant> & { url: string } => Boolean(variant?.url))
    .map((variant) => ({
      url: variant.url,
      bitrate: variant.bitrate,
      contentType: variant.contentType,
    }))

  return variants.length > 0 ? variants : undefined
}

function normalizeMediaItem(mediaObject: RawMediaObject): MediaItem | null {
  const type = normalizeMediaType(mediaObject.type)
  if (!type) {
    return null
  }

  const variants = normalizeVariants(mediaObject)
  const mediaUrl = mediaObject.mediaUrl ?? mediaObject.url
  const fullUrl = type === 'photo' ? mediaUrl : variants?.[0]?.url ?? mediaUrl
  if (!fullUrl) {
    return null
  }

  const thumbUrl = mediaObject.previewUrl ?? mediaUrl ?? fullUrl
  const posterUrl =
    type === 'photo' ? undefined : mediaObject.previewUrl ?? mediaUrl ?? variants?.[0]?.url
  const aspectRatio =
    mediaObject.width && mediaObject.height ? mediaObject.width / mediaObject.height : undefined

  return {
    type,
    thumbUrl,
    fullUrl,
    posterUrl,
    width: mediaObject.width,
    height: mediaObject.height,
    aspectRatio,
    durationMs: mediaObject.durationMs,
    variants,
  }
}

function normalizeTweetDoc(record: RawBookmarkRecord): TweetDoc | null {
  const media = (record.mediaObjects ?? [])
    .map((mediaObject) => normalizeMediaItem(mediaObject))
    .filter((mediaItem): mediaItem is MediaItem => mediaItem !== null)

  if (media.length === 0) {
    return null
  }

  const representativeMotionMediaIndex = media.findIndex(
    (mediaItem) => mediaItem.type === 'video' || mediaItem.type === 'animated_gif',
  )

  return {
    id: record.tweetId ?? record.id,
    sortIndex: record.sortIndex ?? null,
    postedAt: record.postedAt ?? null,
    url: record.url,
    text: record.text,
    articleTitle: record.articleTitle,
    articleText: record.articleText,
    quotedText: record.quotedTweet?.text,
    authorName: record.authorName,
    authorHandle: record.authorHandle,
    folderNames: record.folderNames ?? [],
    likes: record.engagement?.likeCount,
    replies: record.engagement?.replyCount,
    reposts: record.engagement?.repostCount ?? record.engagement?.retweetCount,
    media,
    representativeMediaIndex: 0,
    representativeMotionMediaIndex:
      representativeMotionMediaIndex >= 0 ? representativeMotionMediaIndex : 0,
  }
}

function compareBookmarkedDescending(left: TweetDoc, right: TweetDoc): number {
  const sortIndexOrder = compareOptionalBigInts(left.sortIndex, right.sortIndex)
  if (sortIndexOrder !== 0) {
    return sortIndexOrder * -1
  }

  const postedAtOrder = compareOptionalDates(left.postedAt, right.postedAt)
  if (postedAtOrder !== 0) {
    return postedAtOrder * -1
  }

  return left.id.localeCompare(right.id)
}

function comparePostedDescending(left: TweetDoc, right: TweetDoc): number {
  const postedAtOrder = compareOptionalDates(left.postedAt, right.postedAt)
  if (postedAtOrder !== 0) {
    return postedAtOrder * -1
  }

  const sortIndexOrder = compareOptionalBigInts(left.sortIndex, right.sortIndex)
  if (sortIndexOrder !== 0) {
    return sortIndexOrder * -1
  }

  return left.id.localeCompare(right.id)
}

function toGridItem(tweetDoc: TweetDoc, mediaIndex: number): GridItem {
  const mediaItem = tweetDoc.media[mediaIndex]
  if (!mediaItem) {
    throw new Error(`Missing media index ${mediaIndex} for tweet ${tweetDoc.id}`)
  }

  return {
    gridId: `${tweetDoc.id}:${mediaIndex}`,
    tweetId: tweetDoc.id,
    mediaIndex,
    mediaType: mediaItem.type,
    thumbUrl: mediaItem.thumbUrl,
    fullUrl: mediaItem.fullUrl,
    posterUrl: mediaItem.posterUrl,
    width: mediaItem.width,
    height: mediaItem.height,
    aspectRatio: mediaItem.aspectRatio,
  }
}

function chunkDocs(docs: TweetDoc[], chunkSize: number): ExportArtifacts['docsChunks'] {
  const chunks: ExportArtifacts['docsChunks'] = []

  for (let index = 0; index < docs.length; index += chunkSize) {
    const chunkNumber = chunks.length + 1
    chunks.push({
      fileName: `tweets/docs-${String(chunkNumber).padStart(4, '0')}.json`,
      docs: docs.slice(index, index + chunkSize),
    })
  }

  return chunks
}

export function buildExportArtifacts(
  records: RawBookmarkRecord[],
  options: BuildExportArtifactsOptions,
): ExportArtifacts {
  const chunkSize = options.chunkSize ?? DEFAULT_CHUNK_SIZE
  const docs = records
    .map((record) => normalizeTweetDoc(record))
    .filter((doc): doc is TweetDoc => doc !== null)
    .sort(compareBookmarkedDescending)

  const docsChunks = chunkDocs(docs, chunkSize)
  const gridOne = docs.map((doc) => toGridItem(doc, doc.representativeMediaIndex))
  const gridAll = docs.flatMap((doc) => doc.media.map((_, mediaIndex) => toGridItem(doc, mediaIndex)))
  const orderBookmarked = [...docs].sort(compareBookmarkedDescending).map((doc) => doc.id)
  const orderPosted = [...docs].sort(comparePostedDescending).map((doc) => doc.id)

  const searchStore: SearchStoreEntry[] = docs.map((doc) => ({
    id: doc.id,
    text: doc.text,
    quotedText: doc.quotedText ?? '',
    articleTitle: doc.articleTitle ?? '',
    articleText: doc.articleText ?? '',
    authorName: doc.authorName ?? '',
    authorHandle: doc.authorHandle ?? '',
    folderNames: doc.folderNames.join(' '),
  }))

  const searchIndex = new MiniSearch({
    idField: 'id',
    fields: [...BOOKMARK_SEARCH_FIELDS],
    storeFields: ['id'],
    searchOptions: {
      boost: BOOKMARK_SEARCH_BOOSTS,
    },
  })
  searchIndex.addAll(searchStore)

  const manifest: Manifest = {
    buildId: options.buildId,
    builtAt: options.builtAt,
    tweetCount: docs.length,
    gridItemCountOne: gridOne.length,
    gridItemCountAll: gridAll.length,
    chunkSize,
    files: {
      docs: docsChunks.map((chunk) => chunk.fileName),
      gridOne: 'grid/one.json',
      gridAll: 'grid/all.json',
      orderBookmarked: 'order/bookmarked.json',
      orderPosted: 'order/posted.json',
      searchIndex: 'search/index.json',
      searchStore: 'search/store.json',
    },
  }

  return {
    manifest,
    docsChunks,
    gridOne,
    gridAll,
    orderBookmarked,
    orderPosted,
    searchIndex: searchIndex.toJSON(),
    searchStore,
  }
}
