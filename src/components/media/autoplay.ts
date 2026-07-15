export const GRID_VIDEO_AUTOPLAY = {
  rootMargin: '0px',
  startVisibility: 0.1,
  stopVisibility: 0,
} as const

export const AUTOPLAY_OBSERVER_THRESHOLDS = [
  GRID_VIDEO_AUTOPLAY.stopVisibility,
  GRID_VIDEO_AUTOPLAY.startVisibility,
  1,
]

export type AutoplayBandState = {
  id: string
  isActiveBand: boolean
}

export function measureAutoplayCandidate(
  id: string,
  options: {
    isIntersecting: boolean
    intersectionRatio: number
    wasActive?: boolean
  },
): AutoplayBandState {
  const isVisible =
    options.isIntersecting &&
    options.intersectionRatio > GRID_VIDEO_AUTOPLAY.stopVisibility
  const isActiveBand = options.wasActive
    ? isVisible
    : isVisible && options.intersectionRatio >= GRID_VIDEO_AUTOPLAY.startVisibility

  return {
    id,
    isActiveBand,
  }
}

export function candidateFromEntry(
  id: string,
  entry: Pick<
    IntersectionObserverEntry,
    'isIntersecting' | 'intersectionRatio'
  >,
  wasActive = false,
): AutoplayBandState {
  return measureAutoplayCandidate(id, {
    isIntersecting: entry.isIntersecting,
    intersectionRatio: entry.intersectionRatio,
    wasActive,
  })
}
