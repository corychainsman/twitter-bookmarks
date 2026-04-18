import type {
  CoreArtifacts,
  SearchArtifacts,
} from '@/features/bookmarks/export-artifacts'

export type BookmarksArtifactCache = {
  getCore(buildId: string): Promise<Omit<CoreArtifacts, 'manifest'> | null>
  setCore(buildId: string, value: Omit<CoreArtifacts, 'manifest'>): Promise<void>
  getSearch(buildId: string): Promise<SearchArtifacts | null>
  setSearch(buildId: string, value: SearchArtifacts): Promise<void>
}

const DB_NAME = 'twitter-bookmarks-cache'
const DB_VERSION = 1
const CORE_STORE = 'core-artifacts'
const SEARCH_STORE = 'search-artifacts'

type StoreName = typeof CORE_STORE | typeof SEARCH_STORE

let databasePromise: Promise<IDBDatabase> | null = null

function createMemoryCache(): BookmarksArtifactCache {
  const core = new Map<string, Omit<CoreArtifacts, 'manifest'>>()
  const search = new Map<string, SearchArtifacts>()

  return {
    async getCore(buildId) {
      return core.get(buildId) ?? null
    },
    async setCore(buildId, value) {
      core.set(buildId, value)
    },
    async getSearch(buildId) {
      return search.get(buildId) ?? null
    },
    async setSearch(buildId, value) {
      search.set(buildId, value)
    },
  }
}

function openDatabase(): Promise<IDBDatabase> {
  if (databasePromise) {
    return databasePromise
  }

  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(CORE_STORE)) {
        database.createObjectStore(CORE_STORE)
      }
      if (!database.objectStoreNames.contains(SEARCH_STORE)) {
        database.createObjectStore(SEARCH_STORE)
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB cache.'))
  })

  return databasePromise
}

async function readFromStore<T>(storeName: StoreName, key: string): Promise<T | null> {
  const database = await openDatabase()

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readonly')
    const store = transaction.objectStore(storeName)
    const request = store.get(key)

    request.onsuccess = () => resolve((request.result as T | undefined) ?? null)
    request.onerror = () => reject(request.error ?? new Error(`Failed to read ${storeName}.`))
  })
}

async function writeToStore<T>(storeName: StoreName, key: string, value: T): Promise<void> {
  const database = await openDatabase()

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readwrite')
    const store = transaction.objectStore(storeName)
    store.put(value, key)

    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error(`Failed to write ${storeName}.`))
  })
}

export function createBookmarksArtifactCache(): BookmarksArtifactCache {
  if (typeof indexedDB === 'undefined') {
    return createMemoryCache()
  }

  return {
    async getCore(buildId) {
      return readFromStore<Omit<CoreArtifacts, 'manifest'>>(CORE_STORE, buildId)
    },
    async setCore(buildId, value) {
      await writeToStore(CORE_STORE, buildId, value)
    },
    async getSearch(buildId) {
      return readFromStore<SearchArtifacts>(SEARCH_STORE, buildId)
    },
    async setSearch(buildId, value) {
      await writeToStore(SEARCH_STORE, buildId, value)
    },
  }
}
