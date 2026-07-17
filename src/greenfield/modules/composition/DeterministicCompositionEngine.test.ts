import { describe, expect, it } from "vitest"

import type {
  CommittedWallState,
  MediaAsset,
  MediaRecord,
  ViewMode,
} from "../../contracts/domain"
import {
  DeterministicCompositionEngine,
  chooseRepresentative,
} from "./DeterministicCompositionEngine"

function asset(recordId: string, index: number): MediaAsset {
  return {
    id: `${recordId}-asset-${index}`,
    recordId,
    kind: "image",
    title: `Asset ${index}`,
    description: "",
    width: 1_200 + index,
    height: 800 + index,
    placeholder: "",
    wall: [{
      url: `https://media.test/${recordId}/${index}.avif`,
      width: 640,
      height: 427,
      mimeType: "image/avif",
    }],
    lightbox: [],
  }
}

function record(index: number, assetCount = 2): MediaRecord {
  const id = `record-${index}`
  const assets = Array.from({ length: assetCount }, (_, assetIndex) => asset(id, assetIndex))

  return {
    id,
    title: `Record ${index}`,
    description: "",
    sourceLabel: "Fixture",
    capturedAt: "2026-01-01T00:00:00.000Z",
    tags: [],
    assets,
    eligibleRepresentativeAssetIds: assets.map((item) => item.id),
  }
}

function state(mode: ViewMode, seed = "wall-seed"): CommittedWallState {
  return {
    q: "",
    filters: [],
    sort: "curated",
    mode,
    seed,
    density: "auto",
  }
}

describe("DeterministicCompositionEngine", () => {
  it("composes the same tiles for the same seed and record order", () => {
    const engine = new DeterministicCompositionEngine()
    const records = Array.from({ length: 18 }, (_, index) => record(index, 3))

    expect(engine.compose(records, state("record"))).toEqual(
      engine.compose(records, state("record")),
    )
  })

  it("projects one tile per asset in asset mode", () => {
    const engine = new DeterministicCompositionEngine()
    const tiles = engine.compose([record(1, 2), record(2, 3)], state("asset"))

    expect(tiles).toHaveLength(5)
    expect(tiles.every((tile) => tile.media.length === 1)).toBe(true)
    expect(tiles.map((tile) => tile.id)).toEqual([
      "asset:record-1-asset-0",
      "asset:record-1-asset-1",
      "asset:record-2-asset-0",
      "asset:record-2-asset-1",
      "asset:record-2-asset-2",
    ])
  })

  it("limits hybrid collages to four cells and reports overflow", () => {
    const engine = new DeterministicCompositionEngine()
    const [tile] = engine.compose([record(1, 7)], state("hybrid"))

    expect(tile?.media).toHaveLength(4)
    expect(tile?.overflowCount).toBe(3)
    expect(tile?.media[0]?.id).toBe(tile?.representative.id)
  })

  it("selects representatives only from the backend eligibility pool", () => {
    const fixture = record(3, 5)
    fixture.eligibleRepresentativeAssetIds = [fixture.assets[2]!.id, fixture.assets[4]!.id]

    const representative = chooseRepresentative(fixture, "eligible-seed")

    expect(fixture.eligibleRepresentativeAssetIds).toContain(representative?.id)
  })

  it("omits record projections when the backend supplies no eligible representative", () => {
    const fixture = record(3, 3)
    fixture.eligibleRepresentativeAssetIds = []
    const engine = new DeterministicCompositionEngine()

    expect(engine.compose([fixture], state("record"))).toEqual([])
    expect(engine.compose([fixture], state("hybrid"))).toEqual([])
    expect(engine.compose([fixture], state("asset"))).toHaveLength(3)
  })

  it("caps large tiles per layout group and prevents adjacent large tiles", () => {
    const groupSize = 10
    const engine = new DeterministicCompositionEngine({
      layoutGroupSize: groupSize,
      maxLargePerGroup: 2,
    })
    const tiles = engine.compose(
      Array.from({ length: 80 }, (_, index) => record(index, 1)),
      state("record", "scale-constraints"),
    )

    for (let start = 0; start < tiles.length; start += groupSize) {
      const group = tiles.slice(start, start + groupSize)

      expect(group.filter((tile) => tile.scale === "large").length).toBeLessThanOrEqual(2)
      for (let index = 1; index < group.length; index += 1) {
        expect(
          group[index - 1]?.scale === "large" && group[index]?.scale === "large",
        ).toBe(false)
      }
    }

    for (let index = 1; index < tiles.length; index += 1) {
      expect(
        tiles[index - 1]?.scale === "large" && tiles[index]?.scale === "large",
      ).toBe(false)
    }

    expect(new Set(tiles.map((tile) => tile.scale))).toEqual(
      new Set(["small", "medium", "large"]),
    )
  })

  it("keeps layout composition independent from query and filter values", () => {
    const engine = new DeterministicCompositionEngine({ layoutGroupSize: 4 })
    const records = Array.from({ length: 9 }, (_, index) => record(index, 1))
    const firstState = state("record")
    const secondState: CommittedWallState = {
      ...firstState,
      q: "different query",
      filters: [{ id: "kind", values: ["image"] }],
      sort: "newest",
      similar: "record-3-asset-0",
    }

    expect(engine.compose(records, firstState)).toEqual(
      engine.compose(records, secondState),
    )
  })

  it("changes editorial choices when Shuffle supplies a new seed", () => {
    const engine = new DeterministicCompositionEngine()
    const records = Array.from({ length: 24 }, (_, index) => record(index, 4))
    const first = engine.compose(records, state("record", "first-seed"))
    const shuffled = engine.compose(records, state("record", "second-seed"))

    expect(
      shuffled.map(({ representative, scale }) => [representative.id, scale]),
    ).not.toEqual(first.map(({ representative, scale }) => [representative.id, scale]))
  })
})
