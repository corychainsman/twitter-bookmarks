import { fireEvent, render } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import type { MediaAsset } from "../../contracts/domain"
import { ResponsivePicture } from "./ResponsivePicture"

const asset: MediaAsset = {
  id: "media-1",
  recordId: "record-1",
  kind: "image",
  title: "Image",
  description: "",
  width: 1_600,
  height: 900,
  placeholder: "",
  wall: [
    {
      url: "https://media.test/image-640.avif?v=avif",
      width: 640,
      height: 360,
      mimeType: "image/avif",
    },
    {
      url: "https://media.test/image-640.jpg?v=jpeg",
      width: 640,
      height: 360,
      mimeType: "image/jpeg",
    },
    {
      url: "https://media.test/image-1280.jpg?v=jpeg-large",
      width: 1_280,
      height: 720,
      mimeType: "image/jpeg",
    },
  ],
  lightbox: [
    {
      url: "https://media.test/image-original.jpg?v=original",
      width: 1_600,
      height: 900,
      mimeType: "image/jpeg",
    },
  ],
}

describe("ResponsivePicture", () => {
  it("loads eagerly as soon as InfiniteGrid mounts it inside the grid lookahead", () => {
    const { container } = render(
      <ResponsivePicture
        asset={asset}
        sizes="24vw"
      />,
    )
    const image = container.querySelector("img")!

    expect(image).toHaveAttribute("loading", "eager")
    expect(image).toHaveAttribute("src", "https://media.test/image-1280.jpg?v=jpeg-large")
    expect(container.querySelector('source[type="image/avif"]')).toBeInTheDocument()
  })

  it("falls back from a failed modern source and retries a failed fallback once", () => {
    const { container } = render(
      <ResponsivePicture asset={asset} priority sizes="24vw" />,
    )
    const image = container.querySelector("img")!

    expect(container.querySelector('source[type="image/avif"]')).toBeInTheDocument()

    fireEvent.error(image)

    expect(image).toHaveAttribute("data-load-attempt", "1")
    expect(container.querySelector("source")).not.toBeInTheDocument()
    expect(image.getAttribute("src")).toContain("image-1280.jpg")
    expect(image.getAttribute("src")).toContain("wall-retry=1")

    fireEvent.error(image)

    expect(image).toHaveAttribute("data-load-attempt", "2")
    expect(image.getAttribute("src")).toContain("image-original.jpg")
    expect(image.getAttribute("src")).toContain("wall-retry=2")
    expect(image.getAttribute("srcset")).toContain("image-original.jpg")
    expect(image.getAttribute("srcset")).toContain("wall-retry=2")
  })

  it("forces a new request when an AVIF-only wall image fails", () => {
    const avifOnlyAsset: MediaAsset = {
      ...asset,
      wall: asset.wall.filter((candidate) => candidate.mimeType === "image/avif"),
    }
    const { container } = render(
      <ResponsivePicture asset={avifOnlyAsset} priority sizes="24vw" />,
    )
    const image = container.querySelector("img")!
    const initialSrc = image.getAttribute("src")

    fireEvent.error(image)

    expect(image).toHaveAttribute("data-load-attempt", "1")
    expect(image.getAttribute("src")).not.toBe(initialSrc)
    expect(image.getAttribute("src")).toContain("wall-retry=1")
  })
})
