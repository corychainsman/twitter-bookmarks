import { describe, expect, it, vi } from "vitest"

import worker from "./index"

function environment() {
  return {
    USE_LOCAL_DATA: "true",
    ASSETS: {
      fetch: vi.fn(async (request: Request) => {
        const url = new URL(request.url)
        if (url.pathname === "/robots.txt") {
          return new Response("User-agent: *\nAllow: /\n", {
            headers: { "content-type": "text/plain; charset=utf-8" },
          })
        }
        return new Response("<!doctype html><html><body>App</body></html>", {
          headers: { "content-type": "text/html; charset=utf-8" },
        })
      }),
    },
  }
}

describe("edge document policy", () => {
  it("applies the document security policy to the application shell", async () => {
    const response = await worker.fetch(
      new Request("https://bookmarks.test/"),
      environment() as never,
    )

    expect(response.headers.get("content-security-policy")).toContain(
      "frame-ancestors 'none'",
    )
    expect(response.headers.get("permissions-policy")).toBe(
      "camera=(), geolocation=(), microphone=()",
    )
    expect(response.headers.get("strict-transport-security")).toContain(
      "max-age=31536000",
    )
    expect(response.headers.get("x-content-type-options")).toBe("nosniff")
    expect(response.headers.get("x-frame-options")).toBe("DENY")
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow")
  })

  it("serves robots.txt as plain text instead of the SPA fallback", async () => {
    const response = await worker.fetch(
      new Request("https://bookmarks.test/robots.txt"),
      environment() as never,
    )

    expect(response.headers.get("content-type")).toContain("text/plain")
    await expect(response.text()).resolves.toBe("User-agent: *\nAllow: /\n")
  })
})
