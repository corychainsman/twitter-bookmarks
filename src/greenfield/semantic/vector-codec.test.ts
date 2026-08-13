import { describe, expect, it } from "vitest"

import {
  decodeInt8Base64Url,
  encodeInt8Base64Url,
  quantizeNormalizedVector,
} from "./vector-codec"

describe("semantic vector codec", () => {
  it("round-trips signed vectors through URL-safe base64", () => {
    const vector = new Int8Array([-127, -1, 0, 1, 127])
    const encoded = encodeInt8Base64Url(vector)

    expect(encoded).not.toMatch(/[+/=]/)
    expect(decodeInt8Base64Url(encoded)).toEqual(vector)
  })

  it("normalizes and quantizes query vectors", () => {
    expect(quantizeNormalizedVector([3, 4])).toEqual(new Int8Array([76, 102]))
    expect(quantizeNormalizedVector([0, 0])).toEqual(new Int8Array([0, 0]))
  })

  it("rejects malformed payloads", () => {
    expect(decodeInt8Base64Url("not+url/safe")).toBeUndefined()
  })
})

