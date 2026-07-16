import { act, renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { useMobileChromeVisibility } from "./useMobileChromeVisibility"

function setScrollY(value: number) {
  Object.defineProperty(window, "scrollY", { configurable: true, value })
  window.dispatchEvent(new Event("scroll"))
}

describe("useMobileChromeVisibility", () => {
  it("hides on downward scroll and returns on upward scroll", () => {
    setScrollY(0)
    const { result } = renderHook(() =>
      useMobileChromeVisibility({ pinned: false }),
    )

    act(() => setScrollY(120))
    expect(result.current).toBe(false)

    act(() => setScrollY(70))
    expect(result.current).toBe(true)
  })

  it("stays visible while a control surface is pinned", () => {
    setScrollY(0)
    const { result, rerender } = renderHook(
      ({ pinned }) => useMobileChromeVisibility({ pinned }),
      { initialProps: { pinned: false } },
    )

    act(() => setScrollY(120))
    expect(result.current).toBe(false)

    rerender({ pinned: true })
    expect(result.current).toBe(true)

    act(() => setScrollY(240))
    expect(result.current).toBe(true)
  })
})
