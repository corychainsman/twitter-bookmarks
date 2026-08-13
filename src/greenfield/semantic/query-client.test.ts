import { beforeEach, describe, expect, it, vi } from "vitest"

type PostedMessage = { type: "encode"; id: number; text: string }

class WorkerStub extends EventTarget {
  static instances: WorkerStub[] = []
  readonly posted: PostedMessage[] = []

  constructor() {
    super()
    WorkerStub.instances.push(this)
  }

  postMessage(message: PostedMessage) {
    this.posted.push(message)
  }

  ready() {
    this.dispatchEvent(new MessageEvent("message", { data: { type: "ready" } }))
  }

  result(id: number, vector = "encoded-vector") {
    this.dispatchEvent(new MessageEvent("message", {
      data: { type: "result", id, vector },
    }))
  }
}

describe("semantic query preparation", () => {
  beforeEach(() => {
    vi.resetModules()
    WorkerStub.instances = []
    vi.stubGlobal("Worker", WorkerStub)
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true })))
  })

  it("warms on intent and deduplicates prepared, concurrent, and repeated queries", async () => {
    const semantic = await import("./query-client")

    semantic.prepareSemanticSearch()
    semantic.prepareSemanticQuery("obsolete draft")
    semantic.prepareSemanticQuery("  blue   sports car ")

    const worker = WorkerStub.instances[0]!
    expect(WorkerStub.instances).toHaveLength(1)
    expect(worker.posted).toHaveLength(0)

    worker.ready()
    expect(worker.posted).toEqual([
      { type: "encode", id: 1, text: "blue sports car" },
    ])

    const first = semantic.encodeSemanticQuery("blue sports car")
    const second = semantic.encodeSemanticQuery(" blue  sports car ")
    expect(worker.posted).toHaveLength(1)

    worker.result(1)
    await expect(first).resolves.toMatchObject({ semantic: "encoded-vector" })
    await expect(second).resolves.toMatchObject({ semantic: "encoded-vector" })

    await expect(semantic.encodeSemanticQuery("blue sports car")).resolves.toMatchObject({
      semantic: "encoded-vector",
    })
    expect(worker.posted).toHaveLength(1)
  })

  it("schedules idle warm-up only on a capable desktop", async () => {
    let idleCallback: (() => void) | undefined
    vi.stubGlobal("requestIdleCallback", vi.fn((callback: () => void) => {
      idleCallback = callback
      return 7
    }))
    vi.stubGlobal("cancelIdleCallback", vi.fn())
    Object.defineProperty(navigator, "hardwareConcurrency", {
      configurable: true,
      value: 8,
    })
    const semantic = await import("./query-client")

    const cancel = semantic.scheduleSemanticSearchIdlePreload()
    expect(requestIdleCallback).toHaveBeenCalledWith(expect.any(Function), { timeout: 5_000 })
    expect(WorkerStub.instances).toHaveLength(0)

    idleCallback?.()
    expect(WorkerStub.instances).toHaveLength(1)

    cancel()
    expect(cancelIdleCallback).toHaveBeenCalledWith(7)
  })
})
