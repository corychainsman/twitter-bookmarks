import { describe, expect, it } from "vitest"

import { shouldActivateWaitingUpdateOnStartup } from "./register"

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
})
