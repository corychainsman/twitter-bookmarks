import { expect, mediaButtons, test, waitForMediaWall } from "./fixtures"
import {
  anchorDisplacement,
  captureViewportAnchor,
  lightboxMediaLocators,
  readMediaTransform,
  readWallGeometry,
} from "./media-interactions"

test.describe("desktop media wall", () => {
  test("density changes the settled row composition on an ultrawide desktop", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 3_440, height: 1_000 })
    await page.goto("/?density=0.6")
    await waitForMediaWall(page)

    const firstRowCount = async () => page.locator("[data-tile-id]").evaluateAll((tiles) => {
      const firstTop = tiles[0]?.getBoundingClientRect().top
      if (firstTop === undefined) return 0

      return tiles.filter(
        (tile) => Math.abs(tile.getBoundingClientRect().top - firstTop) < 2,
      ).length
    })
    const denseRowCount = await firstRowCount()
    const slider = page.getByRole("slider", { name: "Wall density" })

    await slider.press("End")
    await expect(page).toHaveURL((url) => url.searchParams.get("density") === "1.75")
    await expect.poll(firstRowCount).toBeLessThan(denseRowCount - 4)
  })

  test("uses uniform gutters while preserving native tile ratios", async ({ page }) => {
    await page.goto("/")
    await waitForMediaWall(page)

    const geometry = await readWallGeometry(page)
    const gaps = [...geometry.horizontalGaps, ...geometry.verticalGaps]

    expect(gaps.length).toBeGreaterThan(10)
    expect(Math.max(...gaps.map((gap) => Math.abs(gap - 4)))).toBeLessThan(0.1)
    expect(Math.max(...geometry.aspectRatioErrors)).toBeLessThan(0.02)
  })

  test("loads the justified wall and keeps it mounted while search updates URL history", async ({
    page,
  }) => {
    await page.goto("/")
    await waitForMediaWall(page)

    const firstMedia = mediaButtons(page).first()
    await expect(firstMedia).toHaveAccessibleName("Open Study 001.1")
    const initialHistoryLength = await page.evaluate(() => window.history.length)

    const search = page.getByRole("searchbox", { name: "Search media" })
    await search.fill("technology")
    await Promise.all([
      page.waitForFunction(
        () =>
          document
            .querySelector('main[aria-label="Media results"]')
            ?.getAttribute("aria-busy") === "true",
      ),
      search.press("Enter"),
    ])
    await expect(page.getByRole("list", { name: "Media results" })).toBeVisible()

    await expect(page).toHaveURL((url) => url.searchParams.get("q") === "technology")
    await expect(mediaButtons(page).first()).toHaveAccessibleName("Open Study 002.1")

    await expect
      .poll(() => page.evaluate(() => window.history.length))
      .toBe(initialHistoryLength + 1)

    await page.goBack()
    await expect(page).toHaveURL((url) => !url.searchParams.has("q"))
    await expect(mediaButtons(page).first()).toHaveAccessibleName("Open Study 001.1")
  })

  test("opens a URL-addressable lightbox, survives reload, and closes back to the wall", async ({
    page,
  }) => {
    await page.goto("/")
    await waitForMediaWall(page)

    const firstMedia = mediaButtons(page).first()
    await firstMedia.click()

    await expect(page).toHaveURL(/\/media\/record-001-media-1(?:\?|$)/)
    await expect(page.getByRole("dialog", { name: "Study 001.1" })).toBeVisible()

    const addressableURL = page.url()
    await page.reload()
    await expect(page).toHaveURL(addressableURL)
    await expect(page.getByRole("dialog", { name: "Study 001.1" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Close lightbox" })).toBeVisible()

    await page.getByRole("button", { name: "Close lightbox" }).click()
    await expect(page).toHaveURL((url) => url.pathname === "/")
    await expect(page.getByRole("list", { name: "Media results" })).toBeVisible()
  })

  test("preserves deep wall scroll throughout the shared-element lightbox transition", async ({
    page,
  }) => {
    await page.goto("/")
    await waitForMediaWall(page)
    await expect.poll(async () => {
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
      return page.evaluate(() => window.scrollY)
    }).toBeGreaterThan(500)

    const mediaId = await page.locator("[data-media-id]").evaluateAll((buttons) => {
      const viewportCenter = window.innerHeight / 2
      return buttons
        .map((button) => ({
          id: (button as HTMLElement).dataset.mediaId,
          rect: button.getBoundingClientRect(),
        }))
        .filter(({ id, rect }) => Boolean(id) && rect.bottom > 64 && rect.top < window.innerHeight)
        .toSorted(
          (left, right) =>
            Math.abs(left.rect.top - viewportCenter) - Math.abs(right.rect.top - viewportCenter),
        )[0]?.id
    })
    if (!mediaId) throw new Error("No visible deep-scroll media target was found")

    const scrollBeforeOpen = await page.evaluate(() => window.scrollY)
    await page.locator(`[data-media-id="${mediaId}"]`).click()
    await expect(page.getByRole("dialog")).toBeVisible()
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(scrollBeforeOpen)

    await page.getByRole("button", { name: "Close lightbox" }).click()
    await expect(page.getByRole("list", { name: "Media results" })).toBeVisible()
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(scrollBeforeOpen)
  })

  test("zooms the URL lightbox around a ctrl-wheel pointer position", async ({ page }) => {
    await page.goto("/media/record-001-media-1")
    const { dialog, image, layer, viewport } = lightboxMediaLocators(page, "Study 001.1")
    await expect(dialog).toBeVisible()
    await expect(image).toBeVisible()
    await expect(layer).toHaveCSS("transform", "none")

    const box = await viewport.boundingBox()
    if (!box) throw new Error("The desktop lightbox media viewport has no layout box")
    expect(box.width).toBeGreaterThan(400)

    const pointerX = box.x + box.width * 0.75
    const pointerY = box.y + box.height * 0.35
    await page.mouse.move(pointerX, pointerY)
    await page.keyboard.down("Control")
    await page.mouse.wheel(0, -120)
    await page.keyboard.up("Control")

    await expect(page.getByRole("button", { name: "Reset zoom" })).toBeVisible()
    await expect
      .poll(async () => (await readMediaTransform(layer)).scaleX)
      .toBeGreaterThan(1.2)
    const transform = await readMediaTransform(layer)
    expect(transform.scaleY).toBeGreaterThan(1.2)
    expect(transform.translateX).toBeLessThan(-5)
    expect(transform.translateY).toBeGreaterThan(5)
  })

  test("ctrl-wheel commits wall density while keeping the viewport focus stable", async ({
    page,
  }) => {
    await page.goto("/")
    const wall = await waitForMediaWall(page)
    const initialHistoryLength = await page.evaluate(() => window.history.length)
    const anchor = await captureViewportAnchor(page)
    const viewport = page.viewportSize()
    if (!viewport) throw new Error("The desktop project has no configured viewport")

    await page.mouse.move(viewport.width / 2, viewport.height / 2)
    await page.keyboard.down("Control")
    await page.mouse.wheel(0, -80)
    await page.keyboard.up("Control")

    await expect(page).toHaveURL((url) => {
      const density = Number(url.searchParams.get("density"))
      return Number.isFinite(density) && density > 1.1
    })
    await expect
      .poll(() => page.evaluate(() => window.history.length))
      .toBe(initialHistoryLength + 1)
    await expect(wall).toBeVisible()
    await expect
      .poll(() => anchorDisplacement(page, anchor))
      .toBeLessThan(16)
  })

  test("ignores the momentum tail after active trackpad zoom", async ({ page }) => {
    await page.goto("/?density=1")
    const wall = await waitForMediaWall(page)
    const gestureSurface = wall.locator("xpath=../..")
    const initialHistoryLength = await page.evaluate(() => window.history.length)
    const dispatchWheelBurst = (deltas: number[]) => gestureSurface.evaluate(
      (element, wheelDeltas) => {
        wheelDeltas.forEach((deltaY) => {
          element.dispatchEvent(new WheelEvent("wheel", {
            bubbles: true,
            cancelable: true,
            clientX: window.innerWidth / 2,
            clientY: window.innerHeight / 2,
            ctrlKey: true,
            deltaY,
          }))
        })
      },
      deltas,
    )

    const activeDeltas = [-8, -9, -10, -10, -9, -8]
    const momentumDeltas = [-5, -3, -1.5, -0.7, -0.25]
    await dispatchWheelBurst([...activeDeltas, ...momentumDeltas])
    const expectedDensity = Math.exp(
      -activeDeltas.reduce((sum, delta) => sum + delta, 0) * 0.003,
    )

    await expect(page).toHaveURL((url) =>
      Math.abs(Number(url.searchParams.get("density")) - expectedDensity) < 0.001,
    )
    await expect
      .poll(() => page.evaluate(() => window.history.length))
      .toBe(initialHistoryLength + 1)
  })

  test("never starts ambient wall video when reduced motion is requested", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" })
    await page.addInitScript(() => {
      const calls = { play: [] as string[], pause: [] as string[] }
      Object.defineProperty(window, "__mediaPlaybackCalls", { value: calls })

      HTMLMediaElement.prototype.play = function play() {
        calls.play.push(this.getAttribute("aria-label") ?? "")
        return Promise.resolve()
      }
      const originalPause = HTMLMediaElement.prototype.pause
      HTMLMediaElement.prototype.pause = function pause() {
        calls.pause.push(this.getAttribute("aria-label") ?? "")
        return originalPause.call(this)
      }
    })

    await page.goto("/")
    await waitForMediaWall(page)
    const video = page.locator('video[aria-label="Study 003.2"]')
    await expect(video).toBeInViewport()
    await expect(video).toHaveAttribute("src", /ForBiggerBlazes\.mp4$/)

    await expect
      .poll(() =>
        page.evaluate(() => {
          const calls = (
            window as unknown as {
              __mediaPlaybackCalls: { play: string[]; pause: string[] }
            }
          ).__mediaPlaybackCalls
          return calls.pause.includes("Study 003.2")
        }),
      )
      .toBe(true)

    const playCalls = await page.evaluate(
      () =>
        (
          window as unknown as {
            __mediaPlaybackCalls: { play: string[]; pause: string[] }
          }
        ).__mediaPlaybackCalls.play,
    )
    expect(playCalls).toEqual([])
  })
})
