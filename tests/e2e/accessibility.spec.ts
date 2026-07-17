import AxeBuilder from "@axe-core/playwright"
import type { Page } from "@playwright/test"

import { expect, mediaButtons, test, waitForMediaWall } from "./fixtures"

function formatViolations(
  violations: Awaited<ReturnType<AxeBuilder["analyze"]>>["violations"],
) {
  return violations
    .map((violation) => {
      const targets = violation.nodes
        .flatMap((node) => node.target)
        .map(String)
        .join(", ")
      return `${violation.id} (${violation.impact ?? "unknown"}): ${targets}`
    })
    .join("\n")
}

async function expectNoSeriousAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze()
  const violations = results.violations.filter(
    (violation) => violation.impact === "critical" || violation.impact === "serious",
  )

  expect(
    violations,
    `Serious or critical axe violations:\n${formatViolations(violations)}`,
  ).toEqual([])
}

test.describe("keyboard and accessibility smoke", () => {
  test("wall and lightbox have no serious axe violations", async ({
    page,
  }) => {
    await page.goto("/")
    await waitForMediaWall(page)
    await expectNoSeriousAxeViolations(page)

    const firstMedia = mediaButtons(page).first()
    await firstMedia.focus()
    await expect(firstMedia).toBeFocused()
    const initialFocusId = await firstMedia.getAttribute("data-wall-focus-id")
    await page.keyboard.press("End")
    await expect
      .poll(() =>
        page.evaluate(() =>
          document.activeElement instanceof HTMLElement
            ? document.activeElement.dataset.wallFocusId
            : undefined,
        ),
      )
      .not.toBe(initialFocusId)
    await page.keyboard.press("Enter")

    await expect(page.getByRole("dialog")).toBeVisible()
    await expect(page.getByRole("button", { name: "Close lightbox" })).toBeFocused()
    await expectNoSeriousAxeViolations(page)

    await page.keyboard.press("Escape")
    await expect(page.getByRole("dialog")).toBeHidden()
    await expect(page).toHaveURL((url) => url.pathname === "/")
  })
})
