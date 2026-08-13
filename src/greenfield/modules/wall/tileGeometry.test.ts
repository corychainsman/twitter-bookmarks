import { describe, expect, it } from "vitest"

import type { MediaAsset, WallTile } from "../../contracts/domain"
import {
  getJustifiedColumnRange,
  getJustifiedSizeRange,
  getTileDimensions,
  getWallImageSizes,
  getWallRenderThreshold,
} from "./tileGeometry"

function media(width = 1_600, height = 900, id = "media-1"): MediaAsset {
  return {
    id,
    recordId: "record-1",
    kind: "image",
    title: "Media",
    description: "",
    width,
    height,
    placeholder: "",
    wall: [],
    lightbox: [],
  }
}

function tile(scale: WallTile["scale"]): WallTile {
  const representative = media()

  return {
    id: "tile-1",
    recordId: "record-1",
    media: [representative],
    representative,
    scale,
    overflowCount: 0,
    groupKey: "layout-1",
  }
}

describe("getTileDimensions", () => {
  it("reserves exact representative aspect ratio before media loads", () => {
    const dimensions = getTileDimensions(tile("medium"), "auto")

    expect(dimensions.width / dimensions.height).toBeCloseTo(16 / 9, 2)
  })

  it("reserves the exact composite ratio for an uncropped four-item collage", () => {
    const collage = tile("medium")
    collage.media = [
      media(1_600, 900, "wide"),
      media(900, 1_600, "portrait"),
      media(1_000, 1_000, "square"),
      media(4_000, 3_000, "landscape"),
    ]

    const firstRow = 16 / 9 + 9 / 16
    const secondRow = 1 + 4 / 3
    const expectedRatio = 1 / (1 / firstRow + 1 / secondRow)
    const dimensions = getTileDimensions(collage, 1)

    expect(dimensions.width / dimensions.height).toBeCloseTo(expectedRatio, 2)
  })

  it("gives editorial scales visibly different source weights", () => {
    const small = getTileDimensions(tile("small"), 1)
    const medium = getTileDimensions(tile("medium"), 1)
    const large = getTileDimensions(tile("large"), 1)

    expect(small.width * small.height).toBeLessThan(medium.width * medium.height)
    expect(medium.width * medium.height).toBeLessThan(large.width * large.height)
  })
})

describe("getJustifiedSizeRange", () => {
  it("maps continuous density to a narrow preferred row-height band", () => {
    expect(getJustifiedSizeRange(1)).toEqual([180, 260])
    expect(getJustifiedSizeRange(0.6)).toEqual([108, 156])
    expect(getJustifiedSizeRange(1.75)).toEqual([316, 454])
  })

  it("uses the neutral density for auto and clamps invalid numeric values", () => {
    expect(getJustifiedSizeRange("auto")).toEqual([180, 260])
    expect(getJustifiedSizeRange(Number.NaN)).toEqual([180, 260])
    expect(getJustifiedSizeRange(5)).toEqual([316, 454])
  })
})

describe("getJustifiedColumnRange", () => {
  it("keeps mobile rows bounded while allowing density to reshape a full desktop group", () => {
    expect(getJustifiedColumnRange(390)).toEqual([1, 4])
    expect(getJustifiedColumnRange(1_440)).toEqual([1, 20])
    expect(getJustifiedColumnRange(3_440)).toEqual([1, 20])
  })
})

describe("getWallRenderThreshold", () => {
  it("keeps a baseline buffer and scales both offscreen directions with density", () => {
    expect(getWallRenderThreshold(0.6)).toBe(600)
    expect(getWallRenderThreshold("auto")).toBe(800)
    expect(getWallRenderThreshold(1)).toBe(800)
    expect(getWallRenderThreshold(1.75)).toBe(1_400)
  })
})

describe("getWallImageSizes", () => {
  it("tracks the effective density instead of overestimating every tile", () => {
    expect(getWallImageSizes(0.6)).toBe(
      "(max-width: 639px) 18vw, (max-width: 1023px) 13vw, 10vw",
    )
    expect(getWallImageSizes(1)).toBe(
      "(max-width: 639px) 30vw, (max-width: 1023px) 22vw, 16vw",
    )
    expect(getWallImageSizes(1.75)).toBe(
      "(max-width: 639px) 53vw, (max-width: 1023px) 39vw, 28vw",
    )
  })
})
