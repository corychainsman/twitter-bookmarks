import { describe, expect, it } from "vitest"

import {
  ambientAutoplayAllowed,
  shouldPlayForVisibility,
} from "./autoplay-policy"

describe("ambientAutoplayAllowed", () => {
  it("disables ambient playback for either user preference", () => {
    expect(ambientAutoplayAllowed({ reducedMotion: true, saveData: false })).toBe(false)
    expect(ambientAutoplayAllowed({ reducedMotion: false, saveData: true })).toBe(false)
    expect(ambientAutoplayAllowed({ reducedMotion: false, saveData: false })).toBe(true)
  })
})

describe("shouldPlayForVisibility", () => {
  it("uses a ten/five percent hysteresis window", () => {
    expect(shouldPlayForVisibility(0.09, false)).toBe(false)
    expect(shouldPlayForVisibility(0.1, false)).toBe(true)
    expect(shouldPlayForVisibility(0.05, true)).toBe(true)
    expect(shouldPlayForVisibility(0.049, true)).toBe(false)
  })
})
