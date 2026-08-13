import type { Density, WallTile } from "../../contracts/domain"
import { createCollageLayout } from "./collageGeometry"

const SCALE_AREA: Record<WallTile["scale"], number> = {
  small: 0.62,
  medium: 1,
  large: 1.9,
}

const BASE_TILE_AREA = 68_000
const BASE_JUSTIFIED_ROW_SIZE = 220
const BASE_RENDER_THRESHOLD = 800
const MAX_LAYOUT_GROUP_COLUMNS = 20

function densityFactor(density: Density): number {
  if (density === "auto" || !Number.isFinite(density)) {
    return 1
  }

  return Math.min(1.75, Math.max(0.6, density))
}

export interface TileDimensions {
  width: number
  height: number
}

export type JustifiedSizeRange = [number, number]
export type JustifiedColumnRange = [number, number]

/**
 * InfiniteGrid applies threshold symmetrically before and after the viewport.
 * Scaling it with row size keeps several rows mounted and loading offscreen at
 * every zoom level instead of letting large-density rows enter cold.
 */
export function getWallRenderThreshold(density: Density): number {
  return Math.max(600, Math.round(BASE_RENDER_THRESHOLD * densityFactor(density)))
}

/**
 * Gives the browser a density-aware estimate before InfiniteGrid has measured
 * the justified row. The estimate intentionally trends slightly low because
 * the rendition ladder can step up without distorting the media, while an
 * oversized `sizes` value permanently downloads a needlessly large source.
 */
export function getWallImageSizes(density: Density): string {
  const factor = densityFactor(density)
  const mobile = Math.round(30 * factor)
  const tablet = Math.round(22 * factor)
  const desktop = Math.round(16 * factor)

  return `(max-width: 639px) ${mobile}vw, (max-width: 1023px) ${tablet}vw, ${desktop}vw`
}

export function getJustifiedColumnRange(containerInlineSize: number): JustifiedColumnRange {
  return containerInlineSize < 640 ? [1, 4] : [1, MAX_LAYOUT_GROUP_COLUMNS]
}

/**
 * Keeps the density control meaningful after JustifiedInfiniteGrid takes
 * ownership of item sizing. A narrow preferred band produces pleasantly
 * varied rows without asking the grid to crop media that falls outside it.
 */
export function getJustifiedSizeRange(density: Density): JustifiedSizeRange {
  const target = BASE_JUSTIFIED_ROW_SIZE * densityFactor(density)

  return [
    Math.max(1, Math.round(target * 0.82)),
    Math.max(1, Math.round(target * 1.18)),
  ]
}

export function getTileDimensions(tile: WallTile, density: Density): TileDimensions {
  const ratio = createCollageLayout(tile.media).aspectRatio
  const factor = densityFactor(density)
  const area = BASE_TILE_AREA * SCALE_AREA[tile.scale] * factor * factor

  return {
    width: Math.max(1, Math.round(Math.sqrt(area * ratio))),
    height: Math.max(1, Math.round(Math.sqrt(area / ratio))),
  }
}
