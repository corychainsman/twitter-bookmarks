import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { forwardRef, useImperativeHandle, type CSSProperties, type ReactNode } from "react"
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
  "aria-busy"?: boolean
  role?: string
  useTransform?: boolean
  gap?: number
  isCroppedSize?: boolean
  sizeRange?: number[]
  stretch?: boolean
  threshold?: number
  useRecycle?: boolean
  style?: CSSProperties
  onRenderComplete?: () => void
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
    { children, onRequestAppend, onRenderComplete, ...props },
    ref,
  ) {
    useImperativeHandle(ref, () => ({ renderItems: gridSpies.renderItems }))

    return (
      <div
        aria-label={props["aria-label"]}
        aria-busy={props["aria-busy"]}
        data-testid="justified-grid"
        data-gap={props.gap}
        data-is-cropped-size={String(props.isCroppedSize)}
        data-size-range={props.sizeRange?.join(",")}
        data-stretch={String(props.stretch)}
        data-threshold={props.threshold}
        data-use-recycle={String(props.useRecycle)}
        data-use-transform={String(props.useTransform)}
        style={props.style}
        role={props.role}
      >
        {children}
        <button
          data-testid="request-append"
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
        <button data-testid="complete-layout" type="button" onClick={onRenderComplete}>
          Complete layout
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
    expect(screen.getByTestId("justified-grid")).toHaveAttribute("data-threshold", "800")
    expect(screen.getByTestId("justified-grid")).toHaveAttribute("data-use-recycle", "false")
    expect(document.querySelector("[role='listitem']")).toHaveAttribute(
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

  it("keeps the fallback visible until the first positioned layout completes", () => {
    render(
      <MediaWall
        tiles={[tile()]}
        initialLayoutFallback={<div>Stable wall skeleton</div>}
        onOpenMedia={() => undefined}
      />,
    )

    expect(screen.getByText("Stable wall skeleton")).toBeInTheDocument()
    expect(screen.getByTestId("justified-grid")).toHaveStyle({
      opacity: "0",
      visibility: "hidden",
    })
    expect(screen.getByTestId("justified-grid")).toHaveAttribute("aria-busy", "true")

    fireEvent.click(screen.getByTestId("complete-layout"))

    expect(screen.queryByText("Stable wall skeleton")).not.toBeInTheDocument()
    expect(screen.getByTestId("justified-grid")).toHaveStyle({
      opacity: "1",
      visibility: "visible",
    })
    expect(screen.getByTestId("justified-grid")).not.toHaveAttribute("aria-busy")
  })

  it("recomputes the grid options after a committed density change", async () => {
    const { rerender } = render(
      <MediaWall density={0.6} tiles={[tile()]} onOpenMedia={() => undefined} />,
    )

    expect(screen.getByTestId("justified-grid")).toHaveAttribute(
      "data-size-range",
      "108,156",
    )

    rerender(<MediaWall density={1.75} tiles={[tile()]} onOpenMedia={() => undefined} />)

    expect(screen.getByTestId("justified-grid")).toHaveAttribute(
      "data-size-range",
      "316,454",
    )
    expect(screen.getByTestId("justified-grid")).toHaveAttribute(
      "data-threshold",
      "1400",
    )
    await waitFor(() => {
      expect(gridSpies.renderItems).toHaveBeenCalledWith({ useResize: true })
    })
  })

  it("does not force a full remeasure when cursor pages append tiles", async () => {
    const firstTile = tile()
    const secondMedia = asset(2)
    const secondTile: WallTile = {
      ...tile(),
      id: "asset:record-2:0",
      recordId: "record-2",
      media: [secondMedia],
      representative: secondMedia,
      groupKey: "layout-independent-1",
    }
    const { rerender } = render(
      <MediaWall tiles={[firstTile]} onOpenMedia={() => undefined} />,
    )

    await waitFor(() => expect(gridSpies.renderItems).toHaveBeenCalledOnce())
    gridSpies.renderItems.mockClear()

    rerender(
      <MediaWall tiles={[firstTile, secondTile]} onOpenMedia={() => undefined} />,
    )

    expect(gridSpies.renderItems).not.toHaveBeenCalled()
  })

  it("renders at most four individually addressable collage cells and overflow", () => {
    const onOpenMedia = vi.fn()
    render(<MediaWall tiles={[tile(4, 3)]} onOpenMedia={onOpenMedia} />)

    const mediaButtons = [...document.querySelectorAll<HTMLButtonElement>("[data-media-id]")]
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
    const mediaButtons = [...document.querySelectorAll<HTMLButtonElement>("[data-media-id]")]
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

    fireEvent.click(screen.getByTestId("request-append"))

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
    expect(document.querySelector("[data-media-id='media-2']")).toHaveFocus()
    ref.current?.repack()
    expect(gridSpies.renderItems).toHaveBeenCalledWith({ useResize: true })
  })
})
