export function resolveMasonryInitialItemCount(input: {
  itemCount: number
  columnCount: number
  immersive: boolean
}): number {
  const perColumnBuffer = input.immersive ? 20 : 14
  return Math.min(input.itemCount, input.columnCount * perColumnBuffer)
}
