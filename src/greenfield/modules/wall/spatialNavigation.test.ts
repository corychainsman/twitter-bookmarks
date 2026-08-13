import { describe, expect, it } from "vitest"

import { findSpatialNeighbor, type SpatialRect } from "./spatialNavigation"

const rects: SpatialRect[] = [
  { id: "top-left", left: 0, top: 0, width: 100, height: 100 },
  { id: "top-right", left: 120, top: 0, width: 100, height: 100 },
  { id: "bottom-left", left: 0, top: 120, width: 100, height: 100 },
  { id: "bottom-right", left: 120, top: 120, width: 100, height: 100 },
]

describe("findSpatialNeighbor", () => {
  it("moves through the visual geometry rather than source order", () => {
    expect(findSpatialNeighbor(rects.toReversed(), "top-left", "right")).toBe("top-right")
    expect(findSpatialNeighbor(rects, "top-left", "down")).toBe("bottom-left")
    expect(findSpatialNeighbor(rects, "bottom-right", "up")).toBe("top-right")
    expect(findSpatialNeighbor(rects, "bottom-right", "left")).toBe("bottom-left")
  })

  it("does not wrap when no candidate exists in that direction", () => {
    expect(findSpatialNeighbor(rects, "top-left", "left")).toBeUndefined()
    expect(findSpatialNeighbor(rects, "top-left", "up")).toBeUndefined()
  })
})
