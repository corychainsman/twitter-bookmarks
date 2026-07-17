import { expect, test, waitForMediaWall } from "./fixtures"
import {
  anchorDisplacement,
  captureViewportAnchor,
  dispatchPinchOut,
  lightboxMediaLocators,
  readMediaTransform,
  readWallGeometry,
} from "./media-interactions"

test.describe("emulated mobile media wall", () => {
  test("keeps justified gutters uniform at a simulated phone viewport", async ({ page }) => {
    await page.goto("/")
    await waitForMediaWall(page)

    const geometry = await readWallGeometry(page)
    const gaps = [...geometry.horizontalGaps, ...geometry.verticalGaps]

    expect(gaps.length).toBeGreaterThan(10)
    expect(Math.max(...gaps.map((gap) => Math.abs(gap - 4)))).toBeLessThan(0.1)
    expect(Math.max(...geometry.aspectRatioErrors)).toBeLessThan(0.02)
  })

  test("stages filters in a touch drawer and commits them to the URL", async ({
    page,
  }) => {
    await page.goto("/")
    await waitForMediaWall(page)

    await page.getByRole("button", { name: "Filters" }).click()
    const drawer = page.getByRole("dialog", { name: "Filters" })
    await expect(drawer).toBeVisible()
    await expect(drawer.getByText("Changes take effect when you apply them.")).toBeVisible()

    await drawer.getByRole("checkbox", { name: "Videos" }).check()
    const apply = drawer.getByRole("button", { name: /^Show \d+ results$/ })
    await expect(apply).toBeEnabled()
    await apply.click()

    await expect(drawer).toBeHidden()
    await expect(page).toHaveURL((url) =>
      url.searchParams.getAll("filters").includes("kind:video"),
    )
    await expect(page.getByRole("list", { name: "Media results" })).toBeVisible()
  })

  test("pinch-zooms URL lightbox media and resets to its resting transform", async ({
    context,
    page,
  }) => {
    await page.goto("/media/record-001-media-1")
    const { dialog, image, layer, viewport } = lightboxMediaLocators(page, "Study 001.1")
    await expect(dialog).toBeVisible()
    await expect(image).toBeVisible()
    await expect(layer).toHaveCSS("transform", "none")

    await dispatchPinchOut(context, page, viewport)

    const reset = page.getByRole("button", { name: "Reset zoom" })
    await expect(reset).toBeVisible()
    await expect
      .poll(async () => (await readMediaTransform(layer)).scaleX)
      .toBeGreaterThan(2)

    await reset.click()
    await expect(reset).toBeHidden()
    await expect(layer).toHaveCSS("transform", "none")
    expect(await readMediaTransform(layer)).toEqual({
      scaleX: 1,
      scaleY: 1,
      translateX: 0,
      translateY: 0,
    })
  })

  test("two-finger pinch commits wall density without losing the viewport center", async ({
    context,
    page,
  }) => {
    await page.goto("/")
    const wall = await waitForMediaWall(page)
    const wallGestureSurface = wall.locator("xpath=../..")
    const initialHistoryLength = await page.evaluate(() => window.history.length)
    const anchor = await captureViewportAnchor(page)
    const viewport = page.viewportSize()
    if (!viewport) throw new Error("The mobile project has no configured viewport")

    await dispatchPinchOut(context, page, wallGestureSurface, {
      center: { x: viewport.width / 2, y: viewport.height / 2 },
      distances: [34, 38, 42, 48],
    })

    await expect(page).toHaveURL((url) => {
      const density = Number(url.searchParams.get("density"))
      return Number.isFinite(density) && density > 1
    })
    await expect
      .poll(() => page.evaluate(() => window.history.length))
      .toBe(initialHistoryLength + 1)
    await expect(wall).toBeVisible()
    await expect
      .poll(() => anchorDisplacement(page, anchor))
      .toBeLessThan(20)
  })
})
