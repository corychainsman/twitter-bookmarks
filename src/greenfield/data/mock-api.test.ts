import { describe, expect, it } from "vitest"

import type { CommittedWallState } from "../contracts/domain"
import { createMockApiTransport, createMockRecords } from "./mock-api"

const state: CommittedWallState = {
  q: "",
  filters: [],
  sort: "curated",
  mode: "asset",
  seed: "seed-one",
  density: "auto",
}

describe("mock ApiTransport", () => {
  it("serves deterministic, cursor-paginated records", async () => {
    const transport = createMockApiTransport({ latencyMs: 0, pageSize: 5 })

    const first = await transport.discover(state)
    const second = await transport.discover(state, first.nextCursor)

    expect(first.records).toHaveLength(5)
    expect(first.records[0]?.id).toBe("record-001")
    expect(first.nextCursor).toBeDefined()
    expect(second.records[0]?.id).toBe("record-006")
    expect(second.previousCursor).toBeDefined()
    expect(first.records[0]?.assets[0]?.wall[0]?.url).toMatch(
      /^https:\/\/picsum\.photos\/seed\//,
    )
  })

  it("does not let presentation state alter a frozen result cursor", async () => {
    const transport = createMockApiTransport({ latencyMs: 0, pageSize: 4 })
    const first = await transport.discover(state)
    const recomposed = {
      ...state,
      mode: "hybrid" as const,
      seed: "different",
      density: 1.8,
    }

    const second = await transport.discover(recomposed, first.nextCursor)
    expect(second.records[0]?.id).toBe("record-005")
  })

  it("rejects cursors from a different result set", async () => {
    const transport = createMockApiTransport({ latencyMs: 0, pageSize: 4 })
    const first = await transport.discover(state)

    await expect(
      transport.discover({ ...state, q: "design" }, first.nextCursor),
    ).rejects.toThrow("does not belong")
  })

  it("supports filters, counts, media lookup, and minimal relaxation", async () => {
    const records = createMockRecords(12)
    const transport = createMockApiTransport({ latencyMs: 0, records })
    const filtered = {
      ...state,
      filters: [{ id: "tag", values: ["design"] }],
    }

    const count = await transport.count(filtered)
    const page = await transport.discover(filtered)
    const media = page.records[0]?.assets[0]

    expect(count.count).toBeGreaterThan(0)
    expect(page.records.every((record) => record.tags.includes("design"))).toBe(true)
    expect(media && (await transport.media(media.id))).toEqual({
      media,
      record: page.records[0],
    })

    const relaxed = await transport.discover({
      ...state,
      filters: [{ id: "unsupported", values: ["nothing"] }],
    })
    expect(relaxed.exact).toBe(false)
    expect(relaxed.records).not.toHaveLength(0)
    expect(relaxed.relaxedFilters).toEqual([
      { id: "unsupported", values: ["nothing"] },
    ])
  })

  it("supports the width and date facets emitted by the controls", async () => {
    const records = createMockRecords(40)
    const transport = createMockApiTransport({ latencyMs: 0, records })
    const recent = await transport.discover({
      ...state,
      filters: [{ id: "date", values: ["week"] }],
    })
    const bounded = await transport.discover({
      ...state,
      filters: [{ id: "width", values: ["640:1280"] }],
    })

    expect(recent.records).not.toHaveLength(0)
    expect(recent.records.length).toBeLessThan(records.length)
    expect(bounded.records).not.toHaveLength(0)
    expect(
      bounded.records.every((record) =>
        record.assets.some((asset) => asset.width >= 640 && asset.width <= 1_280),
      ),
    ).toBe(true)
  })

  it("honors request cancellation during simulated latency", async () => {
    const transport = createMockApiTransport({ latencyMs: 100 })
    const controller = new AbortController()
    const request = transport.discover(state, undefined, controller.signal)

    controller.abort()

    await expect(request).rejects.toMatchObject({ name: "AbortError" })
  })
})
