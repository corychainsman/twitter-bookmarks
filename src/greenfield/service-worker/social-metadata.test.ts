import { describe, expect, it } from "vitest"

import {
  renderSocialMetadataTags,
  sanitizeSocialMetadata,
} from "../../../worker/social-metadata"

describe("social metadata", () => {
  it("normalizes valid upstream metadata", () => {
    expect(
      sanitizeSocialMetadata({
        title: "  A\nmedia item  ",
        description: "A concise description",
        imageUrl: "https://cdn.example.com/image.jpg",
        videoUrl: "javascript:alert(1)",
      }),
    ).toEqual({
      title: "A media item",
      description: "A concise description",
      imageUrl: "https://cdn.example.com/image.jpg",
    })
  })

  it("rejects incomplete or non-http metadata", () => {
    expect(
      sanitizeSocialMetadata({
        title: "Media",
        description: "Description",
        imageUrl: "data:image/svg+xml,unsafe",
      }),
    ).toBeUndefined()
    expect(sanitizeSocialMetadata({ title: "Media" })).toBeUndefined()
  })

  it("escapes values before rendering tags", () => {
    const tags = renderSocialMetadataTags(
      {
        title: 'A <strange> "title"',
        description: "A & B",
        imageUrl: "https://cdn.example.com/image.jpg?x=1&y=2",
      },
      "https://example.com/media/one?x=1&y=2",
    )

    expect(tags).toContain("A &lt;strange&gt; &quot;title&quot;")
    expect(tags).toContain("A &amp; B")
    expect(tags).toContain("x=1&amp;y=2")
    expect(tags).not.toContain("<strange>")
  })
})
