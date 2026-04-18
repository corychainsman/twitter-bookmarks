export const STATIC_COLUMN_LAYOUT_MULTIPLIER = 8

export function shouldUseStaticColumnLayout(input: {
  itemCount: number
  columnCount: number
}): boolean {
  return input.itemCount <= Math.max(input.columnCount * STATIC_COLUMN_LAYOUT_MULTIPLIER, 24)
}

export function distributeItemsByColumnOrder<Item>(
  items: Item[],
  columnCount: number,
): Item[][] {
  const safeColumnCount = Math.max(1, Math.min(columnCount, items.length || 1))
  const columns = Array.from({ length: safeColumnCount }, () => [] as Item[])

  items.forEach((item, index) => {
    columns[index % safeColumnCount].push(item)
  })

  return columns
}
