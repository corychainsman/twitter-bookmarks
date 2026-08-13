export type ViewMode = "asset" | "record" | "hybrid"
export type SortMode = "curated" | "random" | "newest" | "oldest"
export type Density = "auto" | number
export type MediaKind = "image" | "video"
export type TileScale = "small" | "medium" | "large"

export interface RenditionCandidate {
  url: string
  width: number
  height: number
  mimeType: string
}

export interface MediaAsset {
  id: string
  recordId: string
  kind: MediaKind
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

export interface MediaRecord {
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

export interface DirectMedia {
  media: MediaAsset
  record: MediaRecord
}

export interface FacetSelection {
  id: string
  values: string[]
}

export interface CommittedWallState {
  q: string
  filters: FacetSelection[]
  sort: SortMode
  mode: ViewMode
  seed: string
  density: Density
  similar?: string
}

export interface DiscoveryPage {
  records: MediaRecord[]
  previousCursor?: string
  nextCursor?: string
  snapshotExpiresAt: string
  exact: boolean
  relaxedFilters: FacetSelection[]
}

export interface WallTile {
  id: string
  recordId: string
  media: MediaAsset[]
  representative: MediaAsset
  scale: TileScale
  overflowCount: number
  groupKey: string
}

export interface ResultCount {
  count: number
}
