import { expect, test as base, type Page } from "@playwright/test"

interface BrowserDiagnostics {
  consoleErrors: string[]
  pageErrors: string[]
}

interface Fixtures {
  browserDiagnostics: BrowserDiagnostics
}

export const test = base.extend<Fixtures>({
  browserDiagnostics: [
    async ({ page }, use) => {
      const diagnostics: BrowserDiagnostics = {
        consoleErrors: [],
        pageErrors: [],
      }

      page.on("console", (message) => {
        if (message.type() === "error") diagnostics.consoleErrors.push(message.text())
      })
      page.on("pageerror", (error) => diagnostics.pageErrors.push(error.message))

      await use(diagnostics)

      expect.soft(
        diagnostics.pageErrors,
        `Uncaught browser exceptions:\n${diagnostics.pageErrors.join("\n")}`,
      ).toEqual([])
      expect.soft(
        diagnostics.consoleErrors,
        `Browser console errors:\n${diagnostics.consoleErrors.join("\n")}`,
      ).toEqual([])
    },
    { auto: true },
  ],
})

export { expect }

export async function waitForMediaWall(page: Page) {
  const wall = page.getByRole("list", { name: "Media results" })
  await expect(wall).toBeVisible()
  await expect
    .poll(() => wall.getByRole("button", { name: /^Open / }).count())
    .toBeGreaterThan(0)
  await expect(wall.getByRole("button", { name: /^Open / }).first()).toBeInViewport({
    ratio: 0.5,
  })
  return wall
}

export function mediaButtons(page: Page) {
  return page
    .getByRole("list", { name: "Media results" })
    .getByRole("button", { name: /^Open / })
}
