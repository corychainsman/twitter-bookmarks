import { describe, expect, it } from 'vitest'

import {
  createDefaultTheme,
  duplicateThemeDocument,
} from '@/features/theme/model'
import { readThemeSnapshot, writeThemeSnapshot } from '@/features/theme/store'

function createMemoryStorage() {
  const values = new Map<string, string>()

  return {
    get(key: string) {
      return values.get(key) ?? null
    },
    set(key: string, value: string) {
      values.set(key, value)
    },
    delete(key: string) {
      values.delete(key)
    },
  }
}

describe('theme store persistence', () => {
  it('falls back to the default snapshot when storage is empty', () => {
    const snapshot = readThemeSnapshot(createMemoryStorage())

    expect(snapshot.activeTheme.name).toBe('Midnight Contact Sheet')
    expect(snapshot.savedThemes).toEqual([])
  })

  it('round-trips the active theme and saved library through storage', () => {
    const storage = createMemoryStorage()
    const activeTheme = createDefaultTheme()
    const savedTheme = duplicateThemeDocument(activeTheme, 'Gallery Soft')

    writeThemeSnapshot(storage, {
      activeTheme: savedTheme,
      savedThemes: [savedTheme],
    })

    const snapshot = readThemeSnapshot(storage)

    expect(snapshot.activeTheme.id).toBe(savedTheme.id)
    expect(snapshot.activeTheme.name).toBe('Gallery Soft')
    expect(snapshot.savedThemes).toHaveLength(1)
    expect(snapshot.savedThemes[0]?.name).toBe('Gallery Soft')
  })
})
