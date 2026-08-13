interface WheelSample {
  magnitude: number
  timeStamp: number
}

function average(samples: WheelSample[]): number {
  return samples.reduce((sum, sample) => sum + sample.magnitude, 0) / samples.length
}

/**
 * Distinguishes an actively driven wheel burst from its decaying inertial tail.
 * Browsers do not expose a standard momentum phase, so this follows the same
 * rolling-average approach recommended by use-gesture's Lethargy example.
 */
export class WheelIntentFilter {
  private readonly stability: number
  private readonly sensitivity: number
  private readonly tolerance: number
  private readonly burstGapMs: number
  private readonly history = {
    down: [] as WheelSample[],
    up: [] as WheelSample[],
  }

  constructor(
    stability = 3,
    sensitivity = 0.15,
    tolerance = 1.18,
    burstGapMs = 90,
  ) {
    this.stability = stability
    this.sensitivity = sensitivity
    this.tolerance = tolerance
    this.burstGapMs = burstGapMs
  }

  check(deltaY: number, timeStamp: number): boolean {
    if (!Number.isFinite(deltaY) || deltaY === 0) return false

    const samples = deltaY > 0 ? this.history.down : this.history.up
    const previous = samples.at(-1)
    if (previous && timeStamp - previous.timeStamp > this.burstGapMs) {
      samples.length = 0
    }

    samples.push({ magnitude: Math.abs(deltaY), timeStamp })
    const sampleLimit = this.stability * 2
    if (samples.length > sampleLimit) samples.shift()
    if (samples.length < sampleLimit) return true

    const olderAverage = average(samples.slice(0, this.stability))
    const recentAverage = average(samples.slice(this.stability))

    return recentAverage >= this.sensitivity &&
      recentAverage * this.tolerance >= olderAverage
  }
}
