import { expect, mediaButtons, test, waitForMediaWall } from "./fixtures"
import {
  anchorDisplacement,
  captureViewportAnchor,
  lightboxMediaLocators,
  readMediaTransform,
  readWallGeometry,
} from "./media-interactions"

test.describe("desktop media wall", () => {
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
