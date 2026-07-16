import type { ComponentProps, ReactNode } from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import type { ControlFilterValues } from "./types"

vi.mock("@/components/ui/drawer", () => ({
  Drawer: ({ open, children }: { open?: boolean; children: ReactNode }) =>
    open ? <div>{children}</div> : null,
  DrawerContent: ({ children, ...props }: ComponentProps<"div">) => (
    <div {...props}>{children}</div>
  ),
  DrawerDescription: (props: ComponentProps<"p">) => <p {...props} />,
  DrawerFooter: (props: ComponentProps<"div">) => <div {...props} />,
  DrawerHeader: (props: ComponentProps<"div">) => <div {...props} />,
  DrawerTitle: (props: ComponentProps<"h2">) => <h2 {...props} />,
}))

import { MobileFilterDrawer } from "./MobileFilterDrawer"

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.stubGlobal("ResizeObserver", ResizeObserverMock)

const committed: ControlFilterValues = {
  mediaKinds: ["image"],
  sources: [],
  widthRange: [0, 4_000],
  date: { preset: "any" },
}

describe("MobileFilterDrawer", () => {
  it("discards a draft after dismissal and commits only through Apply", async () => {
    const user = userEvent.setup()
    const onDraftChange = vi.fn()
    const onCommit = vi.fn()
    const props = {
      value: committed,
      range: { min: 0, max: 4_000, step: 100, unit: "px" },
      sourceSuggestions: [],
      sourceQuery: "",
      resultCount: 42,
      onOpenChange: vi.fn(),
      onDraftChange,
      onCommit,
      onSourceQueryChange: vi.fn(),
    }
    const { rerender } = render(<MobileFilterDrawer {...props} open />)

    await user.click(screen.getByRole("checkbox", { name: "Videos" }))
    expect(onDraftChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ mediaKinds: ["image", "video"] }),
    )
    expect(onCommit).not.toHaveBeenCalled()

    rerender(<MobileFilterDrawer {...props} open={false} />)
    rerender(<MobileFilterDrawer {...props} open />)

    expect(screen.getByRole("checkbox", { name: "Videos" })).not.toBeChecked()

    await user.click(screen.getByRole("checkbox", { name: "Videos" }))
    await user.click(screen.getByRole("button", { name: "Show 42 results" }))

    expect(onCommit).toHaveBeenCalledOnce()
    expect(onCommit).toHaveBeenCalledWith(
      expect.objectContaining({ mediaKinds: ["image", "video"] }),
    )
  })
})
