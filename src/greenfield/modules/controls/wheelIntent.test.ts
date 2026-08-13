import { describe, expect, it } from "vitest"

import { WheelIntentFilter } from "./wheelIntent"

describe("WheelIntentFilter", () => {
  it("accepts a sustained active wheel gesture", () => {
    const filter = new WheelIntentFilter()
    const decisions = [4, 5, 5, 6, 5, 5, 4.8, 5.2]
      .map((delta, index) => filter.check(delta, index * 12))

    expect(decisions).toEqual(decisions.map(() => true))
  })

  it("rejects the decaying momentum tail", () => {
    const filter = new WheelIntentFilter()
    const active = [8, 9, 10, 10, 9, 8]
      .map((delta, index) => filter.check(delta, index * 12))
    const momentum = [5, 3, 1.5, 0.7, 0.25]
      .map((delta, index) => filter.check(delta, (active.length + index) * 12))

    expect(active).toEqual(active.map(() => true))
    expect(momentum).toContain(false)
    expect(momentum.at(-1)).toBe(false)
  })

  it("accepts a fresh gesture after an idle gap", () => {
    const filter = new WheelIntentFilter()
    ;[8, 7, 5, 3, 1, 0.3].forEach((delta, index) => {
      filter.check(delta, index * 12)
    })

    expect(filter.check(2, 250)).toBe(true)
  })

  it("tracks opposite directions independently", () => {
    const filter = new WheelIntentFilter()
    ;[8, 6, 4, 2, 1, 0.4].forEach((delta, index) => {
      filter.check(delta, index * 12)
    })

    expect(filter.check(-2, 84)).toBe(true)
  })
})
