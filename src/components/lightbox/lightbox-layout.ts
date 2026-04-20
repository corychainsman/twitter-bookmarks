type LightboxSlideLike = {
  type?: string
  width?: number
  height?: number
}

export const LIGHTBOX_FOOTER_MEDIA_PADDING = 'min(15rem, 28vh)'
export const LIGHTBOX_VIDEO_CONTROLS_MEDIA_PADDING = 'min(19rem, 34vh)'
export const LIGHTBOX_IMAGE_NATIVE_SIZE_MARGIN = 32
export const LIGHTBOX_TWEET_EMBED_MARGIN = 16
export const LIGHTBOX_TWEET_EMBED_EXTRA_HEIGHT = 0

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

type LightboxBoxLike = {
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

export function getContainedLightboxBox(
  slide: LightboxSlideLike,
  viewport: LightboxViewportLike,
  options?: {
    footerClearance?: number
    embedExtraHeight?: number
  },
): { width: number; height: number } {
  return getContainedBoxWithinBounds(
    slide,
    getAvailableLightboxBox(
      slide,
      viewport,
      options,
    ),
  )
}

export function getContainedBoxWithinBounds(
  slide: LightboxSlideLike,
  availableBox: LightboxBoxLike,
): { width: number; height: number } {
  const availableWidth = Math.max(0, availableBox.width)
  const availableHeight = Math.max(0, availableBox.height)

  if (
    !Number.isFinite(slide.width) ||
    !Number.isFinite(slide.height) ||
    slide.width === undefined ||
    slide.height === undefined ||
    slide.width <= 0 ||
    slide.height <= 0
  ) {
    return {
      width: availableWidth,
      height: availableHeight,
    }
  }

  // Never upscale embeds beyond their native media dimensions.
  if (slide.width <= availableWidth && slide.height <= availableHeight) {
    return {
      width: slide.width,
      height: slide.height,
    }
  }

  const aspectRatio = slide.width / slide.height
  const widthFromHeight = availableHeight * aspectRatio
  const heightFromWidth = availableWidth / aspectRatio

  if (heightFromWidth <= availableHeight) {
    return {
      width: availableWidth,
      height: heightFromWidth,
    }
  }

  return {
    width: widthFromHeight,
    height: availableHeight,
  }
}

export function getAvailableLightboxBox(
  slide: LightboxSlideLike,
  viewport: LightboxViewportLike,
  options?: {
    footerClearance?: number
    embedExtraHeight?: number
  },
): { width: number; height: number } {
  const footerClearance = options?.footerClearance ?? estimateFooterClearance(slide)
  const embedExtraHeight = options?.embedExtraHeight ?? estimateEmbedExtraHeight(slide)

  return {
    width: Math.max(0, viewport.width - LIGHTBOX_TWEET_EMBED_MARGIN * 2),
    height: Math.max(
      0,
      viewport.height -
        LIGHTBOX_TWEET_EMBED_MARGIN * 2 -
        footerClearance -
        embedExtraHeight,
    ),
  }
}

function estimateFooterClearance(slide: LightboxSlideLike): number {
  return isVideoLightboxSlide(slide) ? 320 : 240
}

function estimateEmbedExtraHeight(slide: LightboxSlideLike): number {
  return slide.type === 'tweet-embed' ? LIGHTBOX_TWEET_EMBED_EXTRA_HEIGHT : 0
}
