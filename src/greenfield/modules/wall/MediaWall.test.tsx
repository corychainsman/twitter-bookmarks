import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { forwardRef, useImperativeHandle, type ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { MediaAsset, WallTile } from "../../contracts/domain"

const gridSpies = vi.hoisted(() => ({
  wait: vi.fn(),
  ready: vi.fn(),
  reachEnd: vi.fn(),
  renderItems: vi.fn(),
}))

interface MockGridProps {
  children?: ReactNode
  "aria-label"?: string
  role?: string
  useTransform?: boolean
  gap?: number
  isCroppedSize?: boolean
  sizeRange?: number[]
  stretch?: boolean
  onRequestAppend?: (event: {
    groupKey: string
    nextGroupKeys: string[]
    isVirtual: boolean
    wait: () => void
    ready: () => void
    reachEnd: () => void
  }) => void
}

vi.mock("@egjs/react-infinitegrid", () => ({
  JustifiedInfiniteGrid: forwardRef<unknown, MockGridProps>(function MockJustifiedGrid(
    { children, onRequestAppend, ...props },
    ref,
  ) {
    useImperativeHandle(ref, () => ({ renderItems: gridSpies.renderItems }))

    return (
      <div
        aria-label={props["aria-label"]}
        data-testid="justified-grid"
        data-gap={props.gap}
        data-is-cropped-size={String(props.isCroppedSize)}
        data-size-range={props.sizeRange?.join(",")}
        data-stretch={String(props.stretch)}
        data-use-transform={String(props.useTransform)}
        role={props.role}
      >
        {children}
        <button
          type="button"
          onClick={() => onRequestAppend?.({
            groupKey: "layout-0",
            nextGroupKeys: ["layout-1"],
            isVirtual: false,
            wait: gridSpies.wait,
            ready: gridSpies.ready,
            reachEnd: gridSpies.reachEnd,
          })}
        >
          Request append
        </button>
      </div>
    )
  }),
}))

import { MediaWall, type MediaWallHandle } from "./MediaWall"

function asset(index: number, kind: MediaAsset["kind"] = "image"): MediaAsset {
  return {
    id: `media-${index}`,
    recordId: "record-1",
    kind,
    title: `Media ${index}`,
    description: "",
    width: 1_600,
    height: 900,
    placeholder: "",
    wall: [
      {
        url: `https://media.test/${index}-640.avif`,
        width: 640,
        height: 360,
        mimeType: "image/avif",
      },
      {
        url: `https://media.test/${index}-640.jpg`,
        width: 640,
        height: 360,
        mimeType: "image/jpeg",
      },
      {
        url: `https://media.test/${index}-1280.jpg`,
        width: 1_280,
        height: 720,
        mimeType: "image/jpeg",
      },
    ],
    lightbox: [],
  }
}

function tile(mediaCount = 1, overflowCount = 0): WallTile {
  const media = Array.from({ length: mediaCount }, (_, index) => asset(index + 1))

  return {
    id: "hybrid:record-1",
    recordId: "record-1",
    media,
    representative: media[0]!,
    scale: "large",
    overflowCount,
    groupKey: "layout-independent-0",
  }
}

function domRect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({}),
  }
}

describe("MediaWall", () => {
  beforeEach(() => {
    Object.values(gridSpies).forEach((spy) => spy.mockReset())
  })

  it("uses a uniformly spaced JustifiedInfiniteGrid and uncropped wall media", () => {
    render(<MediaWall tiles={[tile()]} onOpenMedia={() => undefined} />)

    expect(screen.getByTestId("justified-grid")).toHaveAttribute("data-use-transform", "false")
    expect(screen.getByTestId("justified-grid")).toHaveAttribute("data-gap", "4")
    expect(screen.getByTestId("justified-grid")).toHaveAttribute(
      "data-is-cropped-size",
      "false",
    )
    expect(screen.getByTestId("justified-grid")).toHaveAttribute("data-stretch", "false")
    expect(screen.getByTestId("justified-grid")).toHaveAttribute("data-size-range", "180,260")
    expect(screen.getByRole("listitem")).toHaveAttribute(
      "data-grid-groupkey",
      "layout-independent-0",
    )
    const image = document.querySelector("img")
    expect(image).toHaveClass("object-contain")
    expect(image).toHaveAttribute("width", "1600")
    expect(document.querySelector('source[type="image/avif"]')).toHaveAttribute(
      "srcset",
      "https://media.test/1-640.avif 640w",
    )
    expect(document.querySelector("[data-media-layout-id='media-media-1']")).toBeInTheDocument()
  })

  it("renders at most four individually addressable collage cells and overflow", () => {
    const onOpenMedia = vi.fn()
    render(<MediaWall tiles={[tile(4, 3)]} onOpenMedia={onOpenMedia} />)

    const mediaButtons = screen.getAllByRole("button", { name: /^Open Media/ })
    expect(mediaButtons).toHaveLength(4)
    expect(screen.getByText("+3")).toBeInTheDocument()

    fireEvent.click(mediaButtons[2]!)
    expect(onOpenMedia).toHaveBeenCalledWith(
      "media-3",
      expect.objectContaining({
        tileId: "hybrid:record-1",
        recordId: "record-1",
        mediaIndex: 2,
      }),
    )
  })

  it("keeps one tab stop and moves focus using mounted visual geometry", () => {
    render(<MediaWall tiles={[tile(4)]} onOpenMedia={() => undefined} />)
    const mediaButtons = screen.getAllByRole<HTMLButtonElement>("button", { name: /^Open Media/ })
    const positions = [
      domRect(0, 0, 100, 100),
      domRect(120, 0, 100, 100),
      domRect(0, 120, 100, 100),
      domRect(120, 120, 100, 100),
    ]

    mediaButtons.forEach((button, index) => {
      button.getBoundingClientRect = () => positions[index]!
    })

    expect(mediaButtons.filter((button) => button.tabIndex === 0)).toHaveLength(1)
    mediaButtons[0]!.focus()
    fireEvent.keyDown(mediaButtons[0]!, { key: "ArrowRight" })
    expect(mediaButtons[1]).toHaveFocus()
    fireEvent.keyDown(mediaButtons[1]!, { key: "ArrowDown" })
    expect(mediaButtons[3]).toHaveFocus()
  })

  it("coordinates async append requests with the grid lifecycle", async () => {
    let resolveRequest: (() => void) | undefined
    const onRequestAppend = vi.fn(() => new Promise<void>((resolve) => {
      resolveRequest = resolve
    }))
    render(
      <MediaWall
        tiles={[tile()]}
        hasNextPage
        onOpenMedia={() => undefined}
        onRequestAppend={onRequestAppend}
      />,
    )

    fireEvent.click(screen.getByRole("button", { name: "Request append" }))

    expect(gridSpies.wait).toHaveBeenCalledOnce()
    await waitFor(() => expect(onRequestAppend).toHaveBeenCalledWith({
      afterGroupKey: "layout-0",
      requestedGroupKeys: ["layout-1"],
      isVirtual: false,
    }))
    expect(gridSpies.ready).not.toHaveBeenCalled()

    resolveRequest?.()
    await waitFor(() => expect(gridSpies.ready).toHaveBeenCalledOnce())
  })

  it("exposes repack and focus operations through its integration handle", () => {
    const ref = { current: null as MediaWallHandle | null }
    render(<MediaWall ref={ref} tiles={[tile(2)]} onOpenMedia={() => undefined} />)

    expect(ref.current?.focusMedia("media-2")).toBe(true)
    expect(screen.getByRole("button", { name: "Open Media 2" })).toHaveFocus()
    ref.current?.repack()
    expect(gridSpies.renderItems).toHaveBeenCalledWith({ useResize: true })
  })
})
