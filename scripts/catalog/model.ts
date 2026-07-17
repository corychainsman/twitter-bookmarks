export type MediaType = 'photo' | 'video' | 'animated_gif'

export type MediaVariant = {
  url: string
  bitrate?: number
  contentType?: string
}

export type ImageRendition = {
  url: string
  width: number
  height?: number
  bytes?: number
  digest?: string
  contentType: 'image/avif'
}

export type MediaItem = {
  type: MediaType
  thumbUrl: string
  fullUrl: string
  posterUrl?: string
  /** Original twimg URL when fullUrl has been rewritten to the self-hosted mirror. */
  originUrl?: string
  width?: number
  height?: number
  aspectRatio?: number
  durationMs?: number
  variants?: MediaVariant[]
  /** Published image renditions for photos, or poster renditions for motion media. */
  imageRenditions?: ImageRendition[]
}

export type TweetDoc = {
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

export type GridItem = {
  gridId: string
  tweetId: string
  mediaIndex: number
  mediaType: MediaType
  thumbUrl: string
  fullUrl: string
  posterUrl?: string
  /** Downscaled muted MP4 for in-grid autoplay (mirrored videos only). */
  previewUrl?: string
  width?: number
  height?: number
  aspectRatio?: number
  /** Base64 ThumbHash of the tile image, present for mirrored assets. */
  thumbhash?: string
  /** Published image renditions for the tile image or motion poster. */
  imageRenditions?: ImageRendition[]
}

export type Manifest = {
  buildId: string
  builtAt: string
  tweetCount: number
  gridItemCountOne: number
  gridItemCountAll: number
  chunkSize: number
  /** Origin serving self-hosted media, e.g. https://tbmedia.corychainsman.com */
  mediaBaseUrl?: string
  /** Version of the explicit media rendition catalog embedded in exported records. */
  mediaCatalogVersion?: 1 | 2
  /** SHA-256 of the verified mirror manifest used to build this catalog. */
  mediaCatalogGeneration?: string
  files: {
    docs: string[]
    gridOne: string
    gridAll: string
    /** Small first-paint slice of gridAll in default (bookmarked desc) order. */
    gridFirst?: string
    orderBookmarked: string
    orderPosted: string
    searchIndex: string
    searchStore: string
    embeddings?: string
  }
}

export type QueryState = {
  q: string
  sort: 'bookmarked' | 'posted' | 'random'
  dir: 'asc' | 'desc'
  mode: 'one' | 'all'
  immersive: boolean
  preferMotion: boolean
  similarToGridId?: string
  zoom: number
  keepSeed: boolean
  seed?: string
}

export type QueryResult = {
  total: number
  orderedGridIds: string[]
  appliedSeed?: string
}

export type RawMediaObject = {
  type?: string
  url?: string
  mediaUrl?: string
  expandedUrl?: string
  previewUrl?: string
  altText?: string
  extAltText?: string
  width?: number
  height?: number
  durationMs?: number
  variants?: Array<{
    url?: string
    bitrate?: number
    contentType?: string
  }>
  videoVariants?: Array<{
    url?: string
    bitrate?: number
    contentType?: string
  }>
}

export type RawBookmarkRecord = {
  id: string
  tweetId?: string
  sortIndex?: string | null
  postedAt?: string | null
  url: string
  text: string
  articleTitle?: string
  articleText?: string
  quotedTweet?: {
    text: string
  }
  authorName?: string
  authorHandle?: string
  folderNames?: string[]
  engagement?: {
    likeCount?: number
    replyCount?: number
    repostCount?: number
    retweetCount?: number
  }
  mediaObjects?: RawMediaObject[]
}
