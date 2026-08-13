import { describe, expect, it } from "vitest"

import type { CommittedWallState } from "../contracts/domain"
import { planWallNavigation } from "./history"

const current: CommittedWallState = {
  q: "",
  filters: [],
  sort: "curated",
  mode: "asset",
  seed: "first",
  density: "auto",
}

describe("wall history policy", () => {
  it("pushes every result-affecting filter change and lands at the top", () => {
    const plan = planWallNavigation(current, {
      type: "filters",
      filters: [{ id: "tag", values: ["design"] }],
    })

    expect(plan.history).toBe("push")
    expect(plan.landing).toBe("top")
    expect(plan.search.filters).toEqual([{ id: "tag", values: ["design"] }])
  })

  it("preserves the anchor for view changes", () => {
    expect(planWallNavigation(current, { type: "mode", mode: "hybrid" })).toMatchObject({
      history: "push",
      landing: "preserve-anchor",
    })
    expect(planWallNavigation(current, { type: "density", density: 1.5 })).toMatchObject({
      history: "push",
      landing: "preserve-anchor",
    })
  })

  it("clears only the query while preserving every other wall control", () => {
    const filtered: CommittedWallState = {
      ...current,
      q: "texture",
      filters: [{ id: "kind", values: ["image"] }],
      sort: "newest",
      mode: "hybrid",
      seed: "kept",
      density: 1.4,
    }

    expect(planWallNavigation(filtered, { type: "search", q: "" })).toEqual({
      search: { ...filtered, q: "" },
      history: "push",
      landing: "top",
    })
  })

  it("replaces an impractical density with auto", () => {
    const plan = planWallNavigation(
      { ...current, density: 2 },
      { type: "density-fallback" },
    )

    expect(plan).toMatchObject({
      history: "replace",
      landing: "preserve-anchor",
      search: { density: "auto" },
    })
  })
})
