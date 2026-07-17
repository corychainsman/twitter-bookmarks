export type SpatialDirection = "up" | "down" | "left" | "right"

export interface SpatialRect {
  id: string
  left: number
  top: number
  width: number
  height: number
}

function center(rect: SpatialRect): { x: number; y: number } {
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  }
}

function intervalGap(
  firstStart: number,
  firstLength: number,
  secondStart: number,
  secondLength: number,
): number {
  const firstEnd = firstStart + firstLength
  const secondEnd = secondStart + secondLength

  return Math.max(0, firstStart - secondEnd, secondStart - firstEnd)
}

export function findSpatialNeighbor(
  rects: SpatialRect[],
  currentId: string,
  direction: SpatialDirection,
): string | undefined {
  const current = rects.find((rect) => rect.id === currentId)

  if (!current) {
    return undefined
  }

  const currentCenter = center(current)
  const candidates = rects.flatMap((candidate) => {
    if (candidate.id === current.id) {
      return []
    }

    const candidateCenter = center(candidate)
    const deltaX = candidateCenter.x - currentCenter.x
    const deltaY = candidateCenter.y - currentCenter.y
    const horizontal = direction === "left" || direction === "right"
    const primary = horizontal ? Math.abs(deltaX) : Math.abs(deltaY)
    const inDirection = direction === "left"
      ? deltaX < -1
      : direction === "right"
        ? deltaX > 1
        : direction === "up"
          ? deltaY < -1
          : deltaY > 1

    if (!inDirection) {
      return []
    }

    const crossCenterDistance = horizontal ? Math.abs(deltaY) : Math.abs(deltaX)
    const crossAxisGap = horizontal
      ? intervalGap(current.top, current.height, candidate.top, candidate.height)
      : intervalGap(current.left, current.width, candidate.left, candidate.width)
    const score = primary + crossAxisGap * 4 + crossCenterDistance * 0.2

    return [{ candidate, score }]
  })

  candidates.sort((left, right) => (
    left.score - right.score || left.candidate.id.localeCompare(right.candidate.id)
  ))

  return candidates[0]?.candidate.id
}
