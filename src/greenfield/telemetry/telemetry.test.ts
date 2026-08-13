import { describe, expect, it, vi } from "vitest"

import type { TelemetryEvent } from "../contracts/interfaces"
import {
  beginMediaDecodeTiming,
  beginMediaLoadTiming,
  beginRepackTiming,
  BrowserConsoleTelemetry,
  instrumentBrowserPerformance,
  MemoryTelemetry,
  NoopTelemetry,
  type BrowserPerformanceEnvironment,
  type BrowserPerformanceObserverFactory,
  type PerformanceEntryLike,
  type TelemetryClock,
} from "./index"

describe("telemetry implementations", () => {
  it("keeps only allowlisted metric fields", () => {
    const telemetry = new MemoryTelemetry()
    const hostileEvent = {
      name: "wall-repack",
      durationMs: 12.6,
      query: "private search",
      filterValue: "private filter",
      mediaId: "private-media-id",
      cursor: "private-cursor",
      path: "/media/private-media-id",
      text: "private DOM text",
    } as TelemetryEvent

    telemetry.performance(hostileEvent)

    expect(telemetry.records).toEqual([
      { kind: "performance", name: "wall-repack", durationMs: 13 },
    ])
    expect(JSON.stringify(telemetry.records)).not.toContain("private")
  })

  it("drops unknown names and invalid durations", () => {
    const telemetry = new MemoryTelemetry()

    telemetry.performance({ name: "search:private-query", durationMs: 10 })
    telemetry.performance({ name: "media-load", durationMs: Number.NaN })
    telemetry.performance({ name: "media-load", durationMs: -1 })

    expect(telemetry.records).toEqual([])
  })

  it("caps high-resolution timing values", () => {
    const telemetry = new MemoryTelemetry()

    telemetry.performance({ name: "media-load", durationMs: 900_000.123 })

    expect(telemetry.records).toEqual([
      { kind: "performance", name: "media-load", durationMs: 300_000 },
    ])
  })

  it("reduces errors to fixed categories without messages or stacks", () => {
    const telemetry = new MemoryTelemetry()
    const error = new TypeError(
      "query=private&filter=private&cursor=private at /media/private",
    )
    error.stack = "DOM text and an absolute/private/path"

    telemetry.error(error)

    expect(telemetry.records).toEqual([
      { kind: "error", category: "type-error" },
    ])
    expect(JSON.stringify(telemetry.records)).not.toContain("private")
    expect(JSON.stringify(telemetry.records)).not.toContain("DOM text")
  })

  it("writes only sanitized records to the development console", () => {
    const debug = vi.fn()
    const warn = vi.fn()
    const telemetry = new BrowserConsoleTelemetry({ debug, warn })
    const hostileEvent = {
      name: "media-decode",
      durationMs: 4.8,
      mediaId: "secret-id",
    } as TelemetryEvent

    telemetry.performance(hostileEvent)
    telemetry.error(new Error("secret message"))

    expect(debug).toHaveBeenCalledWith(
      "[telemetry] performance",
      { kind: "performance", name: "media-decode", durationMs: 5 },
    )
    expect(warn).toHaveBeenCalledWith(
      "[telemetry] application error",
      { kind: "error", category: "error" },
    )
    expect(JSON.stringify([debug.mock.calls, warn.mock.calls])).not.toContain("secret")
  })

  it("provides a no-op implementation", () => {
    const telemetry = new NoopTelemetry()

    expect(() => {
      telemetry.performance({ name: "unknown private name", value: 12 })
      telemetry.error(new Error("private"))
    }).not.toThrow()
  })

  it("can clear memory records between tests", () => {
    const telemetry = new MemoryTelemetry()
    telemetry.performance({ name: "media-load", durationMs: 12 })

    telemetry.clear()

    expect(telemetry.records).toEqual([])
  })
})

describe("explicit timings", () => {
  it("records each explicit timing at most once", () => {
    const telemetry = new MemoryTelemetry()
    const values = [100, 112.6, 200, 230.4, 400, 445.9]
    const clock: TelemetryClock = {
      now: () => values.shift() ?? 0,
    }

    const finishRepack = beginRepackTiming(telemetry, clock)
    finishRepack()
    finishRepack()
    const finishLoad = beginMediaLoadTiming(telemetry, clock)
    finishLoad()
    const finishDecode = beginMediaDecodeTiming(telemetry, clock)
    finishDecode()

    expect(telemetry.records).toEqual([
      { kind: "performance", name: "wall-repack", durationMs: 13 },
      { kind: "performance", name: "media-load", durationMs: 30 },
      { kind: "performance", name: "media-decode", durationMs: 46 },
    ])
  })
})

describe("browser performance instrumentation", () => {
  it("records navigation, paint, LCP, and long tasks without entry metadata", () => {
    const telemetry = new MemoryTelemetry()
    const callbacks = new Map<string, (entries: readonly PerformanceEntryLike[]) => void>()
    const disconnect = vi.fn()
    const observe: BrowserPerformanceObserverFactory = (type, callback) => {
      callbacks.set(type, callback)
      return { disconnect }
    }
    const navigation = {
      name: "https://example.test/?q=private",
      startTime: 0,
      duration: 1_000,
      responseStart: 75.2,
    }
    const environment: BrowserPerformanceEnvironment = {
      performance: {
        getEntriesByType: (type) => {
          if (type === "navigation") {
            return [navigation]
          }
          if (type === "paint") {
            return [{ name: "first-contentful-paint", startTime: 110.7, duration: 0 }]
          }
          return []
        },
      },
      observe,
    }

    const stop = instrumentBrowserPerformance(telemetry, environment)
    callbacks.get("paint")?.([
      { name: "first-contentful-paint", startTime: 130.2, duration: 0 },
    ])
    callbacks.get("largest-contentful-paint")?.([
      {
        name: "private DOM node text",
        startTime: 240.7,
        duration: 0,
      },
    ])
    callbacks.get("longtask")?.([
      { name: "private-script-url", startTime: 300, duration: 61.2 },
    ])
    stop()

    expect(telemetry.records).toEqual([
      { kind: "performance", name: "navigation-ttfb", durationMs: 75 },
      { kind: "performance", name: "first-contentful-paint", durationMs: 111 },
      { kind: "performance", name: "largest-contentful-paint", durationMs: 241 },
      { kind: "performance", name: "long-task", durationMs: 61 },
    ])
    expect(JSON.stringify(telemetry.records)).not.toContain("private")
    expect(disconnect).toHaveBeenCalledTimes(3)
  })

  it("does nothing when browser performance APIs are unavailable", () => {
    const telemetry = new MemoryTelemetry()

    const stop = instrumentBrowserPerformance(telemetry, undefined)

    expect(stop).not.toThrow()
    expect(telemetry.records).toEqual([])
  })
})
