import { describe, expect, it } from "vitest"

import { runtimeCacheEntryCap, storageUtilization } from "./cache-policy"

const MEBIBYTE = 1_024 * 1_024

describe("runtime cache policy", () => {
  it("uses conservative defaults when storage estimates are unavailable", () => {
    expect(runtimeCacheEntryCap("results", undefined)).toBe(24)
    expect(runtimeCacheEntryCap("opaque-media", undefined)).toBe(8)
  })

  it("shrinks caches on constrained or nearly full storage", () => {
    expect(runtimeCacheEntryCap("media", { quota: 128 * MEBIBYTE, usage: 8 * MEBIBYTE })).toBe(24)
    expect(runtimeCacheEntryCap("video", { quota: 2_048 * MEBIBYTE, usage: 1_800 * MEBIBYTE })).toBe(2)
  })

  it("expands only when quota is generous and mostly free", () => {
    expect(runtimeCacheEntryCap("media", { quota: 2_048 * MEBIBYTE, usage: 300 * MEBIBYTE })).toBe(140)
    expect(runtimeCacheEntryCap("media", { quota: 2_048 * MEBIBYTE, usage: 1_200 * MEBIBYTE })).toBe(72)
  })

  it("handles incomplete and invalid estimates", () => {
    expect(storageUtilization({ quota: 0, usage: 12 })).toBeUndefined()
    expect(storageUtilization({ quota: 100, usage: 80 })).toBe(0.8)
  })
})
