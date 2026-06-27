import type { GridItem } from '@/features/bookmarks/model'

const renderKeyCache = new WeakMap<GridItem[], Map<number, string>>()

export function resolveBookmarksMasonryRenderKey(input: {
  columnCount: number
  columnWidth: number
  immersive: boolean
  items: GridItem[]
}): string {
  const cacheKey = input.columnCount * 1_000_000 + input.columnWidth * 2 + (input.immersive ? 1 : 0)
  const cachedByKey = renderKeyCache.get(input.items) ?? (renderKeyCache.set(input.items, new Map()), renderKeyCache.get(input.items)!)
  const cached = cachedByKey.get(cacheKey)
  if (cached) return cached
  let itemsHash = 2166136261

  for (const item of input.items) {
    for (let index = 0; index < item.gridId.length; index += 1) {
      itemsHash ^= item.gridId.charCodeAt(index)
      itemsHash = Math.imul(itemsHash, 16777619)
    }
  }

  const renderKey = `${input.columnCount}:${input.columnWidth}:${input.immersive ? 1 : 0}:${input.items.length}:${itemsHash >>> 0}`
  cachedByKey.set(cacheKey, renderKey)
  return renderKey
}
