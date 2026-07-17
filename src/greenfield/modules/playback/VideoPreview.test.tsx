import { act, fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { VideoPreview } from "./VideoPreview"

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

  constructor(
    _callback: IntersectionObserverCallback,
    options?: IntersectionObserverInit,
  ) {
    observerOptions(options)
  }
}

describe("VideoPreview", () => {
  beforeEach(() => {
    observerOptions.mockReset()
    vi.stubGlobal("IntersectionObserver", IntersectionObserverStub)
    vi.stubGlobal("matchMedia", vi.fn(() => ({
      matches: false,
      media: "",
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })))
    HTMLMediaElement.prototype.pause = vi.fn()
    HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve())
  })

  it("admits the video source using the wall's density-aware preload margin", () => {
    render(
      <VideoPreview
        label="Preview"
        preloadMargin="1400px 0px"
        src="https://media.test/preview.mp4"
      />,
    )

    expect(observerOptions).toHaveBeenCalledWith({
      rootMargin: "1400px 0px",
      threshold: 0,
    })
  })

  it("keeps the poster above the video until its first frame is presented", () => {
    let presentFrame: (() => void) | undefined

    HTMLVideoElement.prototype.requestVideoFrameCallback = vi.fn((callback) => {
      presentFrame = () => callback(0, {} as VideoFrameCallbackMetadata)
      return 1
    })

    render(
      <VideoPreview
        label="Preview"
        poster="https://media.test/poster.jpg"
        src="https://media.test/preview.mp4"
      />,
    )

    const video = screen.getByLabelText<HTMLVideoElement>("Preview")
    const poster = document.querySelector<HTMLImageElement>(
      'img[src="https://media.test/poster.jpg"]',
    )

    expect(poster).toBeInTheDocument()
    fireEvent.playing(video)
    expect(poster).toBeInTheDocument()

    act(() => presentFrame?.())
    expect(poster).not.toBeInTheDocument()
  })
})
