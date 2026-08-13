import {
  SEMANTIC_MODEL_ID,
  SEMANTIC_PROTOCOL_VERSION,
} from "./config"

export type SemanticQueryParameters = {
  semantic: string
  semanticModel: string
  semanticVersion: number
}

type PendingRequest = {
  resolve: (value: SemanticQueryParameters | undefined) => void
}

type WorkerMessage =
  | { type: "ready" }
  | { type: "result"; id: number; vector: string }
  | { type: "error"; id: number; message: string }
  | { type: "fatal"; message: string }

type ConnectionNavigator = Navigator & {
  connection?: {
    effectiveType?: string
    saveData?: boolean
  }
  deviceMemory?: number
}

type IdleWindow = Window & typeof globalThis & {
  requestIdleCallback?: (
    callback: () => void,
    options?: { timeout?: number },
  ) => number
  cancelIdleCallback?: (handle: number) => void
}

const VECTOR_CACHE_LIMIT = 64

let worker: Worker | undefined
let state: "idle" | "loading" | "ready" | "failed" = "idle"
let nextRequestId = 1
let preparedText: string | undefined
const pending = new Map<number, PendingRequest>()
const readyListeners = new Set<() => void>()
const vectorCache = new Map<string, SemanticQueryParameters>()
const inFlightVectors = new Map<string, Promise<SemanticQueryParameters | undefined>>()

function normalizedQuery(text: string): string {
  return text.trim().replace(/\s+/g, " ")
}

function dataSavingRequested(): boolean {
  return typeof navigator !== "undefined"
    && Boolean((navigator as ConnectionNavigator).connection?.saveData)
}

function cacheVector(text: string, vector: SemanticQueryParameters) {
  vectorCache.delete(text)
  vectorCache.set(text, vector)
  if (vectorCache.size > VECTOR_CACHE_LIMIT) {
    const oldest = vectorCache.keys().next().value
    if (oldest) vectorCache.delete(oldest)
  }
}

function failPending() {
  for (const request of pending.values()) request.resolve(undefined)
  pending.clear()
}

function requestVector(text: string): Promise<SemanticQueryParameters | undefined> {
  const cached = vectorCache.get(text)
  if (cached) {
    cacheVector(text, cached)
    return Promise.resolve(cached)
  }

  const current = inFlightVectors.get(text)
  if (current) return current
  if (state !== "ready" || !worker) return Promise.resolve(undefined)

  const id = nextRequestId++
  const raw = new Promise<SemanticQueryParameters | undefined>((resolve) => {
    pending.set(id, { resolve })
  })
  const request = raw
    .then((result) => {
      if (result) cacheVector(text, result)
      return result
    })
    .finally(() => inFlightVectors.delete(text))

  inFlightVectors.set(text, request)
  worker.postMessage({ type: "encode", id, text })
  return request
}

function startWorker() {
  if (state !== "idle" || typeof Worker === "undefined" || dataSavingRequested()) return
  state = "loading"
  worker = new Worker(new URL("./query-worker.ts", import.meta.url), { type: "module" })
  worker.addEventListener("message", (event: MessageEvent<WorkerMessage>) => {
    const message = event.data
    if (message.type === "ready") {
      state = "ready"
      if (preparedText) void requestVector(preparedText)
      for (const listener of readyListeners) listener()
      return
    }
    if (message.type === "fatal") {
      state = "failed"
      failPending()
      return
    }
    const request = pending.get(message.id)
    if (!request) return
    pending.delete(message.id)
    request.resolve(message.type === "result"
      ? {
          semantic: message.vector,
          semanticModel: SEMANTIC_MODEL_ID,
          semanticVersion: SEMANTIC_PROTOCOL_VERSION,
        }
      : undefined)
  })
  worker.addEventListener("error", () => {
    state = "failed"
    failPending()
  })
}

function abortable(
  request: Promise<SemanticQueryParameters | undefined>,
  signal: AbortSignal,
): Promise<SemanticQueryParameters | undefined> {
  return new Promise((resolve) => {
    let settled = false
    const finish = (value: SemanticQueryParameters | undefined) => {
      if (settled) return
      settled = true
      signal.removeEventListener("abort", onAbort)
      resolve(value)
    }
    const onAbort = () => finish(undefined)

    signal.addEventListener("abort", onAbort, { once: true })
    void request.then(finish)
  })
}

function capableDesktop(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false
  if (!window.matchMedia("(min-width: 1024px) and (pointer: fine)").matches) return false

  const device = navigator as ConnectionNavigator
  if (device.connection?.saveData) return false
  if (device.connection?.effectiveType && device.connection.effectiveType !== "4g") return false
  if (device.deviceMemory !== undefined && device.deviceMemory < 4) return false
  if (navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4) return false
  return true
}

export function prepareSemanticSearch(): void {
  startWorker()
}

export function prepareSemanticQuery(text: string): void {
  const normalized = normalizedQuery(text)
  if (normalized.length < 2) return
  preparedText = normalized
  startWorker()
  if (state === "ready") void requestVector(normalized)
}

export function scheduleSemanticSearchIdlePreload(): () => void {
  if (!capableDesktop()) return () => undefined

  const idleWindow = window as IdleWindow
  if (idleWindow.requestIdleCallback) {
    const handle = idleWindow.requestIdleCallback(prepareSemanticSearch, { timeout: 5_000 })
    return () => idleWindow.cancelIdleCallback?.(handle)
  }

  const handle = window.setTimeout(prepareSemanticSearch, 2_500)
  return () => window.clearTimeout(handle)
}

export function subscribeToSemanticReadiness(listener: () => void): () => void {
  readyListeners.add(listener)
  return () => readyListeners.delete(listener)
}

export async function encodeSemanticQuery(
  text: string,
  signal?: AbortSignal,
): Promise<SemanticQueryParameters | undefined> {
  const normalized = normalizedQuery(text)
  if (normalized.length < 2 || signal?.aborted || state === "failed") return undefined
  startWorker()
  if (state !== "ready") return undefined

  const request = requestVector(normalized)
  return signal ? abortable(request, signal) : request
}
