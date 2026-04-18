export const AUTOPLAY_ROOT_MARGIN = '180px 0px'
export const AUTOPLAY_THRESHOLD = 0.35
export const MAX_CONCURRENT_AUTOPLAY = 2

export type AutoplayCandidateState = {
  id: string
  isActiveBand: boolean
  distanceToViewportCenter: number
}

type AutoplayListener = (shouldPlay: boolean) => void

export function selectAutoplayIds(
  candidates: AutoplayCandidateState[],
  limit = MAX_CONCURRENT_AUTOPLAY,
): string[] {
  return candidates
    .filter((candidate) => candidate.isActiveBand)
    .sort((left, right) => {
      if (left.distanceToViewportCenter !== right.distanceToViewportCenter) {
        return left.distanceToViewportCenter - right.distanceToViewportCenter
      }

      return left.id.localeCompare(right.id)
    })
    .slice(0, limit)
    .map((candidate) => candidate.id)
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
): AutoplayCandidateState {
  const prewarmPx = options.prewarmPx ?? 180
  const threshold = options.threshold ?? AUTOPLAY_THRESHOLD
  const itemCenter = options.top + options.height / 2
  const viewportCenter = options.viewportHeight / 2
  const isActiveBand =
    options.isIntersecting &&
    options.intersectionRatio >= threshold &&
    itemCenter >= -prewarmPx &&
    itemCenter <= options.viewportHeight + prewarmPx

  return {
    id,
    isActiveBand,
    distanceToViewportCenter: Math.abs(itemCenter - viewportCenter),
  }
}

export function candidateFromEntry(
  id: string,
  entry: Pick<
    IntersectionObserverEntry,
    'isIntersecting' | 'intersectionRatio' | 'boundingClientRect' | 'rootBounds'
  >,
): AutoplayCandidateState {
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

export class AutoplayCoordinator {
  private readonly candidates = new Map<string, AutoplayCandidateState>()

  private readonly listeners = new Map<string, AutoplayListener>()

  private readonly limit: number

  constructor(limit = MAX_CONCURRENT_AUTOPLAY) {
    this.limit = limit
  }

  subscribe(id: string, listener: AutoplayListener): () => void {
    this.listeners.set(id, listener)
    this.publish()

    return () => {
      this.listeners.delete(id)
      this.candidates.delete(id)
      this.publish()
    }
  }

  update(candidate: AutoplayCandidateState): void {
    this.candidates.set(candidate.id, candidate)
    this.publish()
  }

  remove(id: string): void {
    const removedCandidate = this.candidates.delete(id)
    const removedListener = this.listeners.delete(id)

    if (removedCandidate || removedListener) {
      this.publish()
    }
  }

  private publish(): void {
    const allowedIds = new Set(selectAutoplayIds([...this.candidates.values()], this.limit))

    for (const [id, listener] of this.listeners) {
      listener(allowedIds.has(id))
    }
  }
}

let sharedCoordinator: AutoplayCoordinator | null = null

export function getAutoplayCoordinator(): AutoplayCoordinator {
  if (!sharedCoordinator) {
    sharedCoordinator = new AutoplayCoordinator()
  }

  return sharedCoordinator
}
