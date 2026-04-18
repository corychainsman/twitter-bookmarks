import { describe, expect, it } from 'vitest'

import {
  LIGHTBOX_FOOTER_MEDIA_PADDING,
  LIGHTBOX_VIDEO_CONTROLS_MEDIA_PADDING,
  getLightboxMediaPaddingBottom,
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
