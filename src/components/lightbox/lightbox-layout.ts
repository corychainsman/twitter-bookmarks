type LightboxSlideLike = {
  type?: string
}

export const LIGHTBOX_FOOTER_MEDIA_PADDING = 'min(15rem, 28vh)'
export const LIGHTBOX_VIDEO_CONTROLS_MEDIA_PADDING = 'min(19rem, 34vh)'

export function isVideoLightboxSlide(slide: LightboxSlideLike): boolean {
  return slide.type === 'video'
}

export function getLightboxMediaPaddingBottom(slide: LightboxSlideLike): string {
  return isVideoLightboxSlide(slide)
    ? LIGHTBOX_VIDEO_CONTROLS_MEDIA_PADDING
    : LIGHTBOX_FOOTER_MEDIA_PADDING
}
