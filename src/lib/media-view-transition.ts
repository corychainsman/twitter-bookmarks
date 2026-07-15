type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => {
    finished: Promise<void>
  }
}

export function startMediaViewTransition(update: () => void): Promise<void> | null {
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const transitionDocument = document as ViewTransitionDocument

  if (prefersReducedMotion || !transitionDocument.startViewTransition) {
    update()
    return null
  }

  return transitionDocument.startViewTransition(update).finished
}
