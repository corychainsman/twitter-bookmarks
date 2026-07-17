import type {
  Telemetry,
  TelemetryEvent,
} from "../contracts/interfaces"
import {
  sanitizeError,
  sanitizePerformanceEvent,
  type SafeTelemetryRecord,
} from "./events"

abstract class SanitizingTelemetry implements Telemetry {
  performance(event: TelemetryEvent): void {
    const record = sanitizePerformanceEvent(event)
    if (record) {
      this.publish(record)
    }
  }

  error(error: Error): void {
    this.publish(sanitizeError(error))
  }

  protected abstract publish(record: SafeTelemetryRecord): void
}

export class NoopTelemetry implements Telemetry {
  performance(event: TelemetryEvent): void {
    void event
  }

  error(error: Error): void {
    void error
  }
}

export class MemoryTelemetry extends SanitizingTelemetry {
  private capturedRecords: SafeTelemetryRecord[] = []

  get records(): readonly SafeTelemetryRecord[] {
    return this.capturedRecords
  }

  clear(): void {
    this.capturedRecords = []
  }

  protected publish(record: SafeTelemetryRecord): void {
    this.capturedRecords.push(record)
  }
}

export interface TelemetryConsole {
  debug(message: string, record: SafeTelemetryRecord): void
  warn(message: string, record: SafeTelemetryRecord): void
}

export class BrowserConsoleTelemetry extends SanitizingTelemetry {
  private readonly target: TelemetryConsole

  constructor(target: TelemetryConsole = console) {
    super()
    this.target = target
  }

  protected publish(record: SafeTelemetryRecord): void {
    if (record.kind === "error") {
      this.target.warn("[telemetry] application error", record)
      return
    }

    this.target.debug("[telemetry] performance", record)
  }
}
