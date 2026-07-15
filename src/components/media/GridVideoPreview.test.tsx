import { act, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { GridVideoPreview } from '@/components/media/GridVideoPreview'
import { GRID_VIDEO_AUTOPLAY } from '@/components/media/autoplay'

let intersectionCallback: IntersectionObserverCallback | undefined
let intersectionOptions: IntersectionObserverInit | undefined
let paused = true
let visibilityState: DocumentVisibilityState = 'visible'

function emitIntersection(intersectionRatio: number) {
  act(() => {
    intersectionCallback?.(
      [
        {
          isIntersecting: intersectionRatio > 0,
          intersectionRatio,
        } as IntersectionObserverEntry,
      ],
      {} as IntersectionObserver,
    )
  })
}

describe('GridVideoPreview', () => {
  beforeEach(() => {
    intersectionCallback = undefined
    intersectionOptions = undefined
    paused = true
    visibilityState = 'visible'

    vi.stubGlobal('IntersectionObserver', class {
      disconnect = vi.fn()
      observe = vi.fn()

      constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
        intersectionCallback = callback
        intersectionOptions = options
      }
    })
    vi.spyOn(HTMLMediaElement.prototype, 'paused', 'get').mockImplementation(() => paused)
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() => {
      paused = false
      return Promise.resolve()
    })
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {
      paused = true
    })
    vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibilityState)
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(0)
      return 1
    })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('starts at ten percent, plays through the exit threshold, and stops at zero', () => {
    const { container } = render(
      <GridVideoPreview
        gridId="tweet-1:0"
        requestState="admitted"
        src="https://video.example.com/preview.mp4"
      />,
    )
    const video = container.querySelector('video')!

    expect(intersectionOptions).toEqual({
      rootMargin: GRID_VIDEO_AUTOPLAY.rootMargin,
      threshold: [0, 0.1, 1],
    })
    expect(video).toHaveAttribute('loop')

    emitIntersection(0.1)
    expect(video.play).toHaveBeenCalledTimes(1)

    emitIntersection(0.01)
    expect(video.pause).not.toHaveBeenCalled()

    emitIntersection(0)
    expect(video.pause).toHaveBeenCalledTimes(1)
  })

  it('never detaches an admitted source while the tile remains mounted', () => {
    const { container, rerender } = render(
      <GridVideoPreview
        gridId="tweet-1:0"
        requestState="deferred"
        src="https://video.example.com/preview.mp4"
      />,
    )
    const video = container.querySelector('video')!
    expect(video).not.toHaveAttribute('src')
    expect(video).not.toHaveAttribute('poster')

    rerender(
      <GridVideoPreview
        gridId="tweet-1:0"
        requestState="admitted"
        src="https://video.example.com/preview.mp4"
      />,
    )
    expect(video).toHaveAttribute('src', 'https://video.example.com/preview.mp4')

    rerender(
      <GridVideoPreview
        gridId="tweet-1:0"
        requestState="deferred"
        src="https://video.example.com/preview.mp4"
      />,
    )
    expect(video).toHaveAttribute('src', 'https://video.example.com/preview.mp4')
  })

  it('resumes eligible playback after page visibility and unexpected pause events', () => {
    const { container } = render(
      <GridVideoPreview
        gridId="tweet-1:0"
        requestState="admitted"
        src="https://video.example.com/preview.mp4"
      />,
    )
    const video = container.querySelector('video')!

    emitIntersection(0.5)
    expect(video.play).toHaveBeenCalledTimes(1)

    visibilityState = 'hidden'
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    expect(video.pause).toHaveBeenCalledTimes(1)

    visibilityState = 'visible'
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    expect(video.play).toHaveBeenCalledTimes(2)

    paused = true
    fireEvent.pause(video)
    expect(video.play).toHaveBeenCalledTimes(3)

    paused = true
    fireEvent.pause(video)
    expect(video.play).toHaveBeenCalledTimes(3)
  })

  it('pauses beneath another playback surface and resumes only while still eligible', () => {
    const { container, rerender } = render(
      <GridVideoPreview
        gridId="tweet-1:0"
        playbackEnabled
        requestState="admitted"
        src="https://video.example.com/preview.mp4"
      />,
    )
    const video = container.querySelector('video')!
    emitIntersection(0.5)
    expect(video.play).toHaveBeenCalledTimes(1)

    rerender(
      <GridVideoPreview
        gridId="tweet-1:0"
        playbackEnabled={false}
        requestState="admitted"
        src="https://video.example.com/preview.mp4"
      />,
    )
    expect(video.pause).toHaveBeenCalledTimes(1)

    rerender(
      <GridVideoPreview
        gridId="tweet-1:0"
        playbackEnabled
        requestState="admitted"
        src="https://video.example.com/preview.mp4"
      />,
    )
    expect(video.play).toHaveBeenCalledTimes(2)

    emitIntersection(0)
    rerender(
      <GridVideoPreview
        gridId="tweet-1:0"
        playbackEnabled={false}
        requestState="admitted"
        src="https://video.example.com/preview.mp4"
      />,
    )
    rerender(
      <GridVideoPreview
        gridId="tweet-1:0"
        playbackEnabled
        requestState="admitted"
        src="https://video.example.com/preview.mp4"
      />,
    )
    expect(video.play).toHaveBeenCalledTimes(2)
  })
})
