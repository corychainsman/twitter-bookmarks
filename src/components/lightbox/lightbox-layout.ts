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
export const LIGHTBOX_DESKTOP_BREAKPOINT = 1024
export const LIGHTBOX_DETAILS_PANEL_MAX_WIDTH = 472
export const LIGHTBOX_DETAILS_PANEL_MIN_WIDTH = 384
export const LIGHTBOX_DETAILS_PANEL_VIEWPORT_RATIO = 0.32

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
  options?: {
    sidePanelWidth?: number
    footerClearance?: number
  },
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

  const sidePanelWidth = options?.sidePanelWidth ?? 0
  const availableWidth = Math.max(
    0,
    viewport.width - sidePanelWidth - LIGHTBOX_IMAGE_NATIVE_SIZE_MARGIN * 2,
  )
  const availableHeight = Math.max(
    0,
    viewport.height -
      LIGHTBOX_IMAGE_NATIVE_SIZE_MARGIN * 2 -
      (options?.footerClearance ?? estimateFooterClearance(slide)),
  )

  return slide.width <= availableWidth && slide.height <= availableHeight
}

export function getContainedLightboxBox(
  slide: LightboxSlideLike,
  viewport: LightboxViewportLike,
  options?: {
    footerClearance?: number
    embedExtraHeight?: number
    sidePanelWidth?: number
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
    sidePanelWidth?: number
  },
): { width: number; height: number } {
  const footerClearance = options?.footerClearance ?? estimateFooterClearance(slide)
  const embedExtraHeight = options?.embedExtraHeight ?? estimateEmbedExtraHeight(slide)
  const sidePanelWidth = options?.sidePanelWidth ?? 0

  return {
    width: Math.max(0, viewport.width - sidePanelWidth - LIGHTBOX_TWEET_EMBED_MARGIN * 2),
    height: Math.max(
      0,
      viewport.height -
        LIGHTBOX_TWEET_EMBED_MARGIN * 2 -
        footerClearance -
        embedExtraHeight,
    ),
  }
}

export function getLightboxDetailsPanelWidth(viewport: LightboxViewportLike): number {
  if (viewport.width < LIGHTBOX_DESKTOP_BREAKPOINT) {
    return 0
  }

  return Math.min(
    LIGHTBOX_DETAILS_PANEL_MAX_WIDTH,
    Math.max(
      LIGHTBOX_DETAILS_PANEL_MIN_WIDTH,
      Math.round(viewport.width * LIGHTBOX_DETAILS_PANEL_VIEWPORT_RATIO),
    ),
  )
}

function estimateFooterClearance(slide: LightboxSlideLike): number {
  return isVideoLightboxSlide(slide) ? 320 : 240
}

function estimateEmbedExtraHeight(slide: LightboxSlideLike): number {
  return slide.type === 'tweet-embed' ? LIGHTBOX_TWEET_EMBED_EXTRA_HEIGHT : 0
}
