import type { GridItem } from '@/features/bookmarks/model'

export function resolveBookmarksMasonryRenderKey(input: {
  columnCount: number
  columnWidth: number
  immersive: boolean
  items: GridItem[]
}): string {
  let itemsHash = 2166136261

  for (const item of input.items) {
    for (let index = 0; index < item.gridId.length; index += 1) {
      itemsHash ^= item.gridId.charCodeAt(index)
      itemsHash = Math.imul(itemsHash, 16777619)
    }
  }

  return [
    input.columnCount,
    input.columnWidth,
    input.immersive ? 1 : 0,
    input.items.length,
    itemsHash >>> 0,
  ].join(':')
}
