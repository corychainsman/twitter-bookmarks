import type { Telemetry } from "../contracts/interfaces"
import type {
  DurationMetricName,
  StrictTelemetryEvent,
} from "./events"

export type ExplicitTimingName = "wall-repack" | "media-load" | "media-decode"

export interface TelemetryClock {
  now(): number
}

function defaultClock(): TelemetryClock {
  if (typeof performance !== "undefined") {
    return performance
  }

  return { now: () => Date.now() }
}

export function recordDuration(
  telemetry: Telemetry,
  name: DurationMetricName,
  durationMs: number,
): void {
  const event: StrictTelemetryEvent = { name, durationMs }
  telemetry.performance(event)
}

export function beginTiming(
  telemetry: Telemetry,
  name: ExplicitTimingName,
  clock: TelemetryClock = defaultClock(),
): () => void {
  const startedAt = clock.now()
  let finished = false

  return () => {
    if (finished) {
      return
    }

    finished = true
    recordDuration(telemetry, name, clock.now() - startedAt)
  }
}

export function beginRepackTiming(
  telemetry: Telemetry,
  clock?: TelemetryClock,
): () => void {
  return beginTiming(telemetry, "wall-repack", clock)
}

export function beginMediaLoadTiming(
  telemetry: Telemetry,
  clock?: TelemetryClock,
): () => void {
  return beginTiming(telemetry, "media-load", clock)
}

export function beginMediaDecodeTiming(
  telemetry: Telemetry,
  clock?: TelemetryClock,
): () => void {
  return beginTiming(telemetry, "media-decode", clock)
}

