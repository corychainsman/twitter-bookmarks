import * as React from 'react'

import type { BookmarksMasonryCache } from '@/components/grid/masonry-estimates'

type MeasuredMasonryCellProps = {
  cache: BookmarksMasonryCache
  children: React.ReactNode
  gridId: string
  index: number
  parent: {
    invalidateCellSizeAfterRender?: (cell: {
      columnIndex: number
      rowIndex: number
    }) => void
  }
  style: React.CSSProperties
}

function resolveMeasuredElementSize(input: {
  cache: BookmarksMasonryCache
  element: HTMLElement
}) {
  const { cache, element } = input
  const styleWidth = element.style.width
  const styleHeight = element.style.height

  if (!cache.hasFixedWidth()) {
    element.style.width = 'auto'
  }

  if (!cache.hasFixedHeight()) {
    element.style.height = 'auto'
  }

  const height = Math.ceil(element.offsetHeight)
  const width = Math.ceil(element.offsetWidth)

  if (styleWidth) {
    element.style.width = styleWidth
  }

  if (styleHeight) {
    element.style.height = styleHeight
  }

  return { height, width }
}

export function MeasuredMasonryCell({
  cache,
  children,
  gridId,
  index,
  parent,
  style,
}: MeasuredMasonryCellProps) {
  const childRef = React.useRef<HTMLElement | null>(null)

  const measure = React.useCallback(() => {
    const element = childRef.current
    if (
      !element ||
      !element.ownerDocument?.defaultView ||
      !(element instanceof element.ownerDocument.defaultView.HTMLElement)
    ) {
      return
    }

    const { height, width } = resolveMeasuredElementSize({
      cache,
      element,
    })
    const hasCachedMeasurement = cache.has(index, 0)

    if (
      hasCachedMeasurement &&
      cache.getHeight(index, 0) === height &&
      cache.getWidth(index, 0) === width
    ) {
      return
    }

    cache.set(index, 0, width, height)
    parent.invalidateCellSizeAfterRender?.({
      columnIndex: 0,
      rowIndex: index,
    })
  }, [cache, index, parent])

  const registerChild = React.useCallback((element: HTMLDivElement | null) => {
    childRef.current = element
  }, [])

  React.useLayoutEffect(() => {
    measure()
  }, [measure])

  React.useEffect(() => {
    const element = childRef.current
    if (!element || typeof ResizeObserver === 'undefined') {
      return
    }

    const observer = new ResizeObserver(() => {
      measure()
    })

    observer.observe(element)

    return () => observer.disconnect()
  }, [measure])

  return (
    <div ref={registerChild} style={style} data-grid-id={gridId}>
      {children}
    </div>
  )
}
