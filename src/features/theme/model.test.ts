import { describe, expect, it } from 'vitest'

import {
  createDefaultTheme,
  deriveThemeVariables,
  normalizeThemeDocument,
  parseThemeDocumentJson,
  serializeThemeDocument,
} from '@/features/theme/model'

describe('theme model', () => {
  it('derives runtime variables from the default theme', () => {
    const theme = createDefaultTheme()
    const variables = deriveThemeVariables(theme)

    expect(variables['--background']).toBe(theme.semantic.background)
    expect(variables['--app-canvas-top']).toBe(theme.canvas.top)
    expect(variables['--app-control-radius']).toBe('999.00px')
    expect(variables['--app-tile-radius']).toBe('2.00px')
    expect(variables['--app-grid-gap-x']).toBe('4.00px')
    expect(variables['--app-tile-body-size']).toBe('13.00px')
  })

  it('scales spacing, radii, blur, and typography through hyperparameters', () => {
    const theme = createDefaultTheme()
    theme.hyper.density = 1
    theme.hyper.softness = 1.5
    theme.hyper.atmosphere = 1.25
    theme.hyper.typeScale = 1.2

    const variables = deriveThemeVariables(theme)

    expect(variables['--app-grid-gap-x']).toBe('3.28px')
    expect(variables['--app-panel-radius']).toBe('36.00px')
    expect(variables['--app-toolbar-blur']).toBe('30.00px')
    expect(variables['--app-lightbox-body-size']).toBe('18.00px')
  })

  it('normalizes malformed theme payloads back to safe defaults', () => {
    const normalized = normalizeThemeDocument({
      name: '',
      hyper: {
        density: 999,
        softness: -10,
      },
      geometry: {
        gridGapX: -50,
      },
    })

    expect(normalized.name).toBe('Midnight Contact Sheet')
    expect(normalized.hyper.density).toBe(2)
    expect(normalized.hyper.softness).toBe(0.5)
    expect(normalized.geometry.gridGapX).toBe(0)
  })

  it('parses serialized theme json back into a normalized theme document', () => {
    const theme = createDefaultTheme()
    theme.name = 'Imported Theme'
    theme.geometry.tileRadius = 31

    const parsed = parseThemeDocumentJson(serializeThemeDocument(theme))

    expect(parsed.name).toBe('Imported Theme')
    expect(parsed.geometry.tileRadius).toBe(31)
  })

  it('migrates the untouched legacy default theme geometry to the new defaults', () => {
    const normalized = normalizeThemeDocument({
      ...createDefaultTheme(),
      geometry: {
        ...createDefaultTheme().geometry,
        tileRadius: 22,
        gridGapX: 16,
        gridGapY: 16,
      },
    })

    expect(normalized.geometry.tileRadius).toBe(2)
    expect(normalized.geometry.gridGapX).toBe(4)
    expect(normalized.geometry.gridGapY).toBe(4)
  })
})
