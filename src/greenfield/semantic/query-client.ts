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
  cleanup: () => void
}

type WorkerMessage =
  | { type: "ready" }
  | { type: "result"; id: number; vector: string }
  | { type: "error"; id: number; message: string }
  | { type: "fatal"; message: string }

type ConnectionNavigator = Navigator & {
  connection?: { saveData?: boolean }
}

let worker: Worker | undefined
let state: "idle" | "loading" | "ready" | "failed" = "idle"
let nextRequestId = 1
const pending = new Map<number, PendingRequest>()
const readyListeners = new Set<() => void>()

function dataSavingRequested(): boolean {
  return typeof navigator !== "undefined"
    && Boolean((navigator as ConnectionNavigator).connection?.saveData)
}

function failPending() {
  for (const request of pending.values()) {
    request.cleanup()
    request.resolve(undefined)
  }
  pending.clear()
}

function startWorker() {
  if (state !== "idle" || typeof Worker === "undefined" || dataSavingRequested()) return
  state = "loading"
  worker = new Worker(new URL("./query-worker.ts", import.meta.url), { type: "module" })
  worker.addEventListener("message", (event: MessageEvent<WorkerMessage>) => {
    const message = event.data
    if (message.type === "ready") {
      state = "ready"
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
    request.cleanup()
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

export function subscribeToSemanticReadiness(listener: () => void): () => void {
  readyListeners.add(listener)
  return () => readyListeners.delete(listener)
}

export async function encodeSemanticQuery(
  text: string,
  signal?: AbortSignal,
): Promise<SemanticQueryParameters | undefined> {
  if (text.trim().length < 2 || signal?.aborted || state === "failed") return undefined
  startWorker()
  if (state !== "ready" || !worker) return undefined

  const id = nextRequestId++
  return new Promise((resolve) => {
    const onAbort = () => {
      const request = pending.get(id)
      if (!request) return
      pending.delete(id)
      request.cleanup()
      resolve(undefined)
    }
    const cleanup = () => signal?.removeEventListener("abort", onAbort)
    pending.set(id, { resolve, cleanup })
    signal?.addEventListener("abort", onAbort, { once: true })
    worker?.postMessage({ type: "encode", id, text: text.trim() })
  })
}

