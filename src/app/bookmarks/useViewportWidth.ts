import * as React from 'react'

const DEFAULT_VIEWPORT_WIDTH = 1280

export function useViewportWidth(): number {
  const [width, setWidth] = React.useState(() =>
    typeof window === 'undefined' ? DEFAULT_VIEWPORT_WIDTH : window.innerWidth,
  )

  React.useEffect(() => {
    let frameId = 0
    const commitWidth = () => {
      frameId = 0
      setWidth((current) => (current === window.innerWidth ? current : window.innerWidth))
    }
    const handleResize = () => {
      if (frameId === 0) frameId = window.requestAnimationFrame(commitWidth)
    }

    window.addEventListener('resize', handleResize, { passive: true })
    return () => {
      window.removeEventListener('resize', handleResize)
      if (frameId !== 0) window.cancelAnimationFrame(frameId)
    }
  }, [])

  return width
}
