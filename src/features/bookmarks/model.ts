export type MediaType = 'photo' | 'video' | 'animated_gif'

export type MediaVariant = {
  url: string
  bitrate?: number
  contentType?: string
}

export type MediaItem = {
  type: MediaType
  thumbUrl: string
  fullUrl: string
  posterUrl?: string
  width?: number
  height?: number
  aspectRatio?: number
  durationMs?: number
  variants?: MediaVariant[]
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
  width?: number
  height?: number
  aspectRatio?: number
}

export type Manifest = {
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

export type QueryState = {
  q: string
  folder: string
  sort: 'bookmarked' | 'posted' | 'random'
  dir: 'asc' | 'desc'
  mode: 'one' | 'all'
  immersive: boolean
  preferMotion: boolean
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
