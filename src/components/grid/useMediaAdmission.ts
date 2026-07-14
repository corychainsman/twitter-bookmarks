import * as React from 'react'

const MEDIA_ADMISSION_ROOT_MARGIN = '300px 0px'

export function useMediaAdmission(
  containerElement: HTMLElement | null,
  visibleCount: number,
): ReadonlySet<string> {
  const [admittedIds, setAdmittedIds] = React.useState<ReadonlySet<string>>(() => new Set())

  React.useEffect(() => {
    if (!containerElement) {
      return undefined
    }

    const elements = [...containerElement.querySelectorAll<HTMLElement>('[data-media-admission-id]')]
      .slice(0, visibleCount)
      .filter((element) => {
        const id = element.dataset.mediaAdmissionId
        return Boolean(id && !admittedIds.has(id))
      })

    if (elements.length === 0) {
      return undefined
    }

    if (typeof IntersectionObserver === 'undefined') {
      let cancelled = false
      queueMicrotask(() => {
        if (cancelled) return
        setAdmittedIds((current) => {
          const next = new Set(current)
          for (const element of elements) {
            const id = element.dataset.mediaAdmissionId
            if (id) next.add(id)
          }
          return next
        })
      })
      return () => {
        cancelled = true
      }
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const newlyAdmittedIds: string[] = []
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const element = entry.target as HTMLElement
          const id = element.dataset.mediaAdmissionId
          if (id) newlyAdmittedIds.push(id)
          observer.unobserve(element)
        }
        if (newlyAdmittedIds.length > 0) {
          setAdmittedIds((current) => {
            const next = new Set(current)
            for (const id of newlyAdmittedIds) next.add(id)
            return next
          })
        }
      },
      { rootMargin: MEDIA_ADMISSION_ROOT_MARGIN },
    )

    for (const element of elements) observer.observe(element)
    return () => observer.disconnect()
  }, [admittedIds, containerElement, visibleCount])

  return admittedIds
}

export function useIOSColumnWidth(
  gridElement: HTMLElement | null,
  columnCount: number,
): number {
  const fallbackWidth =
    typeof window === 'undefined'
      ? 320 / Math.max(1, columnCount)
      : window.innerWidth / Math.max(1, columnCount)
  const [columnWidth, setColumnWidth] = React.useState(() => Math.max(1, Math.floor(fallbackWidth)))

  React.useEffect(() => {
    if (!gridElement) return undefined

    const measure = () => {
      const firstItem = gridElement.querySelector<HTMLElement>('.app-ios-static-item')
      const measuredWidth = firstItem?.getBoundingClientRect().width ?? 0
      const estimatedWidth = gridElement.clientWidth / Math.max(1, columnCount)
      setColumnWidth(Math.max(1, Math.floor(measuredWidth || estimatedWidth || fallbackWidth)))
    }

    measure()
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure, { passive: true })
      return () => window.removeEventListener('resize', measure)
    }

    const observer = new ResizeObserver(measure)
    observer.observe(gridElement)
    return () => observer.disconnect()
  }, [columnCount, fallbackWidth, gridElement])

  return columnWidth
}
