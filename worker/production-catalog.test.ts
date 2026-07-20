import { afterEach, describe, expect, it, vi } from "vitest"

import { getCatalogSocialMetadata, handleCatalogApi } from "./production-catalog"

const ORIGIN = "https://catalog.test/data"
const manifest = {
  buildId: "fixture-build",
  builtAt: "2026-07-16T00:00:00.000Z",
  chunkSize: 500,
  files: {
    docs: ["tweets/docs-0001.json"],
    gridAll: "grid/all.json",
    orderBookmarked: "order/bookmarked.json",
    orderPosted: "order/posted.json",
    searchStore: "search/store.json",
  },
}
const documents = [
  {
    id: "record-1",
    url: "https://x.com/ada/status/record-1",
    text: "Generative architecture",
    authorName: "Ada",
    authorHandle: "ada",
    postedAt: "Wed Jul 15 00:25:00 +0000 2026",
    folderNames: ["Inspiration"],
  },
  {
    id: "record-2",
    url: "https://x.com/grace/status/record-2",
    text: "Moving image https://t.co/attachment",
    authorName: "Grace",
    authorHandle: "grace",
    postedAt: "Tue Jul 14 00:25:00 +0000 2026",
    folderNames: ["Motion"],
  },
]
const searchStore = documents.map((document) => ({
  id: document.id,
  text: document.text,
  authorName: document.authorName,
  authorHandle: document.authorHandle,
  folderNames: document.folderNames.join(", "),
}))
const grid = [
  {
    gridId: "record-1:0",
    tweetId: "record-1",
    mediaIndex: 0,
    mediaType: "photo",
    thumbUrl: "https://media.test/one.jpg",
    fullUrl: "https://media.test/one-full.jpg",
    width: 1_600,
    height: 900,
    imageRenditions: [
      {
        url: "https://media.test/one.avif",
        width: 800,
        height: 450,
        contentType: "image/avif",
      },
    ],
  },
  {
    gridId: "record-2:0",
    tweetId: "record-2",
    mediaIndex: 0,
    mediaType: "video",
    thumbUrl: "https://media.test/two.jpg",
    fullUrl: "https://media.test/two.mp4",
    previewUrl: "https://media.test/two-preview.mp4",
    width: 1_080,
    height: 1_920,
    imageRenditions: [],
  },
]

function installCatalogFetch() {
  const fixtures = new Map<string, unknown>([
    ["/data/manifest.json", manifest],
    ["/data/grid/all.json", grid],
    ["/data/search/store.json", searchStore],
    ["/data/order/bookmarked.json", ["record-1", "record-2"]],
    ["/data/order/posted.json", ["record-1", "record-2"]],
    ["/data/tweets/docs-0001.json", documents],
  ])

  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(input instanceof Request ? input.url : String(input))
    const fixture = fixtures.get(url.pathname)
    return fixture === undefined
      ? new Response("Not found", { status: 404 })
      : Response.json(fixture)
  }))
}

afterEach(() => vi.unstubAllGlobals())

describe("production catalog adapter", () => {
  it("maps discovery, filters, counts, and source facets to the greenfield contract", async () => {
    installCatalogFetch()

    const discovery = await handleCatalogApi(
      new Request("https://elsewhere.test/api/discovery?q=architecture&sort=curated"),
      ORIGIN,
    )
    const payload = await discovery.json()

    expect(discovery.status).toBe(200)
    expect(payload).toMatchObject({
      exact: true,
      records: [
        {
          id: "record-1",
          sourceLabel: "@ada",
          authorUrl: "https://x.com/ada",
          sourceUrl: "https://x.com/ada/status/record-1",
          postedAt: "2026-07-15T00:25:00.000Z",
          assets: [
            {
              id: "record-1:0",
              kind: "image",
              wall: [{ mimeType: "image/avif" }],
            },
          ],
        },
      ],
    })

    const directMedia = await handleCatalogApi(
      new Request("https://elsewhere.test/api/media/record-1%3A0"),
      ORIGIN,
    )
    await expect(directMedia.json()).resolves.toMatchObject({
      media: { id: "record-1:0" },
      record: {
        id: "record-1",
        authorUrl: "https://x.com/ada",
        sourceUrl: "https://x.com/ada/status/record-1",
        postedAt: "2026-07-15T00:25:00.000Z",
      },
    })

    const count = await handleCatalogApi(
      new Request("https://elsewhere.test/api/discovery/count?filter=kind%3Avideo"),
      ORIGIN,
    )
    await expect(count.json()).resolves.toEqual({ count: 1 })

    const sources = await handleCatalogApi(
      new Request("https://elsewhere.test/api/facets/source/values?q=grace"),
      ORIGIN,
    )
    await expect(sources.json()).resolves.toEqual({
      values: [{ id: "@grace", label: "@grace", count: 1 }],
    })
  })

  it("returns addressable media and social metadata", async () => {
    installCatalogFetch()

    const media = await handleCatalogApi(
      new Request("https://elsewhere.test/api/media/record-2%3A0"),
      ORIGIN,
    )
    await expect(media.json()).resolves.toMatchObject({
      media: {
        id: "record-2:0",
        kind: "video",
        description: "Moving image",
        lightbox: [
          {
            url: "https://media.test/two.jpg",
            mimeType: "image/jpeg",
          },
          {
            url: "https://media.test/two.mp4",
            mimeType: "video/mp4",
          },
        ],
        previewVideoUrl: "https://media.test/two-preview.mp4",
      },
      record: {
        id: "record-2",
        sourceUrl: "https://x.com/grace/status/record-2",
      },
    })

    await expect(getCatalogSocialMetadata(ORIGIN, "record-2:0")).resolves.toEqual({
      title: "Grace — media 1",
      description: "Moving image",
      imageUrl: "https://media.test/two.jpg",
      videoUrl: "https://media.test/two.mp4",
    })
  })
})
