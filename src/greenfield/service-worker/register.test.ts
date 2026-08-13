import { afterEach, describe, expect, it, vi } from "vitest"

import {
  shouldActivateWaitingUpdateOnStartup,
  shouldReloadAfterServiceWorkerActivation,
  showDefaultUpdatePrompt,
} from "./register"

afterEach(() => {
  document.querySelector('[data-service-worker-update="true"]')?.remove()
  document.body.style.removeProperty("pointer-events")
})

describe("service worker update startup policy", () => {
  it("activates a worker that was already waiting before registration", () => {
    expect(
      shouldActivateWaitingUpdateOnStartup({
        elapsedSinceRegistrationMs: 60_000,
        wasWaitingBeforeRegister: true,
      }),
    ).toBe(true)
  })

  it("activates an update discovered during initial page startup", () => {
    expect(
      shouldActivateWaitingUpdateOnStartup({
        elapsedSinceRegistrationMs: 5_000,
        wasWaitingBeforeRegister: false,
      }),
    ).toBe(true)
  })

  it("leaves a later in-session update for the non-disruptive prompt", () => {
    expect(
      shouldActivateWaitingUpdateOnStartup({
        elapsedSinceRegistrationMs: 60_000,
        wasWaitingBeforeRegister: false,
      }),
    ).toBe(false)
  })

  it("does not reload an already-rendered wall for an automatic startup update", () => {
    expect(shouldReloadAfterServiceWorkerActivation("startup")).toBe(false)
    expect(shouldReloadAfterServiceWorkerActivation("user")).toBe(true)
  })

  it("keeps the update prompt interactive while a modal disables body hit testing", () => {
    const applyUpdate = vi.fn()
    document.body.style.pointerEvents = "none"

    showDefaultUpdatePrompt({ applyUpdate, wasWaitingBeforeRegister: false })

    const prompt = document.querySelector<HTMLElement>('[data-service-worker-update="true"]')
    const refreshButton = document.querySelector<HTMLButtonElement>(
      '[aria-label="Refresh to use the new version"]',
    )

    expect(prompt?.style.pointerEvents).toBe("auto")
    refreshButton?.click()
    expect(applyUpdate).toHaveBeenCalledOnce()
  })
})
