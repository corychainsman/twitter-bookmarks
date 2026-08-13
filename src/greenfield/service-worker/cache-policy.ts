export type RuntimeCacheKind = "results" | "media" | "opaque-media" | "video"

export interface StorageEstimateLike {
  quota?: number
  usage?: number
}

const MEBIBYTE = 1_024 * 1_024
const GIBIBYTE = 1_024 * MEBIBYTE

const ENTRY_CAPS: Record<RuntimeCacheKind, { constrained: number; default: number; generous: number }> = {
  results: { constrained: 12, default: 24, generous: 40 },
  media: { constrained: 24, default: 72, generous: 140 },
  "opaque-media": { constrained: 4, default: 8, generous: 12 },
  video: { constrained: 2, default: 4, generous: 8 },
}

export function storageUtilization(estimate: StorageEstimateLike | undefined) {
  if (!estimate?.quota || estimate.usage === undefined || estimate.quota <= 0) return undefined
  return Math.max(0, estimate.usage / estimate.quota)
}

export function runtimeCacheEntryCap(
  kind: RuntimeCacheKind,
  estimate: StorageEstimateLike | undefined,
) {
  const caps = ENTRY_CAPS[kind]
  const quota = estimate?.quota
  const utilization = storageUtilization(estimate)

  if ((quota !== undefined && quota <= 192 * MEBIBYTE) || (utilization !== undefined && utilization >= 0.8)) {
    return caps.constrained
  }

  if (quota !== undefined && quota >= GIBIBYTE && (utilization === undefined || utilization < 0.5)) {
    return caps.generous
  }

  return caps.default
}
