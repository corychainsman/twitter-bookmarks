import { describe, expect, it } from "vitest"

import { cloneFilterValues, countSelectedFilters } from "./types"
import type { ControlFilterValues, FilterRangeConfig } from "./types"

const range: FilterRangeConfig = {
  min: 0,
  max: 4_000,
  step: 100,
  unit: "px",
}

describe("filter control values", () => {
  it("counts each selected value and each active range facet", () => {
    const value: ControlFilterValues = {
      mediaKinds: ["image", "video"],
      sources: [
        { id: "museum", label: "Museum" },
        { id: "archive", label: "Archive" },
      ],
      widthRange: [800, 4_000],
      date: { preset: "month" },
    }

    expect(countSelectedFilters(value, range)).toBe(6)
  })

  it("clones nested draft data before mobile editing", () => {
    const committed: ControlFilterValues = {
      mediaKinds: ["image"],
      sources: [{ id: "museum", label: "Museum" }],
      widthRange: [0, 4_000],
      date: { preset: "custom", from: "2026-01-01" },
    }
    const draft = cloneFilterValues(committed)

    draft.mediaKinds.push("video")
    draft.sources[0]!.label = "Changed"
    draft.date.from = "2026-02-01"

    expect(committed).toEqual({
      mediaKinds: ["image"],
      sources: [{ id: "museum", label: "Museum" }],
      widthRange: [0, 4_000],
      date: { preset: "custom", from: "2026-01-01" },
    })
  })
})
