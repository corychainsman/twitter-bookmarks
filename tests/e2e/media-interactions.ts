import type { BrowserContext, Locator, Page } from "@playwright/test"

export interface MediaTransform {
  scaleX: number
  scaleY: number
  translateX: number
  translateY: number
}

export interface ViewportAnchor {
  mediaId: string
  top: number
}

export interface WallGeometry {
  horizontalGaps: number[]
  verticalGaps: number[]
  aspectRatioErrors: number[]
}

export function lightboxMediaLocators(page: Page, title: string) {
  const dialog = page.getByRole("dialog", { name: title })
  const image = dialog.getByRole("img", { name: title })

  return {
    dialog,
    image,
    layer: image.locator("xpath=../.."),
    viewport: image.locator("xpath=../../.."),
  }
}

export async function readMediaTransform(layer: Locator): Promise<MediaTransform> {
  return layer.evaluate((element) => {
    const transform = getComputedStyle(element).transform
    const matrix = transform === "none"
      ? new DOMMatrixReadOnly()
      : new DOMMatrixReadOnly(transform)

    return {
      scaleX: matrix.a,
      scaleY: matrix.d,
      translateX: matrix.e,
      translateY: matrix.f,
    }
  })
}

export async function readWallGeometry(page: Page): Promise<WallGeometry> {
  return page.locator("article[data-tile-id]").evaluateAll((items) => {
    const rects = items.slice(0, 20).map((element) => {
      const rect = element.getBoundingClientRect()
      return {
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        ratio: rect.width / rect.height,
        expectedRatio: Number((element as HTMLElement).dataset.tileAspectRatio),
      }
    })
    const rows: Array<{ top: number; items: typeof rects }> = []

    for (const rect of rects) {
      let row = rows.find((candidate) => Math.abs(candidate.top - rect.top) < 1)

      if (!row) {
        row = { top: rect.top, items: [] }
        rows.push(row)
      }
      row.items.push(rect)
    }

    return {
      horizontalGaps: rows.flatMap((row) => row.items.slice(1).map(
        (rect, index) => rect.left - row.items[index]!.right,
      )),
      verticalGaps: rows.slice(1).map(
        (row, index) => row.top - Math.max(...rows[index]!.items.map((rect) => rect.bottom)),
      ),
      aspectRatioErrors: rects.map((rect) => Math.abs(rect.ratio - rect.expectedRatio)),
    }
  })
}

export async function dispatchPinchOut(
  context: BrowserContext,
  page: Page,
  viewport: Locator,
  options: {
    center?: { x: number; y: number }
    distances?: number[]
  } = {},
) {
  const box = await viewport.boundingBox()
  if (!box) throw new Error("The lightbox media viewport has no layout box")

  const client = await context.newCDPSession(page)
  const centerX = options.center?.x ?? box.x + box.width / 2
  const centerY = options.center?.y ?? box.y + box.height / 2
  const touchPoint = (id: number, x: number) => ({
    id,
    x,
    y: centerY,
    radiusX: 2,
    radiusY: 2,
    force: 1,
  })

  try {
    await client.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [touchPoint(0, centerX - 30), touchPoint(1, centerX + 30)],
    })

    for (const distance of options.distances ?? [45, 60, 80, 100]) {
      await client.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [
          touchPoint(0, centerX - distance),
          touchPoint(1, centerX + distance),
        ],
      })
    }

    await client.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    })
  } finally {
    await client.detach()
  }
}

export async function captureViewportAnchor(page: Page): Promise<ViewportAnchor> {
  const anchor = await page.evaluate(() => {
    const centerY = window.innerHeight / 2
    return [...document.querySelectorAll<HTMLElement>("[data-media-id]")]
      .map((element) => ({
        mediaId: element.dataset.mediaId,
        top: element.getBoundingClientRect().top,
      }))
      .filter((candidate): candidate is ViewportAnchor => Boolean(candidate.mediaId))
      .toSorted(
        (left, right) =>
          Math.abs(left.top - centerY) - Math.abs(right.top - centerY),
      )[0]
  })

  if (!anchor) throw new Error("The justified wall has no viewport anchor")
  return anchor
}

export async function anchorDisplacement(page: Page, anchor: ViewportAnchor) {
  return page
    .locator(`[data-media-id="${anchor.mediaId}"]`)
    .first()
    .evaluate((element, initialTop) =>
      Math.abs(element.getBoundingClientRect().top - initialTop), anchor.top)
}
