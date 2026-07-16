import type { TelemetryEvent } from "../contracts/interfaces"

export const durationMetricNames = [
  "navigation-ttfb",
  "first-contentful-paint",
  "largest-contentful-paint",
  "long-task",
  "wall-repack",
  "media-load",
  "media-decode",
] as const

export type DurationMetricName = (typeof durationMetricNames)[number]

export type StrictTelemetryEvent = Readonly<{
  name: DurationMetricName
  durationMs: number
}>

export type TelemetryErrorCategory =
  | "aggregate-error"
  | "error"
  | "network-error"
  | "range-error"
  | "reference-error"
  | "syntax-error"
  | "type-error"

export type SafeTelemetryRecord =
  | Readonly<{
      kind: "performance"
      name: DurationMetricName
      durationMs: number
    }>
  | Readonly<{
      kind: "error"
      category: TelemetryErrorCategory
    }>

const durationMetricNameSet: ReadonlySet<string> = new Set(durationMetricNames)
const maximumDurationMs = 300_000

function isDurationMetricName(name: string): name is DurationMetricName {
  return durationMetricNameSet.has(name)
}

function sanitizeDuration(value: number | undefined): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return undefined
  }

  return Math.round(Math.min(value, maximumDurationMs))
}

export function sanitizePerformanceEvent(
  event: TelemetryEvent,
): SafeTelemetryRecord | undefined {
  if (!isDurationMetricName(event.name)) {
    return undefined
  }

  const durationMs = sanitizeDuration(event.durationMs)
  if (durationMs === undefined) {
    return undefined
  }

  return Object.freeze({
    kind: "performance",
    name: event.name,
    durationMs,
  })
}

export function categorizeError(error: Error): TelemetryErrorCategory {
  if (error instanceof AggregateError) {
    return "aggregate-error"
  }
  if (error instanceof RangeError) {
    return "range-error"
  }
  if (error instanceof ReferenceError) {
    return "reference-error"
  }
  if (error instanceof SyntaxError) {
    return "syntax-error"
  }
  if (error instanceof TypeError) {
    return "type-error"
  }
  if (typeof DOMException !== "undefined" && error instanceof DOMException) {
    return error.name === "NetworkError" ? "network-error" : "error"
  }

  return "error"
}

export function sanitizeError(error: Error): SafeTelemetryRecord {
  return Object.freeze({
    kind: "error",
    category: categorizeError(error),
  })
}

