import type { CSSProperties, ReactNode } from 'react'

type MeasuredMasonryCellProps = {
  children: ReactNode
  gridId: string
  style: CSSProperties
}

export function MeasuredMasonryCell({
  children,
  gridId,
  style,
}: MeasuredMasonryCellProps) {
  return (
    <div className="app-masonry-cell" style={style} data-grid-id={gridId}>
      {children}
    </div>
  )
}
