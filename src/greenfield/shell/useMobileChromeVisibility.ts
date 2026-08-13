import * as React from "react"

interface MobileChromeVisibilityOptions {
  pinned: boolean
  threshold?: number
}

export function useMobileChromeVisibility({
  pinned,
  threshold = 10,
}: MobileChromeVisibilityOptions): boolean {
  const [visible, setVisible] = React.useState(true)
  const lastScrollYRef = React.useRef(0)

  React.useEffect(() => {
    lastScrollYRef.current = window.scrollY

    function handleScroll() {
      const nextScrollY = Math.max(0, window.scrollY)

      if (pinned || nextScrollY <= threshold) {
        setVisible(true)
        lastScrollYRef.current = nextScrollY
        return
      }

      const delta = nextScrollY - lastScrollYRef.current
      if (Math.abs(delta) < threshold) return

      setVisible(delta < 0)
      lastScrollYRef.current = nextScrollY
    }

    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [pinned, threshold])

  return pinned || visible
}
