// Identifies which query/view is being displayed, not what's currently in `items` —
// so the masonry grid persists (and doesn't re-request every image) across a
// progressive data hand-off for the same view (e.g. first-paint items handing off
// to the real, larger query result). Only a genuine view or layout change should
// force react-virtualized's Masonry to remount.
export function resolveBookmarksMasonryRenderKey(input: {
  columnCount: number
  columnWidth: number
  immersive: boolean
  viewKey: string
}): string {
  return `${input.viewKey}:${input.columnCount}:${input.columnWidth}:${input.immersive ? 1 : 0}`
}
