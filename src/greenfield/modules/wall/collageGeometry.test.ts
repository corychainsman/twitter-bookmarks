import { describe, expect, it } from "vitest"

import type { MediaAsset } from "../../contracts/domain"
import {
  collageFlexWeight,
  createCollageLayout,
  type CollageGroupNode,
} from "./collageGeometry"

function media(id: string, width: number, height: number): MediaAsset {
  return {
    id,
    recordId: "record",
    kind: "image",
    title: id,
    description: "",
    width,
    height,
    placeholder: "",
    wall: [],
    lightbox: [],
  }
}

describe("collage geometry", () => {
  it("normalizes four-item column weights to fill the complete tile", () => {
    const layout = createCollageLayout([
      media("one", 1920, 1080),
      media("two", 1920, 1080),
      media("three", 1920, 1080),
      media("four", 1920, 1080),
    ]) as CollageGroupNode

    const weights = layout.children.map((child) => collageFlexWeight(layout, child))

    expect(layout.kind).toBe("column")
    expect(weights).toEqual([0.5, 0.5])
    expect(weights.reduce((sum, weight) => sum + weight, 0)).toBeCloseTo(1)
  })

  it("normalizes uneven row weights without changing their ratio", () => {
    const layout = createCollageLayout([
      media("portrait", 3, 4),
      media("landscape", 16, 9),
    ]) as CollageGroupNode

    const weights = layout.children.map((child) => collageFlexWeight(layout, child))

    expect(weights.reduce((sum, weight) => sum + weight, 0)).toBeCloseTo(1)
    expect(weights[1]! / weights[0]!).toBeCloseTo((16 / 9) / (3 / 4))
  })
})
