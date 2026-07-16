import type { MediaAsset } from "../../contracts/domain"

export interface CollageMediaNode {
  kind: "media"
  mediaIndex: number
  aspectRatio: number
}

export interface CollageGroupNode {
  kind: "row" | "column"
  children: CollageLayoutNode[]
  aspectRatio: number
}

export type CollageLayoutNode = CollageMediaNode | CollageGroupNode

function mediaAspectRatio(media: MediaAsset): number {
  const ratio = media.width / media.height
  return Number.isFinite(ratio) && ratio > 0 ? ratio : 1
}

function row(children: CollageLayoutNode[]): CollageGroupNode {
  return {
    kind: "row",
    children,
    aspectRatio: children.reduce((sum, child) => sum + child.aspectRatio, 0),
  }
}

function column(children: CollageLayoutNode[]): CollageGroupNode {
  return {
    kind: "column",
    children,
    aspectRatio: 1 / children.reduce(
      (sum, child) => sum + 1 / child.aspectRatio,
      0,
    ),
  }
}

/**
 * Creates a slice layout whose outer ratio is derived from every child ratio.
 * When the preferred outer ratio is preserved, each leaf fills its cell
 * without crop, distortion, letterboxing, or internal gutters.
 */
export function createCollageLayout(media: MediaAsset[]): CollageLayoutNode {
  if (media.length === 0) {
    throw new Error("A wall tile must contain at least one media asset")
  }

  const leaves: CollageMediaNode[] = media.map((asset, mediaIndex) => ({
    kind: "media",
    mediaIndex,
    aspectRatio: mediaAspectRatio(asset),
  }))

  if (leaves.length === 1) return leaves[0]!
  if (leaves.length === 2) return row(leaves)

  if (leaves.length === 3) {
    return row([leaves[0]!, column(leaves.slice(1))])
  }

  const rows: CollageLayoutNode[] = []
  for (let index = 0; index < leaves.length; index += 2) {
    const children = leaves.slice(index, index + 2)
    rows.push(children.length === 1 ? children[0]! : row(children))
  }
  return column(rows)
}

export function collageFlexWeight(
  parent: CollageGroupNode,
  child: CollageLayoutNode,
): number {
  return parent.kind === "row" ? child.aspectRatio : 1 / child.aspectRatio
}
