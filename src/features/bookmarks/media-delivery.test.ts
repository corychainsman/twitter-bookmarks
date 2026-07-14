import { describe, expect, it } from 'vitest'

import {
  resolveGridMediaDelivery,
  resolveLightboxMediaDelivery,
} from '@/features/bookmarks/media-delivery'
import type { GridItem, MediaItem } from '@/features/bookmarks/model'

const renditions = [320, 480, 680, 960, 1280].map((width) => ({
  url: `https://media.example.com/photo/w${width}.avif`,
  width,
  contentType: 'image/avif' as const,
}))

describe('media delivery', () => {
  it('caps published grid renditions at two device pixels per CSS pixel', () => {
    const item: GridItem = {
      gridId: 'tweet:0',
      tweetId: 'tweet',
      mediaIndex: 0,
      mediaType: 'photo',
      thumbUrl: 'https://media.example.com/photo.jpg',
      fullUrl: 'https://media.example.com/photo.jpg',
      imageRenditions: renditions,
    }

    expect(
      resolveGridMediaDelivery(item, {
        devicePixelRatio: 3,
        renderedWidth: 100,
        sizes: '100px',
      }),
    ).toMatchObject({
      image: {
        src: 'https://media.example.com/photo/w320.avif',
      },
      fallback: { src: 'https://media.example.com/photo.jpg' },
      renderOptimizedPicture: true,
    })
  })

  it('uses the published rendition catalog for full-size photos', () => {
    const media: MediaItem = {
      type: 'photo',
      thumbUrl: 'https://media.example.com/photo.jpg',
      fullUrl: 'https://media.example.com/photo.jpg',
      width: 1600,
      height: 1000,
      imageRenditions: renditions,
    }

    const delivery = resolveLightboxMediaDelivery(media)
    expect(delivery.kind).toBe('photo')
    if (delivery.kind !== 'photo') throw new Error('expected photo delivery')
    expect(delivery.src).toBe('https://media.example.com/photo/w1280.avif')
    expect(delivery.srcSet).toHaveLength(6)
  })
})
