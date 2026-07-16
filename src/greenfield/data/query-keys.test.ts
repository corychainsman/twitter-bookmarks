import { describe, expect, it } from "vitest"

import type { CommittedWallState } from "../contracts/domain"
import { discoveryKeys } from "./query-keys"

const base: CommittedWallState = {
  q: "portrait",
  filters: [{ id: "kind", values: ["image"] }],
  sort: "curated",
  mode: "asset",
  seed: "first",
  density: "auto",
}

describe("discovery query keys", () => {
  it("do not fragment the backend cache for composition-only changes", () => {
    const original = discoveryKeys.pages(base)
    const recomposed = discoveryKeys.pages({
      ...base,
      mode: "hybrid",
      seed: "another-seed",
      density: 1.75,
    })

    expect(recomposed).toEqual(original)
  })

  it("do change for result-affecting search state", () => {
    expect(discoveryKeys.pages({ ...base, q: "landscape" })).not.toEqual(
      discoveryKeys.pages(base),
    )
    expect(discoveryKeys.pages({ ...base, sort: "newest" })).not.toEqual(
      discoveryKeys.pages(base),
    )
  })

  it("canonicalizes filter and value ordering", () => {
    const first = discoveryKeys.pages({
      ...base,
      filters: [
        { id: "tag", values: ["portrait", "design"] },
        { id: "kind", values: ["video"] },
      ],
    })
    const second = discoveryKeys.pages({
      ...base,
      filters: [
        { id: "kind", values: ["video"] },
        { id: "tag", values: ["design", "portrait"] },
      ],
    })

    expect(first).toEqual(second)
  })
})

