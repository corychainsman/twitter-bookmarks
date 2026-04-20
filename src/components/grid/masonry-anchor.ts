export type MasonryScrollAnchor = {
  gridId: string
  top: number
}

export type MasonryScrollAnchorRequest = MasonryScrollAnchor & {
  requestId: number
}

function isVisible(rect: DOMRect): boolean {
  return rect.bottom > 0 && rect.top < window.innerHeight
}

function escapeGridIdForSelector(gridId: string): string {
  return gridId.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

export function captureMasonryScrollAnchor(
  root: ParentNode = document,
): MasonryScrollAnchor | null {
  if (typeof window === 'undefined') {
    return null
  }

  let anchor: MasonryScrollAnchor | null = null

  for (const element of root.querySelectorAll<HTMLElement>('[data-grid-id]')) {
    const gridId = element.dataset.gridId
    if (!gridId) {
      continue
    }

    const rect = element.getBoundingClientRect()
    if (!isVisible(rect)) {
      continue
    }

    if (!anchor || rect.top < anchor.top) {
      anchor = {
        gridId,
        top: rect.top,
      }
    }
  }

  return anchor
}

export function restoreMasonryScrollAnchor(
  anchor: MasonryScrollAnchor,
  root: ParentNode = document,
): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  const element = root.querySelector<HTMLElement>(
    `[data-grid-id="${escapeGridIdForSelector(anchor.gridId)}"]`,
  )

  if (!element) {
    return false
  }

  const delta = element.getBoundingClientRect().top - anchor.top
  if (Math.abs(delta) < 0.5) {
    return true
  }

  window.scrollTo({
    top: window.scrollY + delta,
    behavior: 'auto',
  })

  return true
}
