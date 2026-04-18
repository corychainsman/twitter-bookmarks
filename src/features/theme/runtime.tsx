import * as React from 'react'

import { deriveThemeVariables } from '@/features/theme/model'
import { useThemeSnapshot } from '@/features/theme/store'

export function ThemeRuntimeBridge() {
  const { activeTheme } = useThemeSnapshot()

  React.useEffect(() => {
    const root = document.documentElement
    const variables = deriveThemeVariables(activeTheme)

    for (const [name, value] of Object.entries(variables)) {
      root.style.setProperty(name, value)
    }
  }, [activeTheme])

  return null
}
