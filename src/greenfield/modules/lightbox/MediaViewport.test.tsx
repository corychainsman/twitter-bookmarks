import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { MediaAsset } from "@/greenfield/contracts/domain"

import { MediaViewport } from "./MediaViewport"

const video: MediaAsset = {
  id: "video-1",
  recordId: "record-1",
  kind: "video",
  title: "Moving image",
  description: "",
  width: 1_920,
  height: 1_080,
  placeholder: "",
  wall: [],
  lightbox: [],
  previewVideoUrl: "https://media.test/video.mp4",
}

describe("MediaViewport video controls", () => {
  beforeEach(() => {
    HTMLMediaElement.prototype.pause = vi.fn()
    HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve())
  })

  it("reveals controls on mouse hover and explicit keyboard activation", () => {
    render(
      <MediaViewport
        media={video}
        onClose={() => undefined}
        onNext={() => undefined}
        onPrevious={() => undefined}
      />,
    )
    const player = screen.getByLabelText<HTMLVideoElement>("Moving image")

    expect(player).not.toHaveAttribute("controls")
    fireEvent.pointerEnter(player, { pointerType: "mouse" })
    expect(player).toHaveAttribute("controls")
    fireEvent.pointerLeave(player, { pointerType: "mouse" })
    expect(player).not.toHaveAttribute("controls")

    fireEvent.focus(player)
    expect(player).not.toHaveAttribute("controls")
    fireEvent.keyDown(player, { key: "Enter" })
    expect(player).toHaveAttribute("controls")
    fireEvent.blur(player)
    expect(player).not.toHaveAttribute("controls")
  })

  it("toggles controls on touch taps", () => {
    render(
      <MediaViewport
        media={video}
        onClose={() => undefined}
        onNext={() => undefined}
        onPrevious={() => undefined}
      />,
    )
    const player = screen.getByLabelText<HTMLVideoElement>("Moving image")

    fireEvent.pointerUp(player, { pointerType: "touch" })
    expect(player).toHaveAttribute("controls")
    fireEvent.pointerUp(player, { pointerType: "touch" })
    expect(player).not.toHaveAttribute("controls")
  })
})
