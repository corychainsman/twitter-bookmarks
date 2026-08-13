import type { CompositionEngine } from "../../contracts/interfaces"
import type {
  CommittedWallState,
  MediaAsset,
  MediaRecord,
  TileScale,
  ViewMode,
  WallTile,
} from "../../contracts/domain"

export const DEFAULT_LAYOUT_GROUP_SIZE = 20
const DEFAULT_MAX_LARGE_PER_GROUP = 4

interface DraftTile {
  id: string
  recordId: string
  media: MediaAsset[]
  representative: MediaAsset
  overflowCount: number
}

export interface CompositionOptions {
  layoutGroupSize?: number
  maxLargePerGroup?: number
}

export interface StableWallTail {
  tiles: WallTile[]
  bufferedTileCount: number
}

/**
 * Keeps an incomplete append group out of JustifiedInfiniteGrid until enough
 * items arrive to lay it out without a transient full-width terminal row.
 * Once pagination ends, the remainder joins the preceding group so the grid
 * can balance the final rows as one stable layout problem.
 */
export function stabilizeWallTail(
  tiles: WallTile[],
  hasNextPage: boolean,
  groupSize = DEFAULT_LAYOUT_GROUP_SIZE,
): StableWallTail {
  const lastTile = tiles.at(-1)
  if (!lastTile) return { tiles, bufferedTileCount: 0 }

  let tailStart = tiles.length - 1
  while (tailStart > 0 && tiles[tailStart - 1]?.groupKey === lastTile.groupKey) {
    tailStart -= 1
  }

  const tailSize = tiles.length - tailStart
  if (tailSize >= groupSize) return { tiles, bufferedTileCount: 0 }

  if (hasNextPage) {
    return {
      tiles: tiles.slice(0, tailStart),
      bufferedTileCount: tailSize,
    }
  }

  const precedingGroupKey = tiles[tailStart - 1]?.groupKey
  if (precedingGroupKey === undefined) return { tiles, bufferedTileCount: 0 }

  return {
    tiles: tiles.map((tile, index) => (
      index < tailStart ? tile : { ...tile, groupKey: precedingGroupKey }
    )),
    bufferedTileCount: 0,
  }
}

/**
 * A small, stable 32-bit hash. It deliberately avoids platform randomness so a
 * shared seed produces the same wall on every browser.
 */
export function hashCompositionValue(value: string): number {
  let hash = 0x811c9dc5

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }

  return hash >>> 0
}

function seededFraction(seed: string, identity: string, purpose: string): number {
  return hashCompositionValue(`${seed}\u001f${identity}\u001f${purpose}`) / 0x1_0000_0000
}

function eligibleAssets(record: MediaRecord): MediaAsset[] {
  const eligibleIds = new Set(record.eligibleRepresentativeAssetIds)

  return record.assets.filter((asset) => eligibleIds.has(asset.id))
}

export function chooseRepresentative(record: MediaRecord, seed: string): MediaAsset | undefined {
  const candidates = eligibleAssets(record)

  if (candidates.length === 0) {
    return undefined
  }

  const candidateIndex = Math.floor(
    seededFraction(seed, record.id, "representative") * candidates.length,
  )

  return candidates[candidateIndex]
}

function orderHybridMedia(
  record: MediaRecord,
  representative: MediaAsset,
  seed: string,
): MediaAsset[] {
  const remainder = record.assets
    .filter((asset) => asset.id !== representative.id)
    .toSorted((left, right) => {
      const leftHash = hashCompositionValue(`${seed}\u001f${record.id}\u001f${left.id}\u001fhybrid`)
      const rightHash = hashCompositionValue(`${seed}\u001f${record.id}\u001f${right.id}\u001fhybrid`)

      if (leftHash !== rightHash) {
        return leftHash - rightHash
      }

      return left.id.localeCompare(right.id)
    })

  return [representative, ...remainder]
}

function projectRecord(record: MediaRecord, seed: string, mode: ViewMode): DraftTile[] {
  if (mode === "asset") {
    return record.assets.map((asset) => ({
      id: `asset:${asset.id}`,
      recordId: record.id,
      media: [asset],
      representative: asset,
      overflowCount: 0,
    }))
  }

  const representative = chooseRepresentative(record, seed)

  if (!representative) {
    return []
  }

  if (mode === "record") {
    return [{
      id: `record:${record.id}`,
      recordId: record.id,
      media: [representative],
      representative,
      overflowCount: 0,
    }]
  }

  const orderedMedia = orderHybridMedia(record, representative, seed)
  const media = orderedMedia.slice(0, 4)

  return [{
    id: `hybrid:${record.id}`,
    recordId: record.id,
    media,
    representative,
    overflowCount: Math.max(0, orderedMedia.length - media.length),
  }]
}

function requestedScale(seed: string, tileId: string): TileScale {
  const value = seededFraction(seed, tileId, "scale")

  if (value < 0.28) {
    return "small"
  }

  if (value < 0.8) {
    return "medium"
  }

  return "large"
}

function groupKey(
  seed: string,
  mode: ViewMode,
  groupIndex: number,
  firstTileId: string,
): string {
  const signature = hashCompositionValue(
    `${seed}\u001f${mode}\u001f${groupIndex}\u001f${firstTileId}\u001flayout-group`,
  )

  return `layout-${groupIndex}-${signature.toString(36)}`
}

function finalizeTiles(
  draftTiles: DraftTile[],
  state: CommittedWallState,
  groupSize: number,
  maxLargePerGroup: number,
): WallTile[] {
  const tiles: WallTile[] = []
  let previousWasLarge = false

  for (let groupStart = 0; groupStart < draftTiles.length; groupStart += groupSize) {
    const draftGroup = draftTiles.slice(groupStart, groupStart + groupSize)
    const groupIndex = Math.floor(groupStart / groupSize)
    const firstTile = draftGroup[0]

    if (!firstTile) {
      continue
    }

    const layoutGroupKey = groupKey(state.seed, state.mode, groupIndex, firstTile.id)
    let largeCount = 0

    for (const draftTile of draftGroup) {
      let scale = requestedScale(
        state.seed,
        `${draftTile.id}\u001f${draftTile.representative.id}`,
      )

      if (
        scale === "large"
        && (previousWasLarge || largeCount >= maxLargePerGroup)
      ) {
        scale = "medium"
      }

      if (scale === "large") {
        largeCount += 1
      }

      previousWasLarge = scale === "large"
      tiles.push({
        ...draftTile,
        scale,
        groupKey: layoutGroupKey,
      })
    }
  }

  return tiles
}

export class DeterministicCompositionEngine implements CompositionEngine {
  readonly #layoutGroupSize: number
  readonly #maxLargePerGroup: number

  constructor(options: CompositionOptions = {}) {
    this.#layoutGroupSize = Math.max(
      1,
      Math.floor(options.layoutGroupSize ?? DEFAULT_LAYOUT_GROUP_SIZE),
    )
    this.#maxLargePerGroup = Math.max(
      0,
      Math.floor(options.maxLargePerGroup ?? DEFAULT_MAX_LARGE_PER_GROUP),
    )
  }

  compose(records: MediaRecord[], state: CommittedWallState): WallTile[] {
    const projected = records.flatMap((record) => projectRecord(record, state.seed, state.mode))

    return finalizeTiles(
      projected,
      state,
      this.#layoutGroupSize,
      this.#maxLargePerGroup,
    )
  }
}

export function createCompositionEngine(
  options?: CompositionOptions,
): CompositionEngine {
  return new DeterministicCompositionEngine(options)
}
