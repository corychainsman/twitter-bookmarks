type LightboxSlideLike = {
  type?: string
  width?: number
  height?: number
}

export const LIGHTBOX_FOOTER_MEDIA_PADDING = 'min(15rem, 28vh)'
export const LIGHTBOX_VIDEO_CONTROLS_MEDIA_PADDING = 'min(19rem, 34vh)'
export const LIGHTBOX_IMAGE_NATIVE_SIZE_MARGIN = 32

export function isVideoLightboxSlide(slide: LightboxSlideLike): boolean {
  return slide.type === 'video'
}

export function isImageLightboxSlide(slide: LightboxSlideLike): boolean {
  return !slide.type || slide.type === 'image'
}

export function getLightboxMediaPaddingBottom(slide: LightboxSlideLike): string {
  return isVideoLightboxSlide(slide)
    ? LIGHTBOX_VIDEO_CONTROLS_MEDIA_PADDING
    : LIGHTBOX_FOOTER_MEDIA_PADDING
}

type LightboxViewportLike = {
  width: number
  height: number
}

export function isLightboxImageRenderedAtNativeSize(
  slide: LightboxSlideLike,
  viewport: LightboxViewportLike,
): boolean {
  if (
    !isImageLightboxSlide(slide) ||
    !Number.isFinite(slide.width) ||
    !Number.isFinite(slide.height) ||
    slide.width === undefined ||
    slide.height === undefined
  ) {
    return false
  }

  const availableWidth = Math.max(0, viewport.width - LIGHTBOX_IMAGE_NATIVE_SIZE_MARGIN * 2)
  const availableHeight = Math.max(
    0,
    viewport.height - LIGHTBOX_IMAGE_NATIVE_SIZE_MARGIN * 2 - estimateFooterClearance(slide),
  )

  return slide.width <= availableWidth && slide.height <= availableHeight
}

function estimateFooterClearance(slide: LightboxSlideLike): number {
  return isVideoLightboxSlide(slide) ? 320 : 240
}
