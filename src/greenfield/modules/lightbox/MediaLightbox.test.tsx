import { act, fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import type { MediaAsset, MediaRecord } from "@/greenfield/contracts/domain"

import { MediaLightbox } from "./MediaLightbox"

const media: MediaAsset = {
  id: "post-1:0",
  recordId: "post-1",
  kind: "image",
  title: "A study",
  description: "Post description",
  width: 1_600,
  height: 900,
  placeholder: "",
  wall: [{ url: "https://media.test/wall.jpg", width: 800, height: 450, mimeType: "image/jpeg" }],
  lightbox: [{ url: "https://media.test/full.jpg", width: 1_600, height: 900, mimeType: "image/jpeg" }],
}

const record: MediaRecord = {
  id: "post-1",
  title: "A study",
  description: "Post description",
  sourceLabel: "@ada",
  authorUrl: "https://x.com/ada",
  sourceUrl: "https://x.com/ada/status/post-1",
  postedAt: "2026-07-15T00:25:00.000Z",
  tags: [],
  assets: [media],
  eligibleRepresentativeAssetIds: [media.id],
}

describe("MediaLightbox metadata", () => {
  it("links the author and localized post timestamp to X", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    )

    render(
      <MediaLightbox
        media={media}
        record={record}
        onClose={vi.fn()}
        onPrevious={vi.fn()}
        onNext={vi.fn()}
        onSelectSibling={vi.fn()}
      />,
    )

    expect(screen.getByRole("link", { name: "@ada" })).toHaveAttribute(
      "href",
      "https://x.com/ada",
    )

    const localizedTimestamp = new Date(record.postedAt).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    })
    const postLink = screen.getByRole("link", { name: `Posted ${localizedTimestamp}` })

    expect(postLink).toHaveAttribute("href", "https://x.com/ada/status/post-1")
    expect(postLink.querySelector("time")).toHaveAttribute("datetime", record.postedAt)
    expect(screen.queryByText("Type")).not.toBeInTheDocument()
    expect(document.querySelector("dt")).toBeNull()
    expect(document.querySelector("h2:not(.sr-only)")).toBeNull()

    fireEvent.click(screen.getByRole("button", { name: "Open media details" }))
    expect(document.querySelector('[data-slot="drawer-overlay"]')).toHaveClass(
      "supports-backdrop-filter:backdrop-blur-none",
    )
  })

  it("copies a minimal addressable media URL and briefly confirms it", async () => {
    vi.useFakeTimers()
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal("navigator", {
      ...navigator,
      clipboard: { writeText },
    })

    render(
      <MediaLightbox
        media={media}
        record={record}
        onClose={vi.fn()}
        onPrevious={vi.fn()}
        onNext={vi.fn()}
        onSelectSibling={vi.fn()}
      />,
    )

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy media link" }))
    })
    expect(writeText).toHaveBeenCalledWith("http://localhost:3000/media/post-1%3A0")
    expect(screen.getByRole("status")).toHaveTextContent("Copied")

    act(() => vi.advanceTimersByTime(1_400))
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
    vi.useRealTimers()
  })
})
