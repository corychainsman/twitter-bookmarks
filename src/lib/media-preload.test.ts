import { describe, expect, it, vi } from 'vitest'

import { preloadMediaCandidates, type MediaPreloader } from '@/lib/media-preload'

describe('preloadMediaCandidates', () => {
  it('preloads unique media candidates up to the concurrency limit', () => {
    const preloader: MediaPreloader = {
      preloadImage: vi.fn(),
      preloadVideo: vi.fn(),
    }
    const seen = new Set<string>(['https://img.example.com/already.jpg'])

    const loadedUrls = preloadMediaCandidates(
      [
        { kind: 'image', url: 'https://img.example.com/already.jpg' },
        { kind: 'image', url: 'https://img.example.com/one.jpg' },
        { kind: 'video', url: 'https://video.example.com/two.mp4' },
        { kind: 'image', url: 'https://img.example.com/three.jpg' },
      ],
      {
        concurrency: 2,
        preloader,
        seen,
      },
    )

    expect(loadedUrls).toEqual([
      'https://img.example.com/one.jpg',
      'https://video.example.com/two.mp4',
    ])
    expect(preloader.preloadImage).toHaveBeenCalledWith('https://img.example.com/one.jpg')
    expect(preloader.preloadVideo).toHaveBeenCalledWith('https://video.example.com/two.mp4')
    expect(preloader.preloadImage).not.toHaveBeenCalledWith('https://img.example.com/three.jpg')
  })

  it('does nothing outside the browser', () => {
    const originalDocument = globalThis.document

    try {
      Reflect.deleteProperty(globalThis, 'document')

      expect(
        preloadMediaCandidates([{ kind: 'image', url: 'https://img.example.com/one.jpg' }]),
      ).toEqual([])
    } finally {
      Object.defineProperty(globalThis, 'document', {
        configurable: true,
        value: originalDocument,
      })
    }
  })
})
