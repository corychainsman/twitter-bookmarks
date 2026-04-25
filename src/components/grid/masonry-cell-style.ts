import type { CSSProperties } from 'react'

const HIDDEN_MEASUREMENT_CELL_STYLE: CSSProperties = {
  left: 0,
  pointerEvents: 'none',
  position: 'absolute',
  top: 0,
  visibility: 'hidden',
  zIndex: -1,
}

export function resolveBookmarksMasonryCellStyle(style: CSSProperties | undefined): CSSProperties {
  if (!style) {
    return HIDDEN_MEASUREMENT_CELL_STYLE
  }

  if (style.position === 'absolute') {
    return style
  }

  return {
    ...style,
    ...HIDDEN_MEASUREMENT_CELL_STYLE,
  }
}
