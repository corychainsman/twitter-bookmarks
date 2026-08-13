import { describe, expect, it } from "vitest"

import type { RenditionCandidate } from "../../contracts/domain"
import { buildResponsiveRenditions } from "./mediaSources"

function candidate(
  mimeType: string,
  width: number,
  height = Math.round(width * 0.75),
): RenditionCandidate {
  return {
    url: `https://media.test/${mimeType.split("/")[1]}/${width}`,
    width,
    height,
    mimeType,
  }
}

describe("buildResponsiveRenditions", () => {
  it("orders modern source formats and retains a compatible img fallback", () => {
    const renditions = buildResponsiveRenditions([
      candidate("image/jpeg", 1_280),
      candidate("image/avif", 640),
      candidate("image/webp", 640),
      candidate("image/jpeg", 640),
      candidate("image/avif", 1_280),
    ])

    expect(renditions.sources.map((source) => source.mimeType)).toEqual([
      "image/avif",
      "image/webp",
    ])
    expect(renditions.fallback?.mimeType).toBe("image/jpeg")
    expect(renditions.fallback?.srcSet).toBe(
      "https://media.test/jpeg/640 640w, https://media.test/jpeg/1280 1280w",
    )
    expect(renditions.src).toBe("https://media.test/jpeg/1280")
  })

  it("filters invalid candidates and deduplicates widths", () => {
    const renditions = buildResponsiveRenditions([
      candidate("image/avif", 640),
      { ...candidate("image/avif", 640), url: "https://duplicate.test/640" },
      candidate("video/mp4", 640),
      { ...candidate("image/jpeg", 320), width: 0 },
    ])

    expect(renditions.fallback?.candidates).toHaveLength(1)
    expect(renditions.src).toBe("https://media.test/avif/640")
  })
})
