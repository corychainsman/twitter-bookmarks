/**
 * Captures the exact pixels a grid tile is currently showing at the moment the
 * lightbox opens, so the lightbox can render that already-fetched frame
 * immediately (no reload flash) and upgrade to a higher-res source underneath.
 *
 * Keyed by gridId (`${tweetId}:${mediaIndex}`).
 */
export type MediaHandoff =
  | {
      kind: 'video'
      /** Playback position of the grid preview when the lightbox opened. */
      currentTime: number
      /** Resolved poster URL the grid already decoded (cached). */
      poster?: string
    }
  | {
      kind: 'image'
      /** The exact responsive variant the grid <img> resolved to (cached). */
      src: string
    }

const handoffs = new Map<string, MediaHandoff>()

export function setMediaHandoff(gridId: string, handoff: MediaHandoff): void {
  handoffs.set(gridId, handoff)
}

export function getMediaHandoff(gridId: string): MediaHandoff | undefined {
  return handoffs.get(gridId)
}

/**
 * Reads the currently-displayed media element inside a grid tile and records a
 * handoff for it. Returns true when something was captured.
 */
export function captureMediaHandoff(gridId: string, mediaElement: Element | null): boolean {
  if (mediaElement instanceof HTMLVideoElement) {
    setMediaHandoff(gridId, {
      kind: 'video',
      currentTime: Number.isFinite(mediaElement.currentTime) ? mediaElement.currentTime : 0,
      poster: mediaElement.poster || undefined,
    })
    return true
  }

  if (mediaElement instanceof HTMLImageElement) {
    const src = mediaElement.currentSrc || mediaElement.src
    if (src) {
      setMediaHandoff(gridId, { kind: 'image', src })
      return true
    }
  }

  return false
}
