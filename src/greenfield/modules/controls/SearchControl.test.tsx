import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { SearchControl } from "./SearchControl"

describe("SearchControl", () => {
  it("signals semantic intent as soon as the search field receives focus", async () => {
    const user = userEvent.setup()
    const onIntent = vi.fn()
    render(
      <SearchControl
        value=""
        onIntent={onIntent}
        onChange={() => undefined}
        onSubmit={() => undefined}
      />,
    )

    await user.click(screen.getByRole("searchbox", { name: "Search media" }))

    expect(onIntent).toHaveBeenCalledOnce()
  })

  it("keeps typing separate from an explicit search commit", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const onSubmit = vi.fn()
    const { rerender } = render(
      <SearchControl
        value=""
        onChange={onChange}
        onSubmit={onSubmit}
      />,
    )

    const input = screen.getByRole("searchbox", { name: "Search media" })
    await user.type(input, "  texture  ")

    expect(onChange).toHaveBeenCalled()
    expect(onSubmit).not.toHaveBeenCalled()

    rerender(
      <SearchControl
        value="  texture  "
        onChange={onChange}
        onSubmit={onSubmit}
      />,
    )
    await user.click(screen.getByRole("button", { name: "Submit search" }))

    expect(onSubmit).toHaveBeenCalledOnce()
    expect(onSubmit).toHaveBeenCalledWith("texture")
  })

  it("clears and commits the empty query immediately", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const onSubmit = vi.fn()
    render(
      <SearchControl
        value="texture"
        onChange={onChange}
        onSubmit={onSubmit}
      />,
    )

    await user.click(screen.getByRole("button", { name: "Clear search" }))

    expect(onChange).toHaveBeenCalledOnce()
    expect(onChange).toHaveBeenCalledWith("")
    expect(onSubmit).toHaveBeenCalledOnce()
    expect(onSubmit).toHaveBeenCalledWith("")
  })
})
