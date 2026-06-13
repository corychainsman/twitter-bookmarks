export const AUTOPLAY_ROOT_MARGIN = '180px 0px'
export const AUTOPLAY_THRESHOLD = 0.35

export type AutoplayBandState = {
  id: string
  isActiveBand: boolean
}

export function measureAutoplayCandidate(
  id: string,
  options: {
    isIntersecting: boolean
    intersectionRatio: number
    top: number
    height: number
    viewportHeight: number
    prewarmPx?: number
    threshold?: number
  },
): AutoplayBandState {
  const prewarmPx = options.prewarmPx ?? 180
  const threshold = options.threshold ?? AUTOPLAY_THRESHOLD
  const itemCenter = options.top + options.height / 2
  const isActiveBand =
    options.isIntersecting &&
    options.intersectionRatio >= threshold &&
    itemCenter >= -prewarmPx &&
    itemCenter <= options.viewportHeight + prewarmPx

  return {
    id,
    isActiveBand,
  }
}

export function candidateFromEntry(
  id: string,
  entry: Pick<
    IntersectionObserverEntry,
    'isIntersecting' | 'intersectionRatio' | 'boundingClientRect' | 'rootBounds'
  >,
): AutoplayBandState {
  const viewportHeight =
    entry.rootBounds?.height ??
    (typeof window === 'undefined' ? entry.boundingClientRect.height : window.innerHeight)

  return measureAutoplayCandidate(id, {
    isIntersecting: entry.isIntersecting,
    intersectionRatio: entry.intersectionRatio,
    top: entry.boundingClientRect.top,
    height: entry.boundingClientRect.height,
    viewportHeight,
  })
}
