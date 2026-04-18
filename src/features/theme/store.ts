import * as React from 'react'

import {
  createDefaultTheme,
  duplicateThemeDocument,
  normalizeThemeDocument,
  serializeThemeDocument,
  type ThemeDocument,
  type ThemeSnapshot,
} from '@/features/theme/model'
import { localStorageStore } from '@/lib/storage'

type StorageLike = {
  get: (key: string) => string | null
  set: (key: string, value: string) => void
  delete: (key: string) => void
}

const ACTIVE_THEME_STORAGE_KEY = 'twitter-bookmarks.theme.active.v1'
const SAVED_THEMES_STORAGE_KEY = 'twitter-bookmarks.theme.saved.v1'

const DEFAULT_SNAPSHOT: ThemeSnapshot = {
  activeTheme: createDefaultTheme(),
  savedThemes: [],
}

function sortSavedThemes(themes: ThemeDocument[]): ThemeDocument[] {
  return [...themes].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
}

function parseSavedThemes(value: string | null): ThemeDocument[] {
  if (!value) {
    return []
  }

  try {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed)) {
      return []
    }

    return sortSavedThemes(parsed.map((theme) => normalizeThemeDocument(theme)))
  } catch {
    return []
  }
}

function parseActiveTheme(value: string | null): ThemeDocument {
  if (!value) {
    return createDefaultTheme()
  }

  try {
    return normalizeThemeDocument(JSON.parse(value))
  } catch {
    return createDefaultTheme()
  }
}

export function readThemeSnapshot(storage: StorageLike): ThemeSnapshot {
  return {
    activeTheme: parseActiveTheme(storage.get(ACTIVE_THEME_STORAGE_KEY)),
    savedThemes: parseSavedThemes(storage.get(SAVED_THEMES_STORAGE_KEY)),
  }
}

export function writeThemeSnapshot(storage: StorageLike, snapshot: ThemeSnapshot): void {
  storage.set(ACTIVE_THEME_STORAGE_KEY, serializeThemeDocument(snapshot.activeTheme))
  storage.set(
    SAVED_THEMES_STORAGE_KEY,
    JSON.stringify(sortSavedThemes(snapshot.savedThemes), null, 2),
  )
}

function createThemeSnapshotStore(storage: StorageLike) {
  let snapshot = readThemeSnapshot(storage)
  const listeners = new Set<() => void>()

  const notify = () => {
    for (const listener of listeners) {
      listener()
    }
  }

  const commit = (nextSnapshot: ThemeSnapshot) => {
    snapshot = {
      activeTheme: normalizeThemeDocument(nextSnapshot.activeTheme),
      savedThemes: sortSavedThemes(
        nextSnapshot.savedThemes.map((theme) => normalizeThemeDocument(theme)),
      ),
    }
    writeThemeSnapshot(storage, snapshot)
    notify()
  }

  const handleStorage = (event: StorageEvent) => {
    if (
      event.key !== null &&
      event.key !== ACTIVE_THEME_STORAGE_KEY &&
      event.key !== SAVED_THEMES_STORAGE_KEY
    ) {
      return
    }

    snapshot = readThemeSnapshot(storage)
    notify()
  }

  return {
    getSnapshot(): ThemeSnapshot {
      return snapshot
    },
    subscribe(listener: () => void) {
      listeners.add(listener)

      if (listeners.size === 1 && typeof window !== 'undefined') {
        window.addEventListener('storage', handleStorage)
      }

      return () => {
        listeners.delete(listener)
        if (listeners.size === 0 && typeof window !== 'undefined') {
          window.removeEventListener('storage', handleStorage)
        }
      }
    },
    replaceActiveTheme(theme: ThemeDocument) {
      commit({
        ...snapshot,
        activeTheme: {
          ...normalizeThemeDocument(theme),
          updatedAt: new Date().toISOString(),
        },
      })
    },
    resetActiveTheme() {
      commit({
        ...snapshot,
        activeTheme: {
          ...createDefaultTheme(),
          updatedAt: new Date().toISOString(),
        },
      })
    },
    saveActiveTheme() {
      const activeTheme = normalizeThemeDocument(snapshot.activeTheme)
      const nextSavedThemes = sortSavedThemes([
        activeTheme,
        ...snapshot.savedThemes.filter((theme) => theme.id !== activeTheme.id),
      ])

      commit({
        activeTheme,
        savedThemes: nextSavedThemes,
      })
    },
    saveActiveThemeCopy() {
      const duplicate = duplicateThemeDocument(snapshot.activeTheme)
      commit({
        activeTheme: duplicate,
        savedThemes: [duplicate, ...snapshot.savedThemes],
      })
    },
    applySavedTheme(themeId: string) {
      const savedTheme = snapshot.savedThemes.find((theme) => theme.id === themeId)
      if (!savedTheme) {
        return
      }

      commit({
        ...snapshot,
        activeTheme: {
          ...normalizeThemeDocument(savedTheme),
          updatedAt: new Date().toISOString(),
        },
      })
    },
    deleteSavedTheme(themeId: string) {
      commit({
        ...snapshot,
        savedThemes: snapshot.savedThemes.filter((theme) => theme.id !== themeId),
      })
    },
  }
}

const themeSnapshotStore = createThemeSnapshotStore(localStorageStore)

export function useThemeSnapshot(): ThemeSnapshot {
  return React.useSyncExternalStore(
    themeSnapshotStore.subscribe,
    themeSnapshotStore.getSnapshot,
    () => DEFAULT_SNAPSHOT,
  )
}

export function replaceActiveTheme(theme: ThemeDocument): void {
  themeSnapshotStore.replaceActiveTheme(theme)
}

export function resetActiveTheme(): void {
  themeSnapshotStore.resetActiveTheme()
}

export function saveActiveTheme(): void {
  themeSnapshotStore.saveActiveTheme()
}

export function saveActiveThemeCopy(): void {
  themeSnapshotStore.saveActiveThemeCopy()
}

export function applySavedTheme(themeId: string): void {
  themeSnapshotStore.applySavedTheme(themeId)
}

export function deleteSavedTheme(themeId: string): void {
  themeSnapshotStore.deleteSavedTheme(themeId)
}

