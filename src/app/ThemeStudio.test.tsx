import { render, screen } from '@testing-library/react'
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
})
