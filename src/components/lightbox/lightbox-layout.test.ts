import { describe, expect, it } from 'vitest'

import {
  LIGHTBOX_FOOTER_MEDIA_PADDING,
  LIGHTBOX_IMAGE_NATIVE_SIZE_MARGIN,
  LIGHTBOX_TWEET_EMBED_EXTRA_HEIGHT,
  LIGHTBOX_TWEET_EMBED_MARGIN,
  LIGHTBOX_VIDEO_CONTROLS_MEDIA_PADDING,
  getAvailableLightboxBox,
  getContainedBoxWithinBounds,
  getContainedLightboxBox,
  getLightboxMediaPaddingBottom,
  isImageLightboxSlide,
  isLightboxImageRenderedAtNativeSize,
  isVideoLightboxSlide,
} from '@/components/lightbox/lightbox-layout'

describe('isVideoLightboxSlide', () => {
  it('detects video slides', () => {
    expect(isVideoLightboxSlide({ type: 'video' })).toBe(true)
  })

  it('treats image slides as non-video slides', () => {
    expect(isVideoLightboxSlide({ type: 'image' })).toBe(false)
    expect(isVideoLightboxSlide({})).toBe(false)
  })
})

describe('getLightboxMediaPaddingBottom', () => {
  it('reserves extra bottom space for video controls', () => {
    expect(getLightboxMediaPaddingBottom({ type: 'video' })).toBe(
      LIGHTBOX_VIDEO_CONTROLS_MEDIA_PADDING,
    )
  })

  it('uses the standard footer clearance for non-video slides', () => {
    expect(getLightboxMediaPaddingBottom({ type: 'image' })).toBe(
      LIGHTBOX_FOOTER_MEDIA_PADDING,
    )
  })
})

describe('isImageLightboxSlide', () => {
  it('treats image slides and untyped slides as image slides', () => {
    expect(isImageLightboxSlide({ type: 'image' })).toBe(true)
    expect(isImageLightboxSlide({})).toBe(true)
  })

  it('excludes video slides', () => {
    expect(isImageLightboxSlide({ type: 'video' })).toBe(false)
  })
})

describe('isLightboxImageRenderedAtNativeSize', () => {
  it('returns true when the image fits within the lightbox viewport at native size', () => {
    expect(
      isLightboxImageRenderedAtNativeSize(
        { type: 'image', width: 600, height: 400 },
        { width: 1200, height: 900 },
      ),
    ).toBe(true)
  })

  it('returns false when the image would be scaled down to fit', () => {
    expect(
      isLightboxImageRenderedAtNativeSize(
        {
          type: 'image',
          width: 1200 - LIGHTBOX_IMAGE_NATIVE_SIZE_MARGIN * 2 + 1,
          height: 400,
        },
        { width: 1200, height: 900 },
      ),
    ).toBe(false)
  })

  it('returns false for videos and slides without dimensions', () => {
    expect(
      isLightboxImageRenderedAtNativeSize(
        { type: 'video', width: 400, height: 300 },
        { width: 1200, height: 900 },
      ),
    ).toBe(false)
    expect(isLightboxImageRenderedAtNativeSize({}, { width: 1200, height: 900 })).toBe(false)
  })
})

describe('getContainedLightboxBox', () => {
  it('keeps native size when the media already fits in the available space', () => {
    expect(
      getContainedLightboxBox(
        { type: 'tweet-embed', width: 500, height: 400 },
        { width: 1200, height: 900 },
      ),
    ).toEqual({
      width: 500,
      height: 400,
    })
  })

  it('fits landscape media to width first', () => {
    expect(
      getContainedLightboxBox(
        { type: 'tweet-embed', width: 1600, height: 900 },
        { width: 1200, height: 900 },
      ),
    ).toEqual({
      width:
        (900 - LIGHTBOX_TWEET_EMBED_MARGIN * 2 - 240 - LIGHTBOX_TWEET_EMBED_EXTRA_HEIGHT) *
        (1600 / 900),
      height: 900 - LIGHTBOX_TWEET_EMBED_MARGIN * 2 - 240 - LIGHTBOX_TWEET_EMBED_EXTRA_HEIGHT,
    })
  })

  it('fits portrait media to height first', () => {
    expect(
      getContainedLightboxBox(
        { type: 'tweet-embed', width: 900, height: 1600 },
        { width: 1200, height: 900 },
      ),
    ).toEqual({
      width:
        (900 - LIGHTBOX_TWEET_EMBED_MARGIN * 2 - 240 - LIGHTBOX_TWEET_EMBED_EXTRA_HEIGHT) *
        (900 / 1600),
      height: 900 - LIGHTBOX_TWEET_EMBED_MARGIN * 2 - 240 - LIGHTBOX_TWEET_EMBED_EXTRA_HEIGHT,
    })
  })

  it('falls back to viewport bounds when slide dimensions are missing', () => {
    expect(getContainedLightboxBox({ type: 'tweet-embed' }, { width: 1200, height: 900 })).toEqual({
      width: 1200 - LIGHTBOX_TWEET_EMBED_MARGIN * 2,
      height: 900 - LIGHTBOX_TWEET_EMBED_MARGIN * 2 - 240 - LIGHTBOX_TWEET_EMBED_EXTRA_HEIGHT,
    })
  })

  it('uses the provided footer clearance override when supplied', () => {
    expect(
      getContainedLightboxBox(
        { type: 'tweet-embed', width: 1600, height: 900 },
        { width: 1200, height: 900 },
        { footerClearance: 300, embedExtraHeight: 0 },
      ),
    ).toEqual({
      width: (900 - LIGHTBOX_TWEET_EMBED_MARGIN * 2 - 300) * (1600 / 900),
      height: 900 - LIGHTBOX_TWEET_EMBED_MARGIN * 2 - 300,
    })
  })
})

describe('getContainedBoxWithinBounds', () => {
  it('contains media within explicit measured bounds', () => {
    expect(
      getContainedBoxWithinBounds(
        { type: 'tweet-embed', width: 900, height: 1600 },
        { width: 500, height: 700 },
      ),
    ).toEqual({
      width: 393.75,
      height: 700,
    })
  })
})

describe('getAvailableLightboxBox', () => {
  it('returns the raw available bounds above the footer area', () => {
    expect(
      getAvailableLightboxBox(
        { type: 'tweet-embed' },
        { width: 1200, height: 900 },
        { footerClearance: 300, embedExtraHeight: 0 },
      ),
    ).toEqual({
      width: 1200 - LIGHTBOX_TWEET_EMBED_MARGIN * 2,
      height: 900 - LIGHTBOX_TWEET_EMBED_MARGIN * 2 - 300,
    })
  })
})
