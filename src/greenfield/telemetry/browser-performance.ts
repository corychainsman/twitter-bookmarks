import type { Telemetry } from "../contracts/interfaces"
import { recordDuration } from "./timings"

export interface PerformanceEntryLike {
  readonly name: string
  readonly startTime: number
  readonly duration: number
}

export interface NavigationEntryLike extends PerformanceEntryLike {
  readonly responseStart: number
}

export interface BrowserPerformanceSource {
  getEntriesByType(type: string): readonly PerformanceEntryLike[]
}

export interface BrowserPerformanceSubscription {
  disconnect(): void
}

export type BrowserPerformanceObserverFactory = (
  type: "paint" | "largest-contentful-paint" | "longtask",
  onEntries: (entries: readonly PerformanceEntryLike[]) => void,
) => BrowserPerformanceSubscription | undefined

export interface BrowserPerformanceEnvironment {
  performance: BrowserPerformanceSource
  observe: BrowserPerformanceObserverFactory
}

function isNavigationEntry(entry: PerformanceEntryLike): entry is NavigationEntryLike {
  const candidate = entry as Partial<NavigationEntryLike>
  return typeof candidate.responseStart === "number"
}

function recordFirstContentfulPaint(
  telemetry: Telemetry,
  entries: readonly PerformanceEntryLike[],
): boolean {
  const entry = entries.find((candidate) => candidate.name === "first-contentful-paint")
  if (entry) {
    recordDuration(telemetry, "first-contentful-paint", entry.startTime)
    return true
  }

  return false
}

function recordLargestContentfulPaint(
  telemetry: Telemetry,
  entries: readonly PerformanceEntryLike[],
): void {
  const entry = entries.at(-1)
  if (entry) {
    recordDuration(telemetry, "largest-contentful-paint", entry.startTime)
  }
}

function recordLongTasks(
  telemetry: Telemetry,
  entries: readonly PerformanceEntryLike[],
): void {
  for (const entry of entries) {
    recordDuration(telemetry, "long-task", entry.duration)
  }
}

function defaultEnvironment(): BrowserPerformanceEnvironment | undefined {
  if (typeof performance === "undefined" || typeof PerformanceObserver === "undefined") {
    return undefined
  }

  return {
    performance,
    observe: (type, onEntries) => {
      try {
        const observer = new PerformanceObserver((list) => {
          onEntries(list.getEntries())
        })
        observer.observe({ type, buffered: true })
        return observer
      } catch {
        return undefined
      }
    },
  }
}

export function instrumentBrowserPerformance(
  telemetry: Telemetry,
  environment: BrowserPerformanceEnvironment | undefined = defaultEnvironment(),
): () => void {
  if (!environment) {
    return () => {}
  }

  const navigation = environment.performance.getEntriesByType("navigation")[0]
  if (navigation && isNavigationEntry(navigation)) {
    recordDuration(
      telemetry,
      "navigation-ttfb",
      navigation.responseStart - navigation.startTime,
    )
  }

  let firstContentfulPaintRecorded = recordFirstContentfulPaint(
    telemetry,
    environment.performance.getEntriesByType("paint"),
  )

  const subscriptions = [
    environment.observe("paint", (entries) => {
      if (!firstContentfulPaintRecorded) {
        firstContentfulPaintRecorded = recordFirstContentfulPaint(telemetry, entries)
      }
    }),
    environment.observe("largest-contentful-paint", (entries) => {
      recordLargestContentfulPaint(telemetry, entries)
    }),
    environment.observe("longtask", (entries) => {
      recordLongTasks(telemetry, entries)
    }),
  ].filter((subscription) => subscription !== undefined)

  return () => {
    for (const subscription of subscriptions) {
      subscription.disconnect()
    }
  }
}
