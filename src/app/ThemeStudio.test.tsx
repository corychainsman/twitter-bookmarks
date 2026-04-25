import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'

import { ThemeStudio } from '@/app/ThemeStudio'
import { createDefaultTheme } from '@/features/theme/model'
import { replaceActiveTheme } from '@/features/theme/store'

describe('ThemeStudio', () => {
  beforeEach(() => {
    replaceActiveTheme(createDefaultTheme())
  })

  it('keeps numeric inputs focused across repeated arrow increments', async () => {
    const user = userEvent.setup()

    render(<ThemeStudio />)

    const densityInput = screen.getByLabelText('Density')

    densityInput.focus()
    expect(densityInput).toHaveFocus()

    await user.keyboard('{ArrowUp}{ArrowUp}')

    expect(densityInput).toHaveFocus()
    expect(densityInput).toHaveDisplayValue('0.2')
  })

  it('keeps numeric inputs focused after reaching the max clamp', async () => {
    const user = userEvent.setup()
    const theme = createDefaultTheme()
    theme.hyper.density = 1.9
    replaceActiveTheme(theme)

    render(<ThemeStudio />)

    const densityInput = screen.getByLabelText('Density')

    densityInput.focus()
    expect(densityInput).toHaveFocus()

    await user.keyboard('{ArrowUp}{ArrowUp}')

    expect(densityInput).toHaveFocus()
    expect(densityInput).toHaveDisplayValue('2')
  })

  it('surfaces invalid theme JSON and keeps import actions disabled', async () => {
    const user = userEvent.setup()

    render(<ThemeStudio />)

    const importInput = screen.getByLabelText('Theme JSON')
    const importCard = importInput.closest('[data-slot="card"]')

    expect(importCard).not.toBeNull()

    const importControls = within(importCard as HTMLElement)
    const applyButton = importControls.getByRole('button', { name: /^Apply$/ })
    const applyAndSaveButton = importControls.getByRole('button', {
      name: 'Apply + Save',
    })

    expect(applyButton).toBeDisabled()
    expect(applyAndSaveButton).toBeDisabled()

    await user.click(importInput)
    await user.paste('{bad json')

    expect(importInput).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('alert')).toHaveTextContent(
      /Theme JSON is not valid JSON/,
    )
    expect(applyButton).toBeDisabled()
    expect(applyAndSaveButton).toBeDisabled()
    expect(screen.getByLabelText('Theme Name')).toHaveDisplayValue(
      'Midnight Contact Sheet',
    )
  })
})
