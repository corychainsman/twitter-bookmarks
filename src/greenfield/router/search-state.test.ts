import { describe, expect, it } from "vitest"

import type { CommittedWallState } from "../contracts/domain"
import {
  decodeWallSearch,
  stringifyWallSearch,
  validateWallSearch,
} from "./search-state"

describe("wall URL state", () => {
  it("round-trips every committed wall value through readable parameters", () => {
    const state: CommittedWallState = {
      q: "moving portraits & light",
      filters: [
        { id: "tag", values: ["motion", "portrait"] },
        { id: "kind", values: ["video"] },
      ],
      sort: "random",
      mode: "hybrid",
      seed: "editorial-42",
      density: 1.375,
      similar: "record-002-media-1",
    }

    const encoded = stringifyWallSearch(state)

    expect(encoded).toContain("q=moving+portraits+%26+light")
    expect(encoded).toContain("filters=kind:video")
    expect(encoded).toContain("filters=tag:motion")
    expect(encoded).toContain("mode=hybrid")
    expect(encoded).toContain("sort=random")
    expect(decodeWallSearch(encoded)).toEqual(validateWallSearch(state))
  })

  it("normalizes malformed links to safe renderable defaults", () => {
    expect(
      decodeWallSearch(
        "?sort=unknown&mode=tiles&density=999&filters=broken&filters=tag:design",
      ),
    ).toEqual({
      q: "",
      filters: [{ id: "tag", values: ["design"] }],
      sort: "curated",
      mode: "asset",
      seed: "gallery",
      density: "auto",
    })
  })

  it("only serializes a composition seed for random sorting", () => {
    const curated = validateWallSearch({ sort: "curated", seed: "hidden-seed" })
    const random = validateWallSearch({ sort: "random", seed: "visible-seed" })

    expect(stringifyWallSearch(curated)).not.toContain("seed=")
    expect(stringifyWallSearch(random)).toContain("seed=visible-seed")
  })

  it("rejects density values outside the supported continuous control range", () => {
    expect(validateWallSearch({ density: 0.59 }).density).toBe("auto")
    expect(validateWallSearch({ density: 1.76 }).density).toBe("auto")
    expect(validateWallSearch({ density: 1.375 }).density).toBe(1.375)
  })

  it("canonicalizes duplicate and reordered facet selections", () => {
    const normalized = validateWallSearch({
      filters: [
        { id: "tag", values: ["portrait", "design", "portrait"] },
        { id: "kind", values: ["video"] },
        { id: "tag", values: ["motion"] },
      ],
    })

    expect(normalized.filters).toEqual([
      { id: "kind", values: ["video"] },
      { id: "tag", values: ["design", "motion", "portrait"] },
    ])
  })
})
