import { act, fireEvent, render } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { MediaAsset } from "../../contracts/domain"
import { ResponsivePicture } from "./ResponsivePicture"

let observerCallback: IntersectionObserverCallback | undefined
const observerOptions = vi.hoisted(() => vi.fn())

class IntersectionObserverStub implements IntersectionObserver {
  readonly root = null
  readonly rootMargin = "0px"
  readonly scrollMargin = "0px"
  readonly thresholds = [0]
  disconnect = vi.fn()
  observe = vi.fn()
  takeRecords = vi.fn(() => [])
  unobserve = vi.fn()

  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    observerCallback = callback
    observerOptions(options)
  }
}

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
  lightbox: [],
}

describe("ResponsivePicture", () => {
  beforeEach(() => {
    observerCallback = undefined
    observerOptions.mockReset()
    vi.stubGlobal("IntersectionObserver", IntersectionObserverStub)
  })

  it("admits sources inside the grid lookahead and then loads eagerly", () => {
    const { container } = render(
      <ResponsivePicture
        asset={asset}
        preloadMargin="1120px 0px"
        sizes="24vw"
      />,
    )
    const image = container.querySelector("img")!

    expect(image).not.toHaveAttribute("src")
    expect(image).toHaveAttribute("loading", "eager")
    expect(observerOptions).toHaveBeenCalledWith({
      rootMargin: "1120px 0px",
      threshold: 0,
    })

    act(() => observerCallback?.([
      { isIntersecting: true } as IntersectionObserverEntry,
    ], {} as IntersectionObserver))

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
    expect(image).toHaveAttribute("src", "https://media.test/image-1280.jpg?v=jpeg-large")

    fireEvent.error(image)

    expect(image).toHaveAttribute("data-load-attempt", "2")
    expect(image.getAttribute("src")).toContain("wall-retry=1")
    expect(image.getAttribute("srcset")).toContain("wall-retry=1")
  })
})
